import { useState, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import AnimeCard, { AnimeCardData, SeasonData } from "../components/AnimeCard";
import { FolderOpen, Loader2, ChevronDown, RefreshCw } from "lucide-react";
import ScanConfirmModal, { ScanEntry } from "../components/ScanConfirmModal";

interface EpisodeFile {
  file_name: string;
  file_path: string;
}

interface EpisodeDto {
  episode_number: number;
  file_path: string;
  file_name: string;
  season_name: string;
}

interface Season {
  season_name: string;
  path: string;
  episode_files: EpisodeFile[];
}

interface DiscoveredSeries {
  name: string;
  path: string;
  episode_files: EpisodeFile[];
  seasons: Season[];
}

interface SeriesMetadata {
  anilist_id: number;
  title: string;
  title_english: string | null;
  title_native: string | null;
  synopsis: string | null;
  episode_count: number | null;
  anilist_score: number | null;
  cover_url: string | null;
  genres: string[];
  status: string | null;
}

interface SeriesDto {
  id: number;
  title: string;
  title_english: string | null;
  title_native: string | null;
  local_path: string;
  cover_local_path: string | null;
  cover_remote_url: string | null;
  synopsis: string | null;
  episode_count: number | null;
  status: string;
  anilist_id: number | null;
  anilist_score: number | null;
  genres: string[];
  episodes: EpisodeDto[];
}

type SortOption = "title_asc" | "title_desc" | "score_desc" | "episodes_desc";
type StatusFilter =
  | "all"
  | "watching"
  | "completed"
  | "on_hold"
  | "plan_to_watch";

interface LibraryPageProps {
  searchQuery: string;
  onSeriesCountChange: (count: number) => void;
  statusFilter?: StatusFilter;
  onSelectAnime: (anime: AnimeCardData) => void;
  statusUpdates: Record<number, AnimeCardData["status"]>;
}

const SORT_LABELS: Record<SortOption, string> = {
  title_asc: "Title A → Z",
  title_desc: "Title Z → A",
  score_desc: "Highest Score",
  episodes_desc: "Most Episodes",
};

// Strips torrent prefixes like [Vodes], [SubGroup], (1080p) etc.
// before sending to AniList for a cleaner match
function cleanTitleForSearch(raw: string): string {
  return (
    raw
      // Handle FLAC5.1, DD5.1 etc BEFORE dot replacement
      .replace(/\b(FLAC|DD|DDP|AC3|DTS)\d*\.\d+\b/gi, "")

      // Remove episode/volume ranges like 1-1006, 001-131, 1-23
      .replace(/\b\d{1,4}[-–]\d{1,4}\b/g, "")

      // Remove "+ Movies", "+ OVA", "+ Specials" with optional numbers
      .replace(/\+\s*(Movies?|OVA|ONA|Specials?|Films?)(\s+[\d\s-]+)?/gi, "")

      // Remove batch/collection keywords
      .replace(
        /\b(Batch|Complete|Collection|Series|Season|Vol\.?\s*\d+)\b/gi,
        "",
      )

      // Replace dots used as separators
      .replace(/(?<!\.)\.(?!\.)/g, " ")

      // Remove leading group tags like [Vodes], [PsyPlex]
      .replace(/^\[.*?\]\s*/g, "")

      // Remove all remaining square bracket content
      .replace(/\[.*?\]/g, "")

      // Remove parenthetical content like (2025)
      .replace(/\(.*?\)/g, "")

      // Remove season notation: S01, S1, S01E01
      .replace(/\bS\d{1,2}(E\d{1,2})?\b/gi, "")

      // Remove video quality tags
      .replace(
        /\b(1080p?|720p?|480p?|4K|2160p?|BD|BDRip|BluRay|WEBRip|WEB-DL|HDTV|DVDRIP)\b/gi,
        "",
      )

      // Remove codec tags
      .replace(
        /\b(x264|x265|HEVC|AVC|Hi10p|10bit|8bit|FLAC|AAC|DD\+?|DTS|AC3|MP3|Opus)\b/gi,
        "",
      )

      // Remove short uppercase release group tags (2-4 capital letters)
      // e.g. CTR, YG, ASW — but NOT real words like BD
      .replace(/\b(?!BD\b|BC\b)[A-Z]{2,4}\b/g, "")

      // Remove release group names after trailing dash
      .replace(/-\w+$/g, "")

      // Remove audio tags
      .replace(/\b(Dual[\s-]?Audio|Multi[\s-]?Audio|Dubbed|Subbed|RAW)\b/gi, "")

      // Remove standalone 3+ digit numbers (episode numbers)
      .replace(/\b\d{3,}\b/g, "")

      // Remove standalone years
      .replace(/\b(19|20)\d{2}\b/g, "")

      // Replace dashes and underscores with spaces
      .replace(/[-_]/g, " ")

      // Collapse multiple spaces
      .replace(/\s+/g, " ")

      .trim()
  );
}

// Converts a local file path to a Tauri asset URL
// so React can display locally stored cover art
function localCoverUrl(path: string | null): string | null {
  if (!path) return null;
  try {
    return convertFileSrc(path);
  } catch {
    return null;
  }
}

// Maps a SeriesDto from SQLite into an AnimeCardData for the UI
function dtoToCardData(dto: SeriesDto): AnimeCardData {
  const coverUrl = localCoverUrl(dto.cover_local_path) ?? dto.cover_remote_url;

  // Group flat episode list back into seasons
  const seasonMap = new Map<string, SeasonData>();

  for (const ep of dto.episodes) {
    if (!seasonMap.has(ep.season_name)) {
      seasonMap.set(ep.season_name, {
        season_name: ep.season_name,
        path: dto.local_path,
        episode_files: [],
      });
    }
    seasonMap.get(ep.season_name)!.episode_files.push({
      file_name: ep.file_name,
      file_path: ep.file_path,
    });
  }

  // Sort seasons naturally
  const seasons = Array.from(seasonMap.values()).sort((a, b) =>
    a.season_name.localeCompare(b.season_name, undefined, { numeric: true }),
  );

  return {
    id: dto.id,
    name: dto.title,
    coverUrl,
    status: dto.status as AnimeCardData["status"],
    episodesWatched: 0,
    episodeCount: dto.episode_count,
    genres: dto.genres,
    score: dto.anilist_score ?? undefined,
    synopsis: dto.synopsis ?? undefined,
    seasons, // ← now populated from DB
  };
}

export default function LibraryPage({
  searchQuery,
  onSeriesCountChange,
  statusFilter = "all",
  onSelectAnime,
  statusUpdates,
}: LibraryPageProps) {
  const [folderPath, setFolderPath] = useState("");
  const [library, setLibrary] = useState<AnimeCardData[]>([]);
  const [scanning, setScanning] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [hasLibrary, setHasLibrary] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("title_asc");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [pendingScan, setPendingScan] = useState<ScanEntry[] | null>(null);
  const [isRescanning, setIsRescanning] = useState(false);

  // Load library from SQLite on startup
  useEffect(() => {
    loadLibraryFromDb();
    loadSavedFolder();
  }, []);

  async function loadLibraryFromDb() {
    try {
      const series = await invoke<SeriesDto[]>("get_library");
      if (series.length > 0) {
        const cards = series.map(dtoToCardData);
        setLibrary(cards);
        onSeriesCountChange(cards.length);
        setHasLibrary(true);
      }
    } catch (err) {
      console.error("Failed to load library from DB:", err);
    }
  }

  async function loadSavedFolder() {
    try {
      const saved = await invoke<string | null>("get_setting", {
        key: "library_folder",
      });
      if (saved && saved.trim()) {
        setFolderPath(saved);
      }
    } catch {
      // silently ignore
    }
  }

  // Collect all unique genres dynamically from loaded library
  const allGenres = useMemo(() => {
    const genreSet = new Set<string>();
    library.forEach((anime) => anime.genres.forEach((g) => genreSet.add(g)));
    return Array.from(genreSet).sort();
  }, [library]);

  // Apply all filters and sorting
  const filtered = useMemo(() => {
    let result = library.map((anime) => ({
      ...anime,
      status:
        anime.id && statusUpdates[anime.id]
          ? statusUpdates[anime.id]
          : anime.status,
    }));

    if (searchQuery.trim()) {
      result = result.filter((anime) =>
        anime.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((anime) => anime.status === statusFilter);
    }

    if (activeGenre) {
      result = result.filter((anime) => anime.genres.includes(activeGenre));
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "title_asc":
          return a.name.localeCompare(b.name);
        case "title_desc":
          return b.name.localeCompare(a.name);
        case "score_desc":
          return (b.score ?? 0) - (a.score ?? 0);
        case "episodes_desc":
          return (b.episodeCount ?? 0) - (a.episodeCount ?? 0);
        default:
          return 0;
      }
    });

    return result;
  }, [library, searchQuery, statusFilter, activeGenre, sortBy, statusUpdates]);

  async function fetchWithRetry(
    title: string,
    retries = 3,
  ): Promise<SeriesMetadata> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const meta = await invoke<SeriesMetadata>("fetch_metadata", { title });
        return meta;
      } catch (err) {
        const isLastAttempt = attempt === retries - 1;
        if (isLastAttempt) throw err;
        // Always retry — could be rate limit disguised as "no results"
        const waitMs = 3000 * (attempt + 1);
        console.log(
          `⏳ Retrying "${title}" in ${waitMs}ms (attempt ${attempt + 1})`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
    throw new Error(`Failed after ${retries} attempts`);
  }

  async function handleConfirmAndFetch(confirmedEntries: ScanEntry[]) {
    setPendingScan(null);
    setFetchingMetadata(true);
    setProgress({ current: 0, total: confirmedEntries.length });

    // We still need the full DiscoveredSeries for seasons/episodes
    // Re-scan to get the full data (it's fast since it's just file system)
    const discovered = await invoke<DiscoveredSeries[]>("scan_anime_folder", {
      path: folderPath,
    });

    const results: AnimeCardData[] = [];

    for (let i = 0; i < confirmedEntries.length; i++) {
      const entry = confirmedEntries[i];
      const series = discovered.find(
        (d) =>
          d.path.toLowerCase().replace(/\\/g, "/").trim() ===
          entry.path.toLowerCase().replace(/\\/g, "/").trim(),
      );
      setProgress({ current: i + 1, total: confirmedEntries.length });

      if (!series) {
        console.warn("No matching series found for path:", entry.path);
        console.log(
          "Available paths:",
          discovered.map((d) => d.path),
        );
        continue;
      }

      console.log(`Fetching [${i + 1}/${confirmedEntries.length}]:`, {
        original: entry.originalName,
        edited: entry.editedName,
      });

      try {
        const meta = await fetchWithRetry(entry.editedName);
        console.log("SUCCESS: Got metadata:", meta.title);

        await new Promise((resolve) => setTimeout(resolve, 2500));

        const allEpisodes: [number, string, string, string][] = [];
        let epNumber = 1;
        for (const season of series.seasons) {
          for (const ep of season.episode_files) {
            allEpisodes.push([
              epNumber++,
              ep.file_path,
              ep.file_name,
              season.season_name,
            ]);
          }
        }

        const savedId = await invoke<number>("save_series_to_library", {
          title: meta.title,
          titleEnglish: meta.title_english,
          titleNative: meta.title_native,
          localPath: series.path,
          coverRemoteUrl: meta.cover_url,
          synopsis: meta.synopsis,
          episodeCount: meta.episode_count,
          anilistId: meta.anilist_id,
          anilistScore: meta.anilist_score,
          genres: meta.genres,
          episodes: allEpisodes,
          forceRefresh: isRescanning,
        });

        results.push({
          id: savedId,
          name: meta.title,
          coverUrl: meta.cover_url,
          status: "plan_to_watch",
          episodesWatched: 0,
          episodeCount: meta.episode_count,
          genres: meta.genres,
          score: meta.anilist_score ?? undefined,
          synopsis: meta.synopsis ?? undefined,
          seasons: series.seasons,
        });
      } catch (err) {
        console.error(
          "❌ Metadata failed for:",
          entry.editedName,
          "Error:",
          err,
        );
        const cleanedName = cleanTitleForSearch(series.name);
        results.push({
          name: cleanedName,
          coverUrl: null,
          status: "plan_to_watch",
          episodesWatched: 0,
          episodeCount: series.episode_files.length,
          genres: [],
          seasons: series.seasons,
        });
      }

      setLibrary([...results]);
      onSeriesCountChange(results.length);
    }

    setHasLibrary(true);
    setIsRescanning(false);

    await invoke("save_setting", {
      key: "library_folder",
      value: folderPath,
    });

    setFetchingMetadata(false);
  }

  async function handleRescan() {
    setIsRescanning(true); // ← marks this as a rescan
    setHasLibrary(false);
    setLibrary([]);
    setActiveGenre(null);
    onSeriesCountChange(0);

    await new Promise((resolve) => setTimeout(resolve, 50));
    await handleScan();
  }

  async function handleScan() {
    if (!folderPath.trim()) {
      setError("Please enter your anime folder path");
      return;
    }

    setScanning(true);
    setError("");

    try {
      const discovered = await invoke<DiscoveredSeries[]>("scan_anime_folder", {
        path: folderPath,
      });

      if (discovered.length === 0) {
        setError("No anime found in that folder");
        return;
      }

      // Build entries for the confirm modal
      const entries: ScanEntry[] = discovered.map((series) => {
        const cleaned = cleanTitleForSearch(series.name);
        return {
          originalName: series.name,
          cleanedName: cleaned,
          editedName: cleaned,
          path: series.path,
          episodeCount: series.episode_files.length,
        };
      });

      // Show confirm modal with discovered series
      setPendingScan(entries);
    } catch (err) {
      setError(`Scan error: ${err}`);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Scan Bar (shown when no library yet) ── */}
      {!hasLibrary && (
        <div className="flex flex-col gap-3">
          <p className="text-[#445566] text-sm">
            Point RU: AniShelf at your anime folder to get started.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              placeholder="e.g. C:\Videos\Anime"
              className="flex-1 bg-[#0e0e1a] border border-[#00d4ff]/15
                rounded-md px-4 py-2.5 text-sm text-[#f0f4ff]
                placeholder-[#445566] outline-none
                focus:border-[#00d4ff]/40 transition-colors"
            />
            <button
              onClick={handleScan}
              disabled={scanning || fetchingMetadata}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md
    bg-[#00d4ff] text-[#050508] font-bold text-sm
    hover:bg-[#00bfe8] transition-colors
    disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FolderOpen size={15} />
              {scanning ? "Scanning..." : "Scan Library"}
            </button>
          </div>
          {error && <p className="text-[#ff4466] text-sm">{error}</p>}
        </div>
      )}

      {/* ── Progress Bar ── */}
      {fetchingMetadata && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-[#8899bb]">
              <Loader2 size={14} className="animate-spin text-[#00d4ff]" />
              Fetching metadata and caching covers...
            </div>
            <span className="text-[#445566] text-xs">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="h-[3px] bg-[#1c1c30] rounded-full">
            <div
              className="h-full bg-gradient-to-r from-[#0099cc] to-[#00d4ff]
                rounded-full transition-all duration-300"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Filter & Sort Bar ── */}
      {hasLibrary && !fetchingMetadata && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[#445566] text-xs">
              {filtered.length} series
              {searchQuery ? ` matching "${searchQuery}"` : ""}
              {statusFilter !== "all"
                ? ` · ${statusFilter.replace(/_/g, " ")}`
                : ""}
              {activeGenre ? ` · ${activeGenre}` : ""}
            </p>

            <div className="flex items-center gap-2">
              {/* Rescan button */}
              <button
                onClick={handleRescan}
                className="flex items-center gap-1.5 text-xs
                  text-[#445566] hover:text-[#00d4ff] transition-colors"
              >
                <RefreshCw size={11} />
                Rescan
              </button>

              {/* Sort dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu((prev) => !prev)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md
                    border border-[#00d4ff]/10 text-[#8899bb] text-xs
                    hover:border-[#00d4ff]/30 hover:text-[#f0f4ff]
                    transition-all"
                >
                  {SORT_LABELS[sortBy]}
                  <ChevronDown size={11} />
                </button>

                {showSortMenu && (
                  <div
                    className="absolute right-0 top-full mt-1 z-50
                    bg-[#13131f] border border-[#00d4ff]/15 rounded-md
                    overflow-hidden shadow-xl min-w-[160px]"
                  >
                    {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          setSortBy(opt);
                          setShowSortMenu(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs
                          transition-colors
                          ${
                            sortBy === opt
                              ? "text-[#00d4ff] bg-[#00d4ff]/10"
                              : "text-[#8899bb] hover:bg-[#1c1c30] hover:text-[#f0f4ff]"
                          }`}
                      >
                        {SORT_LABELS[opt]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Genre chips */}
          {allGenres.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveGenre(null)}
                className={`px-3 py-1 rounded-md text-[11px] font-bold
                  border transition-all
                  ${
                    activeGenre === null
                      ? "border-[#00d4ff]/40 text-[#00d4ff] bg-[#00d4ff]/10"
                      : "border-[#00d4ff]/10 text-[#445566] hover:text-[#8899bb]"
                  }`}
              >
                All
              </button>
              {allGenres.map((genre) => (
                <button
                  key={genre}
                  onClick={() =>
                    setActiveGenre(activeGenre === genre ? null : genre)
                  }
                  className={`px-3 py-1 rounded-md text-[11px] font-bold
                    border transition-all
                    ${
                      activeGenre === genre
                        ? "border-[#00d4ff]/40 text-[#00d4ff] bg-[#00d4ff]/10"
                        : "border-[#00d4ff]/10 text-[#445566] hover:text-[#8899bb]"
                    }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Anime Grid ── */}
      {filtered.length > 0 && (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            contain: "layout style",
          }}
        >
          {filtered.map((anime, i) => (
            <AnimeCard
              key={i}
              anime={anime}
              onClick={() => onSelectAnime(anime)}
            />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {hasLibrary && filtered.length === 0 && !fetchingMetadata && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <FolderOpen size={40} className="text-[#445566]" />
          <p className="text-[#445566] text-sm">No anime found</p>
        </div>
      )}
      {/* ── Scan Confirm Modal ── */}
      {pendingScan && (
        <ScanConfirmModal
          entries={pendingScan}
          onConfirm={handleConfirmAndFetch}
          onCancel={() => {
            setPendingScan(null);
            setIsRescanning(false);
          }}
        />
      )}
    </div>
  );
}
