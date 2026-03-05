import {
  Play,
  CheckCircle,
  PauseCircle,
  BookmarkPlus,
  ImageOff,
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
  synopsis?: string;
  seasons?: SeasonData[];
}

export interface SeasonData {
  season_name: string;
  path: string;
  episode_files: EpisodeFileData[];
}

export interface EpisodeFileData {
  file_name: string;
  file_path: string;
}

interface AnimeCardProps {
  anime: AnimeCardData;
  onClick?: () => void;
}

// Status config — color, label and icon for each status
const STATUS_CONFIG = {
  watching: {
    label: "Watching",
    color: "#00ffff",
    bg: "rgba(0,200,255,0.25)",
    border: "rgba(0,200,255,0.5)",
    icon: <Play size={8} className="fill-current" />,
  },
  completed: {
    label: "Completed",
    color: "#00ffaa",
    bg: "rgba(0,255,150,0.25)",
    border: "rgba(0,255,150,0.5)",
    icon: <CheckCircle size={8} />,
  },
  on_hold: {
    label: "On Hold",
    color: "#ffcc00",
    bg: "rgba(255,180,0,0.25)",
    border: "rgba(255,180,0,0.5)",
    icon: <PauseCircle size={8} />,
  },
  plan_to_watch: {
    label: "Plan to Watch",
    color: "#aabbdd",
    bg: "rgba(150,170,200,0.2)",
    border: "rgba(150,170,200,0.35)",
    icon: <BookmarkPlus size={8} />,
  },
};

export default function AnimeCard({ anime, onClick }: AnimeCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        contain: "layout style paint",
        background: "var(--bg-card)",
        borderColor: "var(--border-subtle)",
        fontFamily: "var(--font-body)",
      }}
      className="group relative flex flex-col rounded-md
        border overflow-hidden cursor-pointer
        transition-all duration-200
        hover:-translate-y-1"
    >
      {/* Cover art */}
      <div className="relative aspect-[2/3] overflow-hidden bg-[#0a0a0f]">
        {anime.coverUrl ? (
          <img
            src={anime.coverUrl}
            alt={anime.name}
            className="w-full h-full object-cover
              group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={24} style={{ color: "var(--text-muted)" }} />
          </div>
        )}
      </div>{" "}
      {/* ← ADD THIS LINE */}
      {/* Info */}
      <div className="p-2 flex flex-col gap-1">
        <h3
          className="text-xs font-bold leading-tight line-clamp-2"
          style={{ color: "var(--text-primary)" }}
        >
          {anime.name}
        </h3>

        <div className="flex items-center justify-between">
          <span
            className="text-[9px] font-black uppercase tracking-wide
              px-1.5 py-0.5 rounded"
            style={{
              color: STATUS_CONFIG[anime.status].color,
              background: STATUS_CONFIG[anime.status].bg,
            }}
          >
            {STATUS_CONFIG[anime.status].label}
          </span>
          {anime.genres[0] && (
            <span
              className="text-[9px] font-bold"
              style={{ color: "var(--accent)" }}
            >
              {anime.genres[0]}
            </span>
          )}
        </div>
        <span style={{ color: "var(--text-muted)" }} className="text-[10px]">
          {anime.episodesWatched} / {anime.episodeCount ?? "?"}
        </span>
      </div>
    </div>
  );
}
