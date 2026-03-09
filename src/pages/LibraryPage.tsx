// =============================================================================
// LibraryPage.tsx
//
// SECTIONS (in order):
//   1. Imports
//   2. Types & Interfaces
//   3. Constants
//   4. Utility Functions     — cleanTitleForSearch, localCoverUrl, dtoToCardData
//   5. Component             — LibraryPage
//      5a. State
//      5b. Effects & Loaders
//      5c. Modal Helpers     — showPicker, showFieldPicker
//      5d. Derived Data      — allGenres, filtered
//      5e. Scan Handlers     — handleScan, handleRescan, handleConfirmAndFetch
//      5f. Render
// =============================================================================

// ─── 1. Imports ──────────────────────────────────────────────────────────────

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

// Kitsu result shape returned by the search_kitsu_multi Tauri command
interface KitsuResult {
  kitsu_id: number;
  title: string;
  title_english: string | null;
  title_native: string | null;
  synopsis: string | null;
  episode_count: number | null;
  kitsu_score: number | null;
  cover_url: string | null;
  genres: string[];
  status: string | null;
  format: string | null;
  season_year: number | null;
}

// ─── 2. Types & Interfaces ───────────────────────────────────────────────────

type GridLayout = "compact" | "comfortable" | "cozy";
type SortOption = "title_asc" | "title_desc" | "score_desc" | "episodes_desc";
type StatusFilter =
  | "all"
  | "watching"
  | "completed"
  | "on_hold"
  | "plan_to_watch";

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

interface LibraryPageProps {
  searchQuery: string;
  onSeriesCountChange: (count: number) => void;
  statusFilter?: StatusFilter;
  onSelectAnime: (anime: AnimeCardData) => void;
  statusUpdates: Record<number, AnimeCardData["status"]>;
  /**
   * Increment this number from the parent whenever SeriesDetailPage saves
   * metadata. LibraryPage will reload from DB and refresh the affected card.
   *
   * In App.tsx:
   *   const [libraryReloadTrigger, setLibraryReloadTrigger] = useState(0);
   *   <LibraryPage reloadTrigger={libraryReloadTrigger} ... />
   *   <SeriesDetailPage
   *     onMetadataUpdate={() => setLibraryReloadTrigger((n) => n + 1)}
   *     ...
   *   />
   */
  reloadTrigger?: number;
}

// ─── 3. Constants ─────────────────────────────────────────────────────────────

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

// ─── 4. Utility Functions ─────────────────────────────────────────────────────

/**
 * Strips torrent-style tags from a folder name before sending to AniList/MAL.
 * Removes: sub groups, resolution tags, codec info, release group suffixes,
 * episode ranges, batch markers, and stray punctuation.
 *
 * e.g. "[SubGroup] My Anime S01 (1080p HEVC)" → "My Anime"
 */
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

  return raw
    .replace(/\b(FLAC|DD|DDP|AC3|DTS)\d*\.\d+\b/gi, "")
    .replace(/\b\d{1,4}[-–]\d{1,4}\b/g, "") // episode ranges: 1-12, 001-131
    .replace(/\b\d{1,4}\s*[~～]\s*\d{1,4}\b/g, "") // tilde ranges: 1 ~ 12
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
    .replace(/\b[A-Z]{2,4}\b/g, (match) =>
      protectedAbbreviations.has(match) ? match : "",
    )
    .replace(/\b\d{3,}\b/g, "")
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\s[-_]\s/g, " ")
    .replace(/^[-_]|[-_]$/g, " ")
    .replace(/[\s.]+$/, "")
    .replace(/^[\s.]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converts a local file path to a Tauri asset URL so React can
 * display locally cached cover art via the asset protocol.
 */
function localCoverUrl(path: string | null): string | null {
  if (!path) return null;
  try {
    return convertFileSrc(path);
  } catch {
    return null;
  }
}

/**
 * Maps a SeriesDto (from SQLite via Tauri) into an AnimeCardData shape
 * for the UI. Groups the flat episode list back into per-season buckets.
 */
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

  // Sort seasons naturally (Season 1, Season 2, ...)
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
    seasons,
  };
}

// ─── 5. Component ─────────────────────────────────────────────────────────────

export default function LibraryPage({
  searchQuery,
  onSeriesCountChange,
  statusFilter = "all",
  onSelectAnime,
  statusUpdates,
  reloadTrigger,
}: LibraryPageProps) {
  // ── 5a. State ──────────────────────────────────────────────────────────────

  const [folderPath, setFolderPath] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [library, setLibrary] = useState<AnimeCardData[]>([]);
  const [hasLibrary, setHasLibrary] = useState(false);

  // Scan / fetch progress
  const [scanning, setScanning] = useState(false);
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [pendingScan, setPendingScan] = useState<ScanEntry[] | null>(null);
  const [error] = useState("");

  // Display preferences
  const [sortBy, setSortBy] = useState<SortOption>("title_asc");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [cardSize, setCardSize] = useState<CardSize>("medium");
  const [gridLayout, setGridLayout] = useState<GridLayout>("comfortable");

  // Modal state — both modals are promise-driven (see § 5c Modal Helpers)
  const [pickerData, setPickerData] = useState<{
    results: SearchResult[];
    searchedTitle: string;
    resolve: (result: SearchResult | null) => void;
  } | null>(null);

  const [fieldPickerData, setFieldPickerData] = useState<{
    anilist: SearchResult;
    mal: MalResult;
    seriesTitle: string;
    resolve: (result: SearchResult) => void;
  } | null>(null);

  // ── 5b. Effects & Loaders ─────────────────────────────────────────────────

  // On mount: restore library, saved folder path, and display preferences
  useEffect(() => {
    loadLibraryFromDb();
    loadSavedFolder();
    loadDisplaySettings();
  }, []);

  // On mount: load registered library folders from DB
  useEffect(() => {
    invoke<string[]>("get_library_folders")
      .then(setFolders)
      .catch(console.error);
  }, []);

  // Pre-fill folder input from the first registered folder if still empty
  useEffect(() => {
    if (folders.length > 0 && !folderPath) {
      setFolderPath(folders[0]);
    }
  }, [folders]);

  // Reload library from DB when the parent signals a metadata update
  // (e.g. after SeriesDetailPage saves new metadata — picks up the new local cover path)
  useEffect(() => {
    if (reloadTrigger && reloadTrigger > 0) {
      // Load fresh data and stamp a cache-bust on every card's cover so the
      // browser doesn't serve stale images from its cache
      invoke<SeriesDto[]>("get_library")
        .then((series) => {
          const bust = Date.now();
          const cards = series.map((dto) => ({
            ...dtoToCardData(dto),
            coverCacheBust: bust,
          }));
          setLibrary(cards);
          onSeriesCountChange(cards.length);
          if (cards.length > 0) setHasLibrary(true);
        })
        .catch(console.error);
    }
  }, [reloadTrigger]);

  /** Loads all series from SQLite and populates the library grid. */
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

  /** Restores the last-used folder path from settings. */
  async function loadSavedFolder() {
    try {
      const saved = await invoke<string | null>("get_setting", {
        key: "library_folder",
      });
      if (saved && saved.trim()) setFolderPath(saved);
    } catch {
      // silently ignore — defaults are fine
    }
  }

  /** Restores card size and grid layout preferences from settings. */
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

  // ── 5c. Modal Helpers ─────────────────────────────────────────────────────
  //
  // Both pickers are shown imperatively mid-scan via a Promise pattern:
  //   const result = await showPicker(results, title);
  // The modal resolves the promise when the user confirms/cancels.

  /**
   * Shows the AniList/MAL result picker and waits for the user's choice.
   * Returns null if the user cancels (caller should fall back to first result).
   */
  function showPicker(
    results: SearchResult[],
    searchedTitle: string,
  ): Promise<SearchResult | null> {
    return new Promise((resolve) => {
      setPickerData({ results, searchedTitle, resolve });
    });
  }

  /**
   * Shows the field-level merge picker (AniList vs MAL per field) and
   * waits for the user to confirm their merged selection.
   */
  function showFieldPicker(
    anilist: SearchResult,
    mal: MalResult,
    seriesTitle: string,
  ): Promise<SearchResult> {
    return new Promise((resolve) => {
      setFieldPickerData({ anilist, mal, seriesTitle, resolve });
    });
  }

  // ── 5d. Derived Data ──────────────────────────────────────────────────────

  /** All unique genres across the loaded library, sorted alphabetically. */
  const allGenres = useMemo(() => {
    const genreSet = new Set<string>();
    library.forEach((anime) => anime.genres.forEach((g) => genreSet.add(g)));
    return Array.from(genreSet).sort();
  }, [library]);

  /**
   * Library after applying search query, status filter, genre filter,
   * and sort — also merges any in-session status overrides.
   */
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

  // ── 5e. Scan Handlers ─────────────────────────────────────────────────────

  /**
   * Initial scan — discovers series from all registered folders,
   * then opens the ScanConfirmModal for the user to review titles
   * before metadata is fetched.
   */
  async function handleScan() {
    if (!folderPath.trim() && folders.length === 0) return;
    setScanning(true);

    try {
      const registeredFolders = await invoke<string[]>("get_library_folders");

      // Combine current input path + registered folders, deduplicated
      const allFolders = Array.from(
        new Set([
          ...(folderPath.trim() ? [folderPath.trim()] : []),
          ...registeredFolders,
        ]),
      );

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

      // Build scan entries — cleaned names are editable before fetch
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

  /**
   * Rescan — clears the current library state then re-runs handleScan.
   * Sets isRescanning = true so cover art is force-refreshed even if
   * the cached file already exists on disk.
   */
  async function handleRescan() {
    setIsRescanning(true);
    setHasLibrary(false);
    setLibrary([]);
    setActiveGenre(null);
    onSeriesCountChange(0);

    await new Promise((resolve) => setTimeout(resolve, 50)); // let UI clear
    await handleScan();
  }

  /**
   * Called after the user confirms titles in ScanConfirmModal.
   * Fetches metadata from AniList/MAL (according to the saved
   * metadata_source setting), shows pickers as needed, saves each
   * series to SQLite, and refreshes the library grid when done.
   *
   * Metadata source behaviour:
   *   "anilist" — AniList only, shows result picker
   *   "mal"     — MAL only, shows result picker
   *   "kitsu"   — Kitsu only, shows result picker (no API key required)
   *   "both"    — AniList picker first, then MAL field-merge picker
   */
  async function handleConfirmAndFetch(confirmedEntries: ScanEntry[]) {
    setPendingScan(null);
    setFetchingMetadata(true);
    setProgress({ current: 0, total: confirmedEntries.length });

    // Re-scan folders to get fresh episode file lists
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

    const cards: AnimeCardData[] = [];

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
        const metadataSource =
          (await invoke<string | null>("get_setting", {
            key: "metadata_source",
          }).catch(() => null)) ?? "anilist";

        let meta: SearchResult;

        if (metadataSource === "mal") {
          // ── MAL only ───────────────────────────────────────────────────────
          const malResults = await invoke<MalResult[]>("search_mal_multi", {
            title: entry.editedName,
          });

          if (malResults.length === 0) {
            throw new Error(`No MAL results found for '${entry.editedName}'`);
          }

          // Use negative mal_id as a unique picker key — zeroed to null at save
          // (anilist_id > 0 guard in the save call below handles this)
          const malAsSearchResults: SearchResult[] = malResults.map((m) => ({
            anilist_id: -m.mal_id,
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
        } else if (metadataSource === "kitsu") {
          // ── Kitsu only — no API key required ──────────────────────────────
          const kitsuResults = await invoke<KitsuResult[]>(
            "search_kitsu_multi",
            { title: entry.editedName },
          );

          if (kitsuResults.length === 0) {
            throw new Error(`No Kitsu results found for '${entry.editedName}'`);
          }

          // Negative kitsu_id sentinel — same pattern as MAL so the
          // anilist_id > 0 guard below keeps null stored in the DB
          const kitsuAsSearchResults: SearchResult[] = kitsuResults.map(
            (k) => ({
              anilist_id: -k.kitsu_id,
              title: k.title,
              title_english: k.title_english,
              title_native: k.title_native,
              synopsis: k.synopsis,
              cover_url: k.cover_url,
              anilist_score: k.kitsu_score,
              episode_count: k.episode_count,
              genres: k.genres,
              status: k.status,
              format: k.format,
              season_year: k.season_year,
            }),
          );

          const picked = await showPicker(
            kitsuAsSearchResults,
            entry.editedName,
          );
          meta = picked ?? kitsuAsSearchResults[0];
        } else {
          // ── AniList (or Both) ──────────────────────────────────────────────
          const searchResults = await invoke<SearchResult[]>(
            "search_anime_multi",
            { title: entry.editedName },
          );

          if (searchResults.length === 0) {
            throw new Error(`No results found for '${entry.editedName}'`);
          }

          const picked = await showPicker(searchResults, entry.editedName);
          const anilistMeta = picked ?? searchResults[0];

          if (metadataSource === "anilist") {
            meta = anilistMeta;
          } else {
            // ── Both: show field-level merge picker ────────────────────────
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

        // Flatten seasons → episode tuples for the save command
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
          // Negative sentinel (MAL-only) or 0 both map to null — no fake AniList IDs stored
          anilistId: meta.anilist_id > 0 ? meta.anilist_id : null,
          anilistScore: meta.anilist_score,
          genres: meta.genres,
          episodes: allEpisodes,
          forceRefresh: isRescanning, // true → re-download cover even if cached
        });

        cards.push({
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
        // On metadata failure: add a placeholder card so the series still appears
        console.error("Metadata failed for:", entry.editedName, "Error:", err);
        const cleanedName = cleanTitleForSearch(series.name);
        cards.push({
          name: cleanedName,
          coverUrl: null,
          status: "plan_to_watch",
          episodesWatched: 0,
          episodeCount: series.episode_files.length,
          genres: [],
          seasons: series.seasons,
        });
      }

      setLibrary([...cards]);
      onSeriesCountChange(cards.length);
    }

    // Finalise
    setHasLibrary(true);
    setIsRescanning(false);

    await invoke("save_setting", { key: "library_folder", value: folderPath });

    // Re-load from DB to get canonical data (covers resolved to local paths, etc.)
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

  // ── 5f. Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Scan Bar — only shown before any library is loaded */}
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

      {/* Progress Bar — shown while metadata is being fetched */}
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

      {/* Filter & Sort Bar — shown once library is loaded */}
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
                style={{ color: "var(--text-muted)" }}
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

          {/* Genre filter chips */}
          {allGenres.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveGenre(null)}
                className="px-3 py-1 rounded-md text-[11px] font-bold border transition-all"
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
                  className="px-3 py-1 rounded-md text-[11px] font-bold border transition-all"
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

      {/* Anime Grid — real cards + skeleton placeholders during fetch */}
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
          {filtered.map((anime, i) => (
            <AnimeCard
              key={anime.id ?? i}
              anime={anime}
              size={cardSize}
              onClick={() => onSelectAnime(anime)}
            />
          ))}

          {/* Skeleton slots for series still being fetched */}
          {fetchingMetadata &&
            Array.from({ length: progress.total - progress.current }).map(
              (_, i) => (
                <SkeletonCard
                  key={`skeleton-${i}`}
                  variant={i === 0 ? "active" : "pending"}
                />
              ),
            )}
        </div>
      )}

      {/* Empty state */}
      {hasLibrary && filtered.length === 0 && !fetchingMetadata && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <FolderOpen size={40} className="text-[#445566]" />
          <p className="text-[#445566] text-sm">No anime found</p>
        </div>
      )}

      {/* Scan Confirm Modal */}
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

      {/* AniList / MAL Result Picker Modal */}
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

      {/* AniList + MAL Field Merge Picker Modal */}
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
            // Cancel falls back to AniList data
            fieldPickerData.resolve(fieldPickerData.anilist);
            setFieldPickerData(null);
          }}
        />
      )}
    </div>
  );
}
