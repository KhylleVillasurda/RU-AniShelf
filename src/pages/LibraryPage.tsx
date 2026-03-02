import { useState, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import AnimeCard, { AnimeCardData } from "../components/AnimeCard";
import { FolderOpen, Loader2, ChevronDown } from "lucide-react";

interface EpisodeFile {
  file_name: string;
  file_path: string;
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

interface LibraryPageProps {
  searchQuery: string;
  onSeriesCountChange: (count: number) => void;
  statusFilter?: StatusFilter;
  onSelectAnime: (anime: AnimeCardData) => void;
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
}

const SORT_LABELS: Record<SortOption, string> = {
  title_asc: "Title A → Z",
  title_desc: "Title Z → A",
  score_desc: "Highest Score",
  episodes_desc: "Most Episodes",
};

export default function LibraryPage({
  searchQuery,
  onSeriesCountChange,
  statusFilter = "all",
  onSelectAnime,
}: LibraryPageProps) {
  const [folderPath, setFolderPath] = useState("");
  const [library, setLibrary] = useState<AnimeCardData[]>([]);
  const [scanning, setScanning] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [scanned, setScanned] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("title_asc");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    async function loadSavedFolder() {
      try {
        const saved = await invoke<string | null>("get_setting", {
          key: "library_folder",
        });
        if (saved && saved.trim()) {
          setFolderPath(saved);
        }
      } catch {
        // silently ignore — settings just won't be pre-filled
      }
    }
    loadSavedFolder();
  }, []);

  // Collect all unique genres across the library dynamically
  const allGenres = useMemo(() => {
    const genreSet = new Set<string>();
    library.forEach((anime) => anime.genres.forEach((g) => genreSet.add(g)));
    return Array.from(genreSet).sort();
  }, [library]);

  // Apply all filters and sorting in one place using useMemo
  // so it only recalculates when something actually changes
  const filtered = useMemo(() => {
    let result = [...library];

    // 1 — Search filter
    if (searchQuery.trim()) {
      result = result.filter((anime) =>
        anime.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // 2 — Status filter (from sidebar navigation)
    if (statusFilter !== "all") {
      result = result.filter((anime) => anime.status === statusFilter);
    }

    // 3 — Genre filter (from genre chips)
    if (activeGenre) {
      result = result.filter((anime) => anime.genres.includes(activeGenre));
    }

    // 4 — Sort
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
  }, [library, searchQuery, statusFilter, activeGenre, sortBy]);

  async function handleScanAndFetch() {
    if (!folderPath.trim()) {
      setError("Please enter your anime folder path");
      return;
    }

    setScanning(true);
    setError("");
    setLibrary([]);

    try {
      const discovered = await invoke<DiscoveredSeries[]>("scan_anime_folder", {
        path: folderPath,
      });

      if (discovered.length === 0) {
        setError("No anime found in that folder");
        setScanning(false);
        return;
      }

      setScanning(false);
      setFetchingMetadata(true);
      setProgress({ current: 0, total: discovered.length });

      const results: AnimeCardData[] = [];

      for (let i = 0; i < discovered.length; i++) {
        const series = discovered[i];
        setProgress({ current: i + 1, total: discovered.length });

        try {
          const meta = await invoke<SeriesMetadata>("fetch_metadata", {
            title: series.name,
          });

          results.push({
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
        } catch {
          results.push({
            name: series.name,
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

      setScanned(true);
    } catch (err) {
      setError(`Error: ${err}`);
    } finally {
      setScanning(false);
      setFetchingMetadata(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Scan Bar ── */}
      {!scanned && (
        <div className="flex flex-col gap-3">
          <p className="text-[#445566] text-sm">
            Point RU: AniShelf at your anime folder to get started.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScanAndFetch()}
              placeholder="e.g. E:\Folder\To\Anime"
              className="flex-1 bg-[#0e0e1a] border border-[#00d4ff]/15
                rounded-md px-4 py-2.5 text-sm text-[#f0f4ff]
                placeholder-[#445566] outline-none
                focus:border-[#00d4ff]/40 transition-colors"
            />
            <button
              onClick={handleScanAndFetch}
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
              Fetching metadata...
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
      {scanned && !fetchingMetadata && (
        <div className="flex flex-col gap-3">
          {/* Top row — result count + sort */}
          <div className="flex items-center justify-between">
            <p className="text-[#445566] text-xs">
              {filtered.length} series
              {searchQuery ? ` matching "${searchQuery}"` : ""}
              {statusFilter !== "all"
                ? ` · ${statusFilter.replace(/_/g, " ")}`
                : ""}
              {activeGenre ? ` · ${activeGenre}` : ""}
            </p>

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

          {/* Rescan button */}
          <button
            onClick={() => {
              setScanned(false);
              setLibrary([]);
              setFolderPath("");
              setActiveGenre(null);
              onSeriesCountChange(0);
            }}
            className="text-xs text-[#445566] hover:text-[#00d4ff]
              transition-colors self-start"
          >
            + Scan another folder
          </button>
        </div>
      )}

      {/* ── Anime Grid ── */}
      {filtered.length > 0 && (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
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
      {scanned && filtered.length === 0 && !fetchingMetadata && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <FolderOpen size={40} className="text-[#445566]" />
          <p className="text-[#445566] text-sm">No anime found</p>
        </div>
      )}
    </div>
  );
}
