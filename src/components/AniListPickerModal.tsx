import { useState } from "react";
import { Search, Check, Star, Tv, Calendar } from "lucide-react";

interface SearchResult {
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
  format: string | null;
  season_year: number | null;
}

interface AniListPickerModalProps {
  results: SearchResult[];
  searchedTitle: string;
  onConfirm: (result: SearchResult) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export type { SearchResult };

export default function AniListPickerModal({
  results,
  searchedTitle,
  onConfirm,
  onSkip,
  onCancel,
}: AniListPickerModalProps) {
  const [selected, setSelected] = useState<number>(results[0]?.anilist_id ?? 0);

  const selectedResult = results.find((r) => r.anilist_id === selected);

  function formatStatus(status: string | null): string {
    if (!status) return "Unknown";
    return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
      bg-black/75 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl
          border shadow-2xl"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-default)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex-shrink-0 border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-center gap-3 mb-1">
            <Search size={16} style={{ color: "var(--accent)" }} />
            <h2
              className="text-base font-black"
              style={{ color: "var(--text-primary)" }}
            >
              Select a Match
            </h2>
          </div>
          <p
            className="text-[11px] pl-7"
            style={{ color: "var(--text-muted)" }}
          >
            Showing results for{" "}
            <span
              className="font-bold"
              style={{ color: "var(--text-secondary)" }}
            >
              "{searchedTitle}"
            </span>{" "}
            — pick the best match, first result is pre-selected.
          </p>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 flex flex-col gap-2">
          {results.map((result) => {
            const isSelected = selected === result.anilist_id;
            return (
              <button
                key={result.anilist_id}
                onClick={() => setSelected(result.anilist_id)}
                className="w-full flex items-start gap-3 p-3 rounded-lg
                  border text-left transition-all"
                style={{
                  borderColor: isSelected
                    ? "var(--border-strong)"
                    : "var(--border-subtle)",
                  background: isSelected
                    ? "var(--accent-dim)"
                    : "var(--bg-elevated)",
                }}
              >
                {/* Cover thumbnail */}
                <div
                  className="w-12 h-16 rounded flex-shrink-0 overflow-hidden"
                  style={{ background: "var(--bg-card)" }}
                >
                  {result.cover_url ? (
                    <img
                      src={result.cover_url}
                      alt={result.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center
                      justify-center text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No img
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div
                        className="text-sm font-black truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {result.title}
                      </div>
                      {result.title_english &&
                        result.title_english !== result.title && (
                          <div
                            className="text-[11px] truncate"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {result.title_english}
                          </div>
                        )}
                    </div>

                    {/* Selected checkmark */}
                    {isSelected && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center
                          justify-center flex-shrink-0"
                        style={{
                          background: "var(--accent)",
                          color: "#050508",
                        }}
                      >
                        <Check size={11} />
                      </div>
                    )}
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {result.format && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5
                          rounded border"
                        style={{
                          color: "var(--accent)",
                          borderColor: "var(--border-default)",
                          background: "var(--accent-dim)",
                        }}
                      >
                        {result.format}
                      </span>
                    )}

                    {result.season_year && (
                      <span
                        className="flex items-center gap-1 text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Calendar size={9} />
                        {result.season_year}
                      </span>
                    )}

                    {result.episode_count && (
                      <span
                        className="flex items-center gap-1 text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Tv size={9} />
                        {result.episode_count} eps
                      </span>
                    )}

                    {result.anilist_score && (
                      <span
                        className="flex items-center gap-1 text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <Star size={9} />
                        {result.anilist_score}
                      </span>
                    )}

                    {result.status && (
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {formatStatus(result.status)}
                      </span>
                    )}
                  </div>

                  {/* Genres */}
                  {result.genres.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {result.genres.slice(0, 4).map((g) => (
                        <span
                          key={g}
                          className="text-[9px] px-1.5 py-0.5 rounded"
                          style={{
                            color: "var(--text-secondary)",
                            background: "var(--bg-card)",
                          }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex-shrink-0 border-t
            flex items-center justify-between"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <button
            onClick={onSkip}
            className="text-xs transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            Skip
          </button>

          <div className="flex gap-3">
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
            <button
              onClick={() => selectedResult && onConfirm(selectedResult)}
              disabled={!selectedResult}
              className="flex items-center gap-2 px-5 py-2 rounded-md
                text-sm font-bold transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "var(--accent)",
                color: "#050508",
              }}
            >
              <Check size={13} />
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
