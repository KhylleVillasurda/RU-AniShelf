import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Loader2, X, Pencil } from "lucide-react";
import AniListPickerModal, { SearchResult } from "./AniListPickerModal";
import { MalResult } from "./MetadataFieldPickerModal";

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

interface MetadataEditModalProps {
  seriesId: number;
  currentTitle: string;
  onSaved: (updated: SearchResult) => void;
  onCancel: () => void;
}

export default function MetadataEditModal({
  seriesId,
  currentTitle,
  onSaved,
  onCancel,
}: MetadataEditModalProps) {
  const [query, setQuery] = useState(currentTitle);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pickerResults, setPickerResults] = useState<SearchResult[] | null>(
    null,
  );

  // Read the metadata source setting so we search the right API
  const [metadataSource, setMetadataSource] = useState<string>("anilist");

  useEffect(() => {
    invoke<string | null>("get_setting", { key: "metadata_source" })
      .then((val) => setMetadataSource(val ?? "anilist"))
      .catch(() => setMetadataSource("anilist"));
  }, []);

  const isMal = metadataSource === "mal";
  const isKitsu = metadataSource === "kitsu";
  const sourceLabel = isMal ? "MyAnimeList" : isKitsu ? "Kitsu" : "AniList";

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError("");

    try {
      let results: SearchResult[];

      if (isMal) {
        // ── MAL mode — search MAL, map to SearchResult with negative sentinel IDs
        // Negative mal_id is used so the picker can uniquely key each row.
        // The save call below guards anilist_id > 0, so they become null in the DB.
        const malResults = await invoke<MalResult[]>("search_mal_multi", {
          title: query.trim(),
        });

        results = malResults.map((m) => ({
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
      } else if (isKitsu) {
        // ── Kitsu mode — no API key needed
        // Negative kitsu_id sentinel keeps the same anilist_id > 0 guard on save.
        const kitsuResults = await invoke<KitsuResult[]>("search_kitsu_multi", {
          title: query.trim(),
        });

        results = kitsuResults.map((k) => ({
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
        }));
      } else {
        // ── AniList mode (default)
        results = await invoke<SearchResult[]>("search_anime_multi", {
          title: query.trim(),
        });
      }

      if (results.length === 0) {
        setError(`No results found for "${query}"`);
        return;
      }

      if (results.length === 1) {
        await handleSave(results[0]);
      } else {
        setPickerResults(results);
      }
    } catch (err) {
      setError(`Search failed: ${err}`);
    } finally {
      setSearching(false);
    }
  }

  async function handleSave(result: SearchResult) {
    setSaving(true);
    setPickerResults(null);
    setError("");

    try {
      await invoke("update_series_metadata", {
        seriesId,
        title: result.title,
        titleEnglish: result.title_english,
        titleNative: result.title_native,
        coverRemoteUrl: result.cover_url,
        synopsis: result.synopsis,
        episodeCount: result.episode_count,
        // Guard: negative sentinels (MAL mode) and 0 must never reach the DB
        anilistId: result.anilist_id > 0 ? result.anilist_id : null,
        anilistScore: result.anilist_score,
        genres: result.genres,
      });
      onSaved(result);
    } catch (err) {
      setError(`Failed to save: ${err}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center
        justify-center bg-black/75 backdrop-blur-sm"
      >
        <div
          className="w-full max-w-md rounded-xl border shadow-2xl"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-default)",
          }}
        >
          {/* Header */}
          <div
            className="px-6 py-4 border-b flex items-center justify-between"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center gap-3">
              <Pencil size={15} style={{ color: "var(--accent)" }} />
              <div>
                <h2
                  className="text-sm font-black"
                  style={{ color: "var(--text-primary)" }}
                >
                  Edit Metadata
                </h2>
                <p
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {currentTitle}
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Search input */}
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-bold tracking-wide"
                style={{ color: "var(--text-secondary)" }}
              >
                Search {sourceLabel}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Enter anime title..."
                  className="flex-1 border rounded-md px-3 py-2
                    text-sm outline-none transition-colors"
                  style={{
                    background: "var(--bg-elevated)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-body)",
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || saving || !query.trim()}
                  className="flex items-center gap-2 px-4 py-2
                    rounded-md text-sm font-bold transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "var(--accent)",
                    color: "#050508",
                  }}
                >
                  {searching ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Search size={13} />
                  )}
                  {searching ? "Searching..." : "Search"}
                </button>
              </div>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {isMal
                  ? 'Try the Japanese title for better MAL results. e.g. "Azumanga Daioh" instead of "Azumanga Daiou"'
                  : isKitsu
                    ? 'Kitsu searches by canonical title. Try the romaji title if results are off. e.g. "Shingeki no Kyojin"'
                    : 'Try the Japanese title if the English one doesn\'t match. e.g. "Tate no Yuusha" instead of "Rising of the Shield Hero"'}
              </p>
              {/* Shown while the user has time to read — before they hit Search */}
              <p
                className="text-[10px] italic"
                style={{ color: "var(--text-muted)", opacity: 0.6 }}
              >
                Cover art and info may take a few seconds to update after
                saving.
              </p>
            </div>

            {/* Saving state */}
            {saving && (
              <div
                className="flex items-center gap-2 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                <Loader2
                  size={13}
                  className="animate-spin"
                  style={{ color: "var(--accent)" }}
                />
                Saving metadata and downloading cover art...
              </div>
            )}

            {/* Error */}
            {error && (
              <p
                className="text-sm text-[#ff4466] bg-[#ff4466]/10
                border border-[#ff4466]/20 rounded-md px-3 py-2"
              >
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div
            className="px-6 py-4 border-t flex justify-end"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-md border text-sm transition-all"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Result picker — shared for both AniList and MAL results */}
      {pickerResults && (
        <AniListPickerModal
          results={pickerResults}
          searchedTitle={query}
          onConfirm={(result) => handleSave(result)}
          onSkip={() => handleSave(pickerResults[0])}
          onCancel={() => setPickerResults(null)}
        />
      )}
    </>
  );
}
