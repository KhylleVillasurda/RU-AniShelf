import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AnimeCardData, EpisodeFileData } from "../components/AnimeCard";
import { SearchResult } from "../components/AniListPickerModal";
import MetadataEditModal from "../components/MetadataEditModal";
import {
  ArrowLeft,
  Play,
  CheckCircle,
  PauseCircle,
  BookmarkPlus,
  Star,
  Tv,
  ChevronDown,
  ChevronUp,
  FileVideo,
  Loader2,
  Pencil,
} from "lucide-react";

interface SeriesDetailPageProps {
  anime: AnimeCardData;
  onBack: () => void;
  onStatusUpdate?: (id: number, status: AnimeCardData["status"]) => void;
}

interface StatusDropdownProps {
  currentStatus: AnimeCardData["status"];
  onStatusChange: (status: AnimeCardData["status"]) => void;
  disabled: boolean;
}

const STATUS_CONFIG = {
  watching: {
    label: "Watching",
    color: "#00d4ff",
    bg: "rgba(0,212,255,0.15)",
    border: "rgba(0,212,255,0.3)",
    icon: <Play size={11} />,
  },
  completed: {
    label: "Completed",
    color: "#00ff9d",
    bg: "rgba(0,255,157,0.15)",
    border: "rgba(0,255,157,0.3)",
    icon: <CheckCircle size={11} />,
  },
  on_hold: {
    label: "On Hold",
    color: "#ffaa00",
    bg: "rgba(255,170,0,0.15)",
    border: "rgba(255,170,0,0.3)",
    icon: <PauseCircle size={11} />,
  },
  plan_to_watch: {
    label: "Plan to Watch",
    color: "#667799",
    bg: "rgba(100,120,150,0.15)",
    border: "rgba(100,120,150,0.3)",
    icon: <BookmarkPlus size={11} />,
  },
};

function StatusDropdown({
  currentStatus,
  onStatusChange,
  disabled,
}: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const config = STATUS_CONFIG[currentStatus];

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md
          border text-[11px] font-bold tracking-wide uppercase
          transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          color: config.color,
          background: config.bg,
          borderColor: config.border,
        }}
      >
        {config.icon}
        {config.label}
        <ChevronDown
          size={11}
          className={`transition-transform
          duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown menu */}
      {open && (
        <>
          {/* Click outside to close */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1 z-50
            bg-[#13131f] border border-[#00d4ff]/15 rounded-md
            overflow-hidden shadow-xl min-w-[160px]"
          >
            {(
              Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>
            ).map((statusKey) => {
              const opt = STATUS_CONFIG[statusKey];
              const isActive = currentStatus === statusKey;
              return (
                <button
                  key={statusKey}
                  onClick={() => {
                    onStatusChange(statusKey as AnimeCardData["status"]);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5
                      text-[11px] font-bold tracking-wide uppercase
                      transition-colors text-left"
                  style={{
                    color: isActive ? opt.color : "#667799",
                    background: isActive ? opt.bg : "transparent",
                  }}
                >
                  {opt.icon}
                  {opt.label}
                  {isActive && (
                    <span className="ml-auto">
                      <CheckCircle size={11} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function SeriesDetailPage({
  anime,
  onBack,
  onStatusUpdate,
}: SeriesDetailPageProps) {
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [currentAnime, setCurrentAnime] = useState(anime);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(
    // Expand the first season by default
    new Set(
      currentAnime.seasons?.[0]?.season_name
        ? [currentAnime.seasons[0].season_name]
        : [],
    ),
  );
  const [openingFile, setOpeningFile] = useState<string | null>(null);
  const [openError, setOpenError] = useState("");

  function handleMetadataSaved(result: SearchResult) {
    setCurrentAnime((prev) => ({
      ...prev,
      name: result.title,
      coverUrl: result.cover_url,
      synopsis: result.synopsis ?? undefined,
      episodeCount: result.episode_count,
      score: result.anilist_score ?? undefined,
      genres: result.genres,
    }));
    setEditingMetadata(false);
  }

  function toggleSeason(seasonName: string) {
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      next.has(seasonName) ? next.delete(seasonName) : next.add(seasonName);
      return next;
    });
  }

  const [currentStatus, setCurrentStatus] = useState(currentAnime.status);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function handleStatusChange(newStatus: AnimeCardData["status"]) {
    if (!currentAnime.id || newStatus === currentStatus) return;
    setUpdatingStatus(true);
    try {
      await invoke("update_series_status", {
        seriesId: currentAnime.id,
        status: newStatus,
      });
      setCurrentStatus(newStatus);
      onStatusUpdate?.(currentAnime.id, newStatus);
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handlePlayEpisode(
    filePath: string,
    fileName: string,
    episodeNumber: number,
    seasonName: string,
  ) {
    setOpeningFile(fileName);
    setOpenError("");
    try {
      // Open the file in external player
      await invoke("open_episode", { filePath });

      // Log to watch history
      await invoke("log_watch_event", {
        seriesName: currentAnime.name,
        seriesPath: currentAnime.seasons?.[0]?.path ?? "",
        coverUrl: currentAnime.coverUrl,
        episodeName: fileName,
        episodePath: filePath,
        episodeNumber,
        seasonName,
      });
    } catch (err) {
      setOpenError(`Could not open file: ${err}`);
    } finally {
      setOpeningFile(null);
    }
  }

  // Clean up episode filename for display
  // Removes common torrent cruft like [1080p], (HEVC), etc.
  function cleanEpisodeName(fileName: string): string {
    return fileName
      .replace(/\.[^.]+$/, "") // remove extension
      .replace(/\[.*?\]/g, "") // remove [tags]
      .replace(/\(.*?\)/g, "") // remove (tags)
      .replace(/\s+/g, " ") // collapse spaces
      .trim();
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* ── Back button ── */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[#8899bb] text-sm
          hover:text-[#00d4ff] transition-colors self-start"
      >
        <ArrowLeft size={15} />
        Back to Library
      </button>

      {/* ── Hero Section ── */}
      <div className="flex gap-6">
        {/* Cover art */}
        <div className="flex-shrink-0 w-[160px]">
          {currentAnime.coverUrl ? (
            <img
              src={currentAnime.coverUrl}
              alt={currentAnime.name}
              className="w-full rounded-lg border border-[#00d4ff]/15
                shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
            />
          ) : (
            <div
              className="w-full aspect-[2/3] rounded-lg bg-[#13131f]
              border border-[#00d4ff]/10 flex items-center justify-center"
            >
              <Tv size={32} className="text-[#445566]" />
            </div>
          )}
        </div>

        {/* Series info */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <div>
            <h1 className="text-2xl font-black text-[#f0f4ff] leading-tight mb-1">
              {currentAnime.name}
            </h1>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Score */}
            {currentAnime.score && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md
      bg-[#13131f] border border-[#1c1c30] text-[11px] text-[#8899bb]"
              >
                <Star size={11} className="text-[#ffaa00]" />
                <span>{currentAnime.score}</span>
                <span className="text-[#445566]">/ 10</span>
              </div>
            )}

            {/* Episode count */}
            {currentAnime.episodeCount && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md
      bg-[#13131f] border border-[#1c1c30] text-[11px] text-[#8899bb]"
              >
                <Tv size={11} />
                <span>{currentAnime.episodeCount}</span>
                <span className="text-[#445566]">episodes</span>
              </div>
            )}

            {/* Status dropdown */}
            <StatusDropdown
              currentStatus={currentStatus}
              onStatusChange={handleStatusChange}
              disabled={updatingStatus}
            />
          </div>

          {/* Genres */}
          {currentAnime.genres.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {currentAnime.genres.map((g, i) => (
                <span
                  key={i}
                  className="px-2.5 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    color: "var(--accent)",
                    background: "var(--accent-dim)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Synopsis */}
          {currentAnime.synopsis && (
            <p
              className="text-[#8899bb] text-sm leading-relaxed
              line-clamp-4"
            >
              {currentAnime.synopsis}
            </p>
          )}
        </div>
      </div>

      {/* Edit Metadata Button */}
      <div className="flex items-start gap-2">
        <h1
          className="text-2xl font-black leading-tight mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          {currentAnime.name}
        </h1>
        <button
          onClick={() => setEditingMetadata(true)}
          className="mt-1 flex-shrink-0 transition-colors"
          style={{ color: "var(--text-muted)" }}
          title="Edit metadata"
        >
          <Pencil size={14} />
        </button>
      </div>

      {/* ── Error message ── */}
      {openError && (
        <p
          className="text-[#ff4466] text-sm bg-[#ff4466]/10
          border border-[#ff4466]/20 rounded-md px-4 py-2"
        >
          {openError}
        </p>
      )}

      {/* ── Episodes Section ── */}
      <div className="flex flex-col gap-3">
        <h2
          className="text-xs font-bold tracking-[0.15em] uppercase
          text-[#445566]"
        >
          Episodes
        </h2>

        {currentAnime.seasons && currentAnime.seasons.length > 0 ? (
          currentAnime.seasons.map((season) => {
            const isExpanded = expandedSeasons.has(season.season_name);
            return (
              <div
                key={season.season_name}
                className="bg-[#0e0e1a] border border-[#00d4ff]/10 rounded-lg
                  overflow-hidden"
              >
                {/* Season header */}
                <button
                  onClick={() => toggleSeason(season.season_name)}
                  className="w-full flex items-center justify-between
                    px-4 py-3 hover:bg-[#1c1c30] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[#f0f4ff]">
                      {season.season_name}
                    </span>
                    <span className="text-xs text-[#445566]">
                      {season.episode_files.length} episodes
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={14} className="text-[#445566]" />
                  ) : (
                    <ChevronDown size={14} className="text-[#445566]" />
                  )}
                </button>

                {/* Episode list */}
                {isExpanded && (
                  <div className="border-t border-[#00d4ff]/10">
                    {season.episode_files.map(
                      (ep: EpisodeFileData, i: number) => {
                        const isOpening = openingFile === ep.file_name;
                        return (
                          <button
                            key={i}
                            onClick={() =>
                              handlePlayEpisode(
                                ep.file_path,
                                ep.file_name,
                                i + 1,
                                season.season_name,
                              )
                            }
                            disabled={!!openingFile}
                            className="w-full flex items-center gap-3 px-4 py-2.5
                            border-b border-[#00d4ff]/05 last:border-0
                            hover:bg-[#1c1c30] transition-colors
                            disabled:opacity-50 disabled:cursor-not-allowed
                            group text-left"
                          >
                            {/* Episode number */}
                            <span
                              className="text-xs text-[#445566] w-6
                            flex-shrink-0 text-right"
                            >
                              {i + 1}
                            </span>

                            {/* Play icon */}
                            <div
                              className="w-6 h-6 rounded-full flex items-center
                            justify-center bg-[#13131f] border border-[#00d4ff]/10
                            group-hover:border-[#00d4ff]/40
                            group-hover:bg-[#00d4ff]/10
                            transition-all flex-shrink-0"
                            >
                              {isOpening ? (
                                <Loader2
                                  size={10}
                                  className="animate-spin text-[#00d4ff]"
                                />
                              ) : (
                                <Play
                                  size={9}
                                  className="text-[#445566]
                                  group-hover:text-[#00d4ff] transition-colors
                                  ml-0.5"
                                />
                              )}
                            </div>

                            {/* Episode name */}
                            <div className="flex flex-col min-w-0 flex-1">
                              <span
                                className="text-xs text-[#8899bb]
                              group-hover:text-[#f0f4ff] transition-colors
                              truncate"
                              >
                                {cleanEpisodeName(ep.file_name)}
                              </span>
                              <span className="text-[10px] text-[#445566] truncate">
                                {ep.file_name}
                              </span>
                            </div>

                            {/* File icon */}
                            <FileVideo
                              size={12}
                              className="text-[#445566] flex-shrink-0"
                            />
                          </button>
                        );
                      },
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div
            className="flex items-center justify-center py-12
            text-[#445566] text-sm"
          >
            No episode files found
          </div>
        )}
      </div>
      {/* ── Metadata Edit Modal ── */}
      {editingMetadata && anime.id && (
        <MetadataEditModal
          seriesId={anime.id}
          currentTitle={currentAnime.name}
          onSaved={handleMetadataSaved}
          onCancel={() => setEditingMetadata(false)}
        />
      )}
    </div>
  );
}
