import { useState } from "react";
import { Check, X } from "lucide-react";
import { SearchResult } from "./AniListPickerModal";

interface MalResult {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_native: string | null;
  synopsis: string | null;
  episode_count: number | null;
  mal_score: number | null;
  cover_url: string | null;
  genres: string[];
  status: string | null;
  format: string | null;
  season_year: number | null;
}

export type { MalResult };

// Which source wins for each field
type FieldSource = "anilist" | "mal";

interface FieldChoice {
  title: FieldSource;
  synopsis: FieldSource;
  cover: FieldSource;
  score: FieldSource;
  episodes: FieldSource;
  genres: FieldSource;
}

interface MetadataFieldPickerModalProps {
  anilist: SearchResult;
  mal: MalResult;
  seriesTitle: string;
  onConfirm: (merged: SearchResult) => void;
  onCancel: () => void;
}

export default function MetadataFieldPickerModal({
  anilist,
  mal,
  seriesTitle,
  onConfirm,
  onCancel,
}: MetadataFieldPickerModalProps) {
  const [choices, setChoices] = useState<FieldChoice>({
    title: "anilist",
    synopsis: "anilist",
    cover: "anilist",
    score: "anilist",
    episodes: "anilist",
    genres: "anilist",
  });

  function setAll(source: FieldSource) {
    setChoices({
      title: source,
      synopsis: source,
      cover: source,
      score: source,
      episodes: source,
      genres: source,
    });
  }

  function handleConfirm() {
    // Build merged result from choices
    const merged: SearchResult = {
      anilist_id: anilist.anilist_id,
      title: choices.title === "anilist" ? anilist.title : mal.title,
      title_english:
        choices.title === "anilist" ? anilist.title_english : mal.title_english,
      title_native:
        choices.title === "anilist" ? anilist.title_native : mal.title_native,
      synopsis:
        choices.synopsis === "anilist" ? anilist.synopsis : mal.synopsis,
      cover_url:
        choices.cover === "anilist" ? anilist.cover_url : mal.cover_url,
      anilist_score:
        choices.score === "anilist" ? anilist.anilist_score : mal.mal_score,
      episode_count:
        choices.episodes === "anilist"
          ? anilist.episode_count
          : mal.episode_count,
      genres: choices.genres === "anilist" ? anilist.genres : mal.genres,
      status: anilist.status,
      format: anilist.format,
      season_year: anilist.season_year,
    };
    onConfirm(merged);
  }

  const rows: {
    key: keyof FieldChoice;
    label: string;
    anilistValue: string;
    malValue: string;
  }[] = [
    {
      key: "title",
      label: "Title",
      anilistValue: anilist.title,
      malValue: mal.title,
    },
    {
      key: "score",
      label: "Score",
      anilistValue: anilist.anilist_score
        ? `${anilist.anilist_score} / 10`
        : "N/A",
      malValue: mal.mal_score ? `${mal.mal_score} / 10` : "N/A",
    },
    {
      key: "episodes",
      label: "Episodes",
      anilistValue: anilist.episode_count?.toString() ?? "N/A",
      malValue: mal.episode_count?.toString() ?? "N/A",
    },
    {
      key: "synopsis",
      label: "Synopsis",
      anilistValue: anilist.synopsis
        ? anilist.synopsis.slice(0, 80) + "..."
        : "N/A",
      malValue: mal.synopsis ? mal.synopsis.slice(0, 80) + "..." : "N/A",
    },
    {
      key: "cover",
      label: "Cover Art",
      anilistValue: anilist.cover_url ? "AniList image" : "N/A",
      malValue: mal.cover_url ? "MAL image" : "N/A",
    },
    {
      key: "genres",
      label: "Genres",
      anilistValue: anilist.genres.slice(0, 3).join(", ") || "N/A",
      malValue: mal.genres.slice(0, 3).join(", ") || "N/A",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
      bg-black/75 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col
          rounded-xl border shadow-2xl"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-default)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex-shrink-0 border-b
            flex items-center justify-between"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div>
            <h2
              className="text-sm font-black"
              style={{ color: "var(--text-primary)" }}
            >
              Choose Metadata Fields
            </h2>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Pick the best data per field for{" "}
              <span style={{ color: "var(--text-secondary)" }}>
                {seriesTitle}
              </span>
            </p>
          </div>
          <button onClick={onCancel}>
            <X size={15} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* Column headers */}
        <div
          className="px-6 py-2 flex items-center gap-3 flex-shrink-0
            border-b text-[10px] font-black tracking-widest uppercase"
          style={{
            borderColor: "var(--border-subtle)",
            color: "var(--text-muted)",
          }}
        >
          <div className="w-20 flex-shrink-0">Field</div>
          <div className="flex-1 text-center">AniList</div>
          <div className="flex-1 text-center">MyAnimeList</div>
        </div>

        {/* Field rows */}
        <div className="flex-1 overflow-y-auto px-6 py-3 flex flex-col gap-2">
          {rows.map((row) => {
            const isAnilist = choices[row.key] === "anilist";
            const isMal = choices[row.key] === "mal";
            return (
              <div key={row.key} className="flex items-center gap-3">
                {/* Field label */}
                <div
                  className="w-20 flex-shrink-0 text-[11px] font-bold"
                  style={{ color: "var(--text-muted)" }}
                >
                  {row.label}
                </div>

                {/* AniList option */}
                <button
                  onClick={() =>
                    setChoices((prev) => ({ ...prev, [row.key]: "anilist" }))
                  }
                  className="flex-1 flex items-center gap-2 px-3 py-2
                    rounded-md border text-left transition-all text-[11px]"
                  style={{
                    borderColor: isAnilist
                      ? "var(--border-strong)"
                      : "var(--border-subtle)",
                    background: isAnilist
                      ? "var(--accent-dim)"
                      : "var(--bg-elevated)",
                    color: isAnilist
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                  }}
                >
                  {isAnilist && (
                    <Check
                      size={11}
                      className="flex-shrink-0"
                      style={{ color: "var(--accent)" }}
                    />
                  )}
                  <span className="truncate">{row.anilistValue}</span>
                </button>

                {/* MAL option */}
                <button
                  onClick={() =>
                    setChoices((prev) => ({ ...prev, [row.key]: "mal" }))
                  }
                  className="flex-1 flex items-center gap-2 px-3 py-2
                    rounded-md border text-left transition-all text-[11px]"
                  style={{
                    borderColor: isMal
                      ? "var(--border-strong)"
                      : "var(--border-subtle)",
                    background: isMal
                      ? "var(--accent-dim)"
                      : "var(--bg-elevated)",
                    color: isMal ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  {isMal && (
                    <Check
                      size={11}
                      className="flex-shrink-0"
                      style={{ color: "var(--accent)" }}
                    />
                  )}
                  <span className="truncate">{row.malValue}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex-shrink-0 border-t
            flex items-center justify-between"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {/* Use all buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setAll("anilist")}
              className="px-3 py-1.5 rounded-md border text-[11px]
                font-bold transition-all"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--text-muted)",
              }}
            >
              All AniList
            </button>
            <button
              onClick={() => setAll("mal")}
              className="px-3 py-1.5 rounded-md border text-[11px]
                font-bold transition-all"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--text-muted)",
              }}
            >
              All MAL
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-md border text-sm"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 px-5 py-2 rounded-md
                text-sm font-bold"
              style={{
                background: "var(--accent)",
                color: "#050508",
              }}
            >
              <Check size={13} />
              Use These Fields
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
