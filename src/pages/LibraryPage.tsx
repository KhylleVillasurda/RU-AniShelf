import { useState, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import SkeletonCard from "../components/SkeletonCard";
import AnimeCard, {
  AnimeCardData,
  SeasonData,
  CardSize,
} from "../components/AnimeCard";
import { FolderOpen, Loader2, ChevronDown, RefreshCw } from "lucide-react";
import ScanConfirmModal, { ScanEntry } from "../components/ScanConfirmModal";
import MetadataFieldPickerModal, {
  MalResult,
} from "../components/MetadataFieldPickerModal";
import AniListPickerModal, {
  SearchResult,
} from "../components/AniListPickerModal";

type GridLayout = "compact" | "comfortable" | "cozy";

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

const GRID_COLS: Record<GridLayout, string> = {
  compact: "repeat(auto-fill, minmax(120px, 1fr))",
  comfortable: "repeat(auto-fill, minmax(160px, 1fr))",
  cozy: "repeat(auto-fill, minmax(200px, 1fr))",
};

// Strips torrent prefixes like [Vodes], [SubGroup], (1080p) etc.
// before sending to AniList for a cleaner match
function cleanTitleForSearch(raw: string): string {
  const protectedAbbreviations = new Set([
    "NHK",
    "FBI",
    "CIA",
    "DNA",
    "NYC",
    "LA",
    "TV",
    "OVA",
    "ONA",
    "SP",
    "BD",
  ]);

  return (
    raw
      .replace(/\b(FLAC|DD|DDP|AC3|DTS)\d*\.\d+\b/gi, "")

      // Remove episode ranges with dash: 1-1006, 001-131
      .replace(/\b\d{1,4}[-–]\d{1,4}\b/g, "")

      // Remove episode ranges with tilde: "1 ~ 12", "01~24"
      .replace(/\b\d{1,4}\s*[~～]\s*\d{1,4}\b/g, "")

      // Only strip + when followed by known bonus keywords
      .replace(/\s*\+\s*(Movies?|OVA|ONA|Specials?|Films?)(\s+[\d\s-]+)?/gi, "")

      .replace(/\b(Batch|Complete|Collection|Series|Vol\.?\s*\d+)\b/gi, "")
      .replace(/\bSeason\s*\d+\b/gi, "")
      .replace(/(?<!\.)\.(?!\.)/g, " ")
      .replace(/^\[.*?\]\s*/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/\(.*?\)/g, "")
      .replace(/\bS\d{1,2}(E\d{1,2})?\b/gi, "")
      .replace(
        /\b(1080p?|720p?|480p?|4K|2160p?|BD|BDRip|BluRay|WEBRip|WEB-DL|HDTV|DVDRIP)\b/gi,
        "",
      )
      .replace(
        /\b(x264|x265|HEVC|AVC|Hi10p|10[\s-]?bits?|8[\s-]?bits?|FLAC|AAC|DD\+?|DTS|AC3|MP3|Opus)\b/gi,
        "",
      )
      .replace(
        /\b(Dual[\s-]?Audio|Multi[\s-]?Audio|Dubbed|Subbed|RAW|Eng[\s-]?Subs?|Jpn|Eng|Sub)\b/gi,
        "",
      )
      .replace(/-[A-Z][A-Za-z0-9]{1,7}$/, "")
      .replace(/\b[A-Z]{2,4}\b/g, (match) => {
        return protectedAbbreviations.has(match) ? match : "";
      })
      .replace(/\b\d{3,}\b/g, "")
      .replace(/\b(19|20)\d{2}\b/g, "")
      .replace(/\s[-_]\s/g, " ")
      .replace(/^[-_]|[-_]$/g, " ")

      // Clean up trailing/leading dots left by removals
      .replace(/[\s.]+$/, "")
      .replace(/^[\s.]+/, "")

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
  const [error] = useState("");
  const [hasLibrary, setHasLibrary] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("title_asc");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [pendingScan, setPendingScan] = useState<ScanEntry[] | null>(null);
  const [isRescanning, setIsRescanning] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);
  const [cardSize, setCardSize] = useState<CardSize>("medium");
  const [gridLayout, setGridLayout] = useState<GridLayout>("comfortable");
  const [fieldPickerData, setFieldPickerData] = useState<{
    anilist: SearchResult;
    mal: MalResult;
    seriesTitle: string;
    resolve: (result: SearchResult) => void;
  } | null>(null);
  const [pickerData, setPickerData] = useState<{
    results: SearchResult[];
    searchedTitle: string;
    resolve: (result: SearchResult | null) => void;
  } | null>(null);

  // Load library from SQLite on startup
  useEffect(() => {
    loadLibraryFromDb();
    loadSavedFolder();
    loadDisplaySettings();
  }, []);

  async function loadDisplaySettings() {
    try {
      const size = await invoke<string | null>("get_setting", {
        key: "card_size",
      });
      const layout = await invoke<string | null>("get_setting", {
        key: "grid_layout",
      });
      if (size) setCardSize(size as CardSize);
      if (layout) setGridLayout(layout as GridLayout);
    } catch {
      // use defaults
    }
  }

  // Load registered folders on mount
  useEffect(() => {
    invoke<string[]>("get_library_folders")
      .then(setFolders)
      .catch(console.error);
  }, []);

  // Pre-fill folder path from first registered folder if input is empty
  useEffect(() => {
    if (folders.length > 0 && !folderPath) {
      setFolderPath(folders[0]);
    }
  }, [folders]);

  function showFieldPicker(
    anilist: SearchResult,
    mal: MalResult,
    seriesTitle: string,
  ): Promise<SearchResult> {
    return new Promise((resolve) => {
      setFieldPickerData({ anilist, mal, seriesTitle, resolve });
    });
  }

  function showPicker(
    results: SearchResult[],
    searchedTitle: string,
  ): Promise<SearchResult | null> {
    return new Promise((resolve) => {
      setPickerData({ results, searchedTitle, resolve });
    });
  }

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
          return (a.name ?? "").localeCompare(b.name ?? "");
        case "title_desc":
          return (b.name ?? "").localeCompare(a.name ?? "");
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

  async function handleConfirmAndFetch(confirmedEntries: ScanEntry[]) {
    setPendingScan(null);
    setFetchingMetadata(true);
    setProgress({ current: 0, total: confirmedEntries.length });

    const registeredFolders = await invoke<string[]>("get_library_folders");
    const allFolders = Array.from(
      new Set([
        ...(folderPath.trim() ? [folderPath.trim()] : []),
        ...registeredFolders,
      ]),
    );

    let discovered: DiscoveredSeries[] = [];
    for (const folder of allFolders) {
      try {
        const result = await invoke<DiscoveredSeries[]>("scan_anime_folder", {
          path: folder,
        });
        discovered = [...discovered, ...result];
      } catch (err) {
        console.warn(`Re-scan failed for folder ${folder}:`, err);
      }
    }

    const cards: AnimeCardData[] = []; // ← renamed from results to cards

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
        continue;
      }

      console.log(`Fetching [${i + 1}/${confirmedEntries.length}]:`, {
        original: entry.originalName,
        edited: entry.editedName,
      });

      try {
        // Get current metadata source setting
        const metadataSource =
          (await invoke<string | null>("get_setting", {
            key: "metadata_source",
          }).catch(() => null)) ?? "anilist";

        let meta: SearchResult;

        if (metadataSource === "mal") {
          // MAL only — skip AniList entirely
          const malResults = await invoke<MalResult[]>("search_mal_multi", {
            title: entry.editedName,
          });

          if (malResults.length === 0) {
            throw new Error(`No MAL results found for '${entry.editedName}'`);
          }

          const malAsSearchResults: SearchResult[] = malResults.map((m) => ({
            anilist_id: m.mal_id,
            title: m.title,
            title_english: m.title_english,
            title_native: m.title_native,
            synopsis: m.synopsis,
            cover_url: m.cover_url,
            anilist_score: m.mal_score,
            episode_count: m.episode_count,
            genres: m.genres,
            status: m.status,
            format: m.format,
            season_year: m.season_year,
          }));

          const picked = await showPicker(malAsSearchResults, entry.editedName);
          meta = picked ?? malAsSearchResults[0];
        } else {
          // AniList or Both — fetch AniList first
          const searchResults = await invoke<SearchResult[]>(
            "search_anime_multi",
            {
              title: entry.editedName,
            },
          );

          if (searchResults.length === 0) {
            throw new Error(`No results found for '${entry.editedName}'`);
          }

          const picked = await showPicker(searchResults, entry.editedName);
          const anilistMeta = picked ?? searchResults[0];

          if (metadataSource === "anilist") {
            // AniList only — done
            meta = anilistMeta;
          } else {
            // Both — also fetch MAL and show field picker
            try {
              const malResults = await invoke<MalResult[]>("search_mal_multi", {
                title: entry.editedName,
              });

              if (malResults.length === 0) {
                console.warn(
                  "No MAL results for merged mode, using AniList only",
                );
                meta = anilistMeta;
              } else {
                meta = await showFieldPicker(
                  anilistMeta,
                  malResults[0],
                  entry.editedName,
                );
              }
            } catch (malErr) {
              console.warn(
                "MAL fetch failed, falling back to AniList:",
                malErr,
              );
              meta = anilistMeta;
            }
          }
        }

        console.log("SUCCESS: Got metadata:", meta.title);

        await new Promise((resolve) => setTimeout(resolve, 3000));

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

        cards.push({
          // ← cards not results
          id: savedId,
          name: meta.title,
          coverUrl: meta.cover_url,
          status: "plan_to_watch",
          episodesWatched: 0,
          episodeCount: meta.episode_count,
          genres: meta.genres,
          score: meta.anilist_score ?? undefined,
          synopsis: meta.synopsis ?? undefined, // ← null to undefined
          seasons: series.seasons,
        });
      } catch (err) {
        console.error("Metadata failed for:", entry.editedName, "Error:", err);
        const cleanedName = cleanTitleForSearch(series.name);
        cards.push({
          // ← cards not results
          name: cleanedName,
          coverUrl: null,
          status: "plan_to_watch",
          episodesWatched: 0,
          episodeCount: series.episode_files.length,
          genres: [],
          seasons: series.seasons,
        });
      }

      setLibrary([...cards]); // ← cards not results
      onSeriesCountChange(cards.length); // ← cards not results
    }

    setHasLibrary(true);
    setIsRescanning(false);

    await invoke("save_setting", {
      key: "library_folder",
      value: folderPath,
    });

    try {
      const freshSeries = await invoke<SeriesDto[]>("get_library");
      const freshCards = freshSeries.map(dtoToCardData);
      setLibrary(freshCards);
      onSeriesCountChange(freshCards.length);
    } catch (err) {
      console.error("Failed to reload library:", err);
    }

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
    if (!folderPath.trim() && folders.length === 0) return;
    setScanning(true);

    try {
      // Get all registered folders + current input path
      const registeredFolders = await invoke<string[]>("get_library_folders");

      // Combine — current input path + registered folders, deduplicated
      const allFolders = Array.from(
        new Set([
          ...(folderPath.trim() ? [folderPath.trim()] : []),
          ...registeredFolders,
        ]),
      );

      // Scan all folders
      let allDiscovered: DiscoveredSeries[] = [];
      for (const folder of allFolders) {
        try {
          const result = await invoke<DiscoveredSeries[]>("scan_anime_folder", {
            path: folder,
          });
          allDiscovered = [...allDiscovered, ...result];
        } catch (err) {
          console.warn(`Scan failed for folder ${folder}:`, err);
        }
      }

      if (allDiscovered.length === 0) {
        setScanning(false);
        return;
      }

      // Build scan entries from all discovered series
      const entries: ScanEntry[] = allDiscovered.map((s) => ({
        originalName: s.name,
        cleanedName: cleanTitleForSearch(s.name),
        editedName: cleanTitleForSearch(s.name),
        path: s.path,
        episodeCount: s.episode_files.length,
      }));

      setPendingScan(entries);
    } catch (err) {
      console.error("Scan failed:", err);
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
              placeholder="e.g. E:\Videos\Anime"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-body)",
              }}
              className="flex-1 border rounded-md px-4 py-2.5 text-sm
              outline-none transition-colors
              focus:border-[var(--border-strong)]
              placeholder:text-[var(--text-muted)]"
            />
            <button
              onClick={handleScan}
              disabled={scanning || fetchingMetadata}
              style={{
                background: "var(--accent)",
                fontFamily: "var(--font-body)",
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md
    text-[#050508] font-bold text-sm
    transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{
                  color: "var(--text-muted)",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color =
                    "var(--accent)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color =
                    "var(--text-muted)")
                }
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
                className="px-3 py-1 rounded-md text-[11px] font-bold
    border transition-all"
                style={{
                  borderColor:
                    activeGenre === null
                      ? "var(--border-strong)"
                      : "var(--border-subtle)",
                  color:
                    activeGenre === null
                      ? "var(--accent)"
                      : "var(--text-muted)",
                  background:
                    activeGenre === null ? "var(--accent-dim)" : "transparent",
                }}
              >
                All
              </button>
              {allGenres.map((genre) => (
                <button
                  key={genre}
                  onClick={() =>
                    setActiveGenre(activeGenre === genre ? null : genre)
                  }
                  className="px-3 py-1 rounded-md text-[11px] font-bold
      border transition-all"
                  style={{
                    borderColor:
                      activeGenre === genre
                        ? "var(--border-strong)"
                        : "var(--border-subtle)",
                    color:
                      activeGenre === genre
                        ? "var(--accent)"
                        : "var(--text-muted)",
                    background:
                      activeGenre === genre
                        ? "var(--accent-dim)"
                        : "transparent",
                  }}
                >
                  {genre}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Anime Grid — real cards + skeletons during fetch ── */}
      {(filtered.length > 0 || fetchingMetadata) && (
        <div
          className="grid"
          style={{
            gridTemplateColumns: GRID_COLS[gridLayout],
            gap:
              gridLayout === "compact"
                ? "8px"
                : gridLayout === "comfortable"
                  ? "16px"
                  : "24px",
            contain: "layout style",
          }}
        >
          {/* Real cards for completed series */}
          {filtered.map((anime, i) => (
            <AnimeCard
              key={anime.id ?? i}
              anime={anime}
              size={cardSize}
              onClick={() => onSelectAnime(anime)}
            />
          ))}

          {/* Skeleton slots for in-progress and pending series */}
          {fetchingMetadata &&
            Array.from({
              length: progress.total - progress.current,
            }).map((_, i) => (
              <SkeletonCard
                key={`skeleton-${i}`}
                variant={i === 0 ? "active" : "pending"}
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
      {pickerData && (
        <AniListPickerModal
          results={pickerData.results}
          searchedTitle={pickerData.searchedTitle}
          onConfirm={(result) => {
            pickerData.resolve(result);
            setPickerData(null);
          }}
          onSkip={() => {
            pickerData.resolve(pickerData.results[0]);
            setPickerData(null);
          }}
          onCancel={() => {
            pickerData.resolve(null);
            setPickerData(null);
          }}
        />
      )}
      {/* ── Metadata Field Picker Modal (AniList + MAL merged) ── */}
      {fieldPickerData && (
        <MetadataFieldPickerModal
          anilist={fieldPickerData.anilist}
          mal={fieldPickerData.mal}
          seriesTitle={fieldPickerData.seriesTitle}
          onConfirm={(merged) => {
            fieldPickerData.resolve(merged);
            setFieldPickerData(null);
          }}
          onCancel={() => {
            // On cancel fall back to AniList
            fieldPickerData.resolve(fieldPickerData.anilist);
            setFieldPickerData(null);
          }}
        />
      )}
    </div>
  );
}
