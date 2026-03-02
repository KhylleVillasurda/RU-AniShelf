import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { History, Play, Loader2, Clock, Tv } from "lucide-react";

interface WatchEvent {
  series_name: string;
  series_path: string;
  cover_url: string | null;
  episode_name: string;
  episode_path: string;
  episode_number: number;
  season_name: string;
  watched_at: string;
}

// Formats ISO timestamp into a readable relative time
// e.g. "2 hours ago", "Yesterday", "3 days ago"
function timeAgo(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return then.toLocaleDateString();
}

function cleanName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function HistoryPage() {
  const [history, setHistory] = useState<WatchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingFile, setOpeningFile] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    try {
      const events = await invoke<WatchEvent[]>("get_history", { limit: 50 });
      setHistory(events);
    } catch (err) {
      setError(`Failed to load history: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleReplay(filePath: string, fileName: string) {
    setOpeningFile(fileName);
    try {
      await invoke("open_episode", { filePath });
    } catch (err) {
      setError(`Could not open file: ${err}`);
    } finally {
      setOpeningFile(null);
    }
  }

  // Group history events by date for a cleaner timeline view
  const grouped = history.reduce<Record<string, WatchEvent[]>>((acc, event) => {
    const date = new Date(event.watched_at).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3">
        <Loader2 size={18} className="animate-spin text-[#00d4ff]" />
        <span className="text-[#445566] text-sm">Loading history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#ff4466] text-sm">{error}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <History size={40} className="text-[#445566]" />
        <p className="text-[#445566] text-sm">No watch history yet</p>
        <p className="text-[#445566] text-xs">
          Play an episode to start tracking your history
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <p className="text-[#445566] text-xs">
          {history.length} episodes watched
        </p>
        <button
          onClick={loadHistory}
          className="text-xs text-[#445566] hover:text-[#00d4ff] transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* ── Timeline grouped by date ── */}
      {Object.entries(grouped).map(([date, events]) => (
        <div key={date} className="flex flex-col gap-2">
          {/* Date header */}
          <div className="flex items-center gap-3">
            <span
              className="text-[11px] font-bold tracking-[0.15em]
              uppercase text-[#445566]"
            >
              {date}
            </span>
            <div className="flex-1 h-px bg-[#00d4ff]/08" />
            <span className="text-[10px] text-[#445566]">
              {events.length} episode{events.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Events for this date */}
          {events.map((event, i) => {
            const isOpening = openingFile === event.episode_path;
            return (
              <div
                key={i}
                className="flex items-center gap-4 p-3 rounded-lg
                  bg-[#0e0e1a] border border-[#00d4ff]/10
                  hover:border-[#00d4ff]/25 transition-all group"
              >
                {/* Cover thumbnail */}
                <div
                  className="w-10 h-14 rounded flex-shrink-0 overflow-hidden
                  bg-[#13131f] border border-[#00d4ff]/10"
                >
                  {event.cover_url ? (
                    <img
                      src={event.cover_url}
                      alt={event.series_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center
                      justify-center"
                    >
                      <Tv size={14} className="text-[#445566]" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-sm font-bold text-[#f0f4ff] truncate">
                    {event.series_name}
                  </span>
                  <span className="text-xs text-[#8899bb] truncate">
                    {event.season_name} · Ep {event.episode_number}
                    {event.episode_name !== event.episode_path && (
                      <> · {cleanName(event.episode_name)}</>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock size={10} className="text-[#445566]" />
                    <span className="text-[10px] text-[#445566]">
                      {timeAgo(event.watched_at)}
                    </span>
                  </div>
                </div>

                {/* Replay button */}
                <button
                  onClick={() =>
                    handleReplay(event.episode_path, event.episode_path)
                  }
                  disabled={!!openingFile}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md
                    border border-[#00d4ff]/10 text-[#445566] text-xs
                    hover:border-[#00d4ff]/40 hover:text-[#00d4ff]
                    hover:bg-[#00d4ff]/07 transition-all
                    disabled:opacity-40 disabled:cursor-not-allowed
                    opacity-0 group-hover:opacity-100"
                >
                  {isOpening ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Play size={10} />
                  )}
                  Play
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
