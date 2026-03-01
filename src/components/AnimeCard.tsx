import {
  Play,
  CheckCircle,
  PauseCircle,
  BookmarkPlus,
  Clock,
} from "lucide-react";

export interface AnimeCardData {
  id?: number;
  name: string;
  coverUrl: string | null;
  status: "watching" | "completed" | "on_hold" | "plan_to_watch";
  episodesWatched: number;
  episodeCount: number | null;
  genres: string[];
  score?: number;
}

interface AnimeCardProps {
  anime: AnimeCardData;
  onClick?: () => void;
}

// Status config — color, label and icon for each status
const STATUS_CONFIG = {
  watching: {
    label: "Watching",
    color: "#00d4ff",
    bg: "rgba(0,212,255,0.15)",
    border: "rgba(0,212,255,0.3)",
    icon: <Play size={9} />,
  },
  completed: {
    label: "Completed",
    color: "#00ff9d",
    bg: "rgba(0,255,157,0.15)",
    border: "rgba(0,255,157,0.3)",
    icon: <CheckCircle size={9} />,
  },
  on_hold: {
    label: "On Hold",
    color: "#ffaa00",
    bg: "rgba(255,170,0,0.15)",
    border: "rgba(255,170,0,0.3)",
    icon: <PauseCircle size={9} />,
  },
  plan_to_watch: {
    label: "Plan to Watch",
    color: "#667799",
    bg: "rgba(100,120,150,0.15)",
    border: "rgba(100,120,150,0.3)",
    icon: <BookmarkPlus size={9} />,
  },
};

// Calculates progress percentage safely
function getProgress(watched: number, total: number | null): number {
  if (!total || total === 0) return 0;
  return Math.min(Math.round((watched / total) * 100), 100);
}

export default function AnimeCard({ anime, onClick }: AnimeCardProps) {
  const status = STATUS_CONFIG[anime.status];
  const progress = getProgress(anime.episodesWatched, anime.episodeCount);
  const primaryGenre = anime.genres[0] ?? null;

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col bg-[#16162a] rounded-md
        border border-[#00d4ff]/10 overflow-hidden cursor-pointer
        transition-all duration-200
        hover:-translate-y-1 hover:border-[#00d4ff]/30
        hover:shadow-[0_8px_30px_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,212,255,0.1)]"
    >
      {/* ── Poster ── */}
      <div className="relative w-full aspect-[2/3] overflow-hidden bg-[#0e0e1a]">
        {anime.coverUrl ? (
          <img
            src={anime.coverUrl}
            alt={anime.name}
            className="w-full h-full object-cover transition-transform
              duration-300 group-hover:scale-105"
          />
        ) : (
          // Fallback when no cover art available
          <div
            className="w-full h-full flex flex-col items-center
            justify-center gap-2 bg-gradient-to-br from-[#0e0e1a] to-[#16162a]"
          >
            <Clock size={28} className="text-[#445566]" />
            <span className="text-[#445566] text-[10px] text-center px-2">
              No Cover Art
            </span>
          </div>
        )}

        {/* Status badge */}
        <div
          className="absolute top-2 left-2 flex items-center gap-1
            px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide
            uppercase border"
          style={{
            color: status.color,
            background: status.bg,
            borderColor: status.border,
          }}
        >
          {status.icon}
          {status.label}
        </div>

        {/* Progress bar at bottom of poster */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/40">
          <div
            className="h-full bg-gradient-to-r from-[#0099cc] to-[#00d4ff]
              transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ── Card Info ── */}
      <div className="p-2.5 flex flex-col gap-1">
        {/* Title */}
        <div className="text-[11px] font-bold text-[#f0f4ff] truncate leading-tight">
          {anime.name}
        </div>

        {/* Episode count + genre */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#445566]">
            {anime.episodesWatched}
            {anime.episodeCount ? ` / ${anime.episodeCount}` : ""}
          </span>
          {primaryGenre && (
            <span className="text-[9px] text-[#0099cc] font-bold tracking-wide">
              {primaryGenre}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
