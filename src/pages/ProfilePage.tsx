import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTheme } from "../contexts/ThemeContext";
import {
  User,
  Settings,
  Loader2,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Heart,
  BookOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
// These mirror the Rust KitsuProfile struct returned by fetch_kitsu_profile.

interface KitsuGenreEntry {
  genre: string;
  count: number;
}

interface KitsuAnimeStats {
  time_spent_seconds: number;
  completed: number;
  genre_breakdown: KitsuGenreEntry[];
}

interface KitsuMangaStats {
  chapters_read: number;
  completed: number;
  genre_breakdown: KitsuGenreEntry[];
}

interface KitsuProfile {
  id: string;
  name: string;
  slug: string;
  about: string | null;
  location: string | null;
  gender: string | null;
  birthday: string | null;
  created_at: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  waifu_or_husbando: string | null;
  waifu_name: string | null;
  waifu_image_url: string | null;
  anime_stats: KitsuAnimeStats | null;
  manga_stats: KitsuMangaStats | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function secondsToDays(seconds: number): string {
  const days = seconds / 86400;
  return days >= 1
    ? `${days.toFixed(1)} days`
    : `${Math.round(seconds / 3600)} hrs`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Genre chart colours — cycling palette
const GENRE_COLORS = [
  "#ff6b9d",
  "#c77dff",
  "#4cc9f0",
  "#f77f00",
  "#06d6a0",
  "#ff4d6d",
  "#7b2fff",
  "#00b4d8",
  "#ffba08",
  "#52b788",
  "#ff9f1c",
  "#a663cc",
  "#48cae4",
  "#e76f51",
  "#2ec4b6",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 px-5 py-3 rounded-xl border flex-1"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div style={{ color: "var(--accent)" }}>{icon}</div>
      <span
        className="text-base font-black"
        style={{
          color: "var(--text-primary)",
          fontFamily: "var(--font-display)",
        }}
      >
        {value}
      </span>
      <span
        className="text-[10px] uppercase tracking-widest"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span
        className="text-[10px] uppercase tracking-widest w-20 flex-shrink-0 pt-0.5"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {value}
      </span>
    </div>
  );
}

function GenreBar({
  genre,
  count,
  max,
  color,
}: {
  genre: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[11px] w-28 flex-shrink-0 truncate"
        style={{ color: "var(--text-secondary)" }}
      >
        {genre}
      </span>
      <div
        className="flex-1 h-1.5 rounded-full"
        style={{ background: "var(--bg-surface)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span
        className="text-[10px] w-6 text-right flex-shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        {Math.round(count)}
      </span>
    </div>
  );
}

function DonutChart({
  genres,
  size = 120,
}: {
  genres: KitsuGenreEntry[];
  size?: number;
}) {
  const top = genres.slice(0, 10);
  const total = top.reduce((s, g) => s + g.count, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const innerR = size * 0.24;
  const strokeW = r - innerR;

  // Build arc paths
  let cumAngle = -Math.PI / 2;
  const arcs = top.map((g, i) => {
    const slice = (g.count / total) * 2 * Math.PI;
    const startAngle = cumAngle;
    cumAngle += slice;
    const endAngle = cumAngle;

    const midR = innerR + strokeW / 2;
    const x1 = cx + midR * Math.cos(startAngle);
    const y1 = cy + midR * Math.sin(startAngle);
    const x2 = cx + midR * Math.cos(endAngle);
    const y2 = cy + midR * Math.sin(endAngle);
    const largeArc = slice > Math.PI ? 1 : 0;

    return {
      path: `M ${x1} ${y1} A ${midR} ${midR} 0 ${largeArc} 1 ${x2} ${y2}`,
      color: GENRE_COLORS[i % GENRE_COLORS.length],
      genre: g.genre,
      pct: Math.round((g.count / total) * 100),
    };
  });

  const topGenre = top[0]?.genre ?? "";

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size}>
        {arcs.map((arc, i) => (
          <path
            key={i}
            d={arc.path}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeW}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      {/* Centre label */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
        style={{ padding: innerR * 0.3 }}
      >
        <span
          className="text-[9px] uppercase tracking-widest leading-tight"
          style={{ color: "var(--text-muted)" }}
        >
          top genre
        </span>
        <span
          className="text-[10px] font-black leading-tight mt-0.5"
          style={{
            color: "var(--accent)",
            fontFamily: "var(--font-display)",
            maxWidth: innerR * 1.6,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {topGenre}
        </span>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  icon,
  genres,
  statsLine,
}: {
  title: string;
  icon: React.ReactNode;
  genres: KitsuGenreEntry[];
  statsLine: React.ReactNode;
}) {
  const top = genres.slice(0, 8);
  const max = top[0]?.count ?? 1;

  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-4"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--accent)" }}>{icon}</span>
        <span
          className="text-sm font-black"
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-display)",
          }}
        >
          {title}
        </span>
      </div>

      {/* Stats summary line */}
      <div className="flex gap-2 flex-wrap">{statsLine}</div>

      {/* Donut + genre bars */}
      {top.length > 0 ? (
        <div className="flex gap-5 items-start">
          <DonutChart genres={top} size={130} />
          <div className="flex-1 flex flex-col gap-2 pt-1">
            {top.map((g, i) => (
              <GenreBar
                key={g.genre}
                genre={g.genre}
                count={g.count}
                max={max}
                color={GENRE_COLORS[i % GENRE_COLORS.length]}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="h-20 rounded-lg flex items-center justify-center border border-dashed text-[11px]"
          style={{
            borderColor: "var(--border-subtle)",
            color: "var(--text-muted)",
          }}
        >
          No genre data available
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { theme } = useTheme();
  const [username, setUsername] = useState<string | null>(null);
  const [profile, setProfile] = useState<KitsuProfile | null>(null);
  const [loadingUsername, setLoadingUsername] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — read saved username from SQLite settings
  useEffect(() => {
    async function loadUsername() {
      try {
        const all = await invoke<Record<string, string>>("get_all_settings");
        const u = all["kitsu_username"]?.trim() ?? "";
        setUsername(u || null);
      } catch {
        setUsername(null);
      } finally {
        setLoadingUsername(false);
      }
    }
    loadUsername();
  }, []);

  // Step 2 — fetch Kitsu profile once username is known
  useEffect(() => {
    if (!username) return;
    fetchProfile(username);
  }, [username]);

  async function fetchProfile(user: string) {
    setFetching(true);
    setError(null);
    try {
      const data = await invoke<KitsuProfile>("fetch_kitsu_profile", {
        username: user,
      });
      setProfile(data);
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Failed to fetch Kitsu profile");
    } finally {
      setFetching(false);
    }
  }

  // ── Loading: reading username from DB ──────────────────────────────────────
  if (loadingUsername) {
    return (
      <div className="flex items-center justify-center h-full gap-3">
        <Loader2
          size={18}
          className="animate-spin"
          style={{ color: theme.accent }}
        />
        <span className="text-sm" style={{ color: theme.textMuted }}>
          Loading profile...
        </span>
      </div>
    );
  }

  // ── Empty state: no username set ───────────────────────────────────────────
  if (!username) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: theme.bgElevated }}
        >
          <User size={28} style={{ color: theme.textMuted }} />
        </div>
        <div className="text-center">
          <p
            className="text-sm font-bold mb-1"
            style={{ color: theme.textPrimary }}
          >
            No Kitsu account connected
          </p>
          <p className="text-[11px]" style={{ color: theme.textMuted }}>
            Go to Settings → Kitsu Account and enter your username.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-md border text-xs font-bold"
          style={{
            borderColor: theme.borderSubtle,
            color: theme.accent,
            background: theme.accentDim,
          }}
        >
          <Settings size={12} />
          Settings → Kitsu Account
        </div>
      </div>
    );
  }

  // ── Fetching: spinner while API call is in flight ──────────────────────────
  if (fetching) {
    return (
      <div className="flex items-center justify-center h-full gap-3">
        <Loader2
          size={18}
          className="animate-spin"
          style={{ color: theme.accent }}
        />
        <span className="text-sm" style={{ color: theme.textMuted }}>
          Fetching {username}'s Kitsu profile…
        </span>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle size={32} style={{ color: "#ff4466" }} />
        <div className="text-center">
          <p
            className="text-sm font-bold mb-1"
            style={{ color: theme.textPrimary }}
          >
            Could not load profile
          </p>
          <p
            className="text-[11px] max-w-xs"
            style={{ color: theme.textMuted }}
          >
            {error}
          </p>
        </div>
        <button
          onClick={() => fetchProfile(username)}
          className="flex items-center gap-2 px-4 py-2 rounded-md border text-xs font-bold"
          style={{
            borderColor: theme.borderSubtle,
            color: theme.accent,
            background: theme.accentDim,
          }}
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const animeDays = profile.anime_stats
    ? secondsToDays(profile.anime_stats.time_spent_seconds)
    : null;

  return (
    <div
      className="flex flex-col gap-5 max-w-2xl pb-8"
      style={{ fontFamily: theme.fontBody }}
    >
      {/* ── Profile Card ────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: theme.bgElevated,
          borderColor: theme.borderSubtle,
        }}
      >
        {/* Cover image banner */}
        <div
          className="w-full h-28 relative"
          style={{ background: theme.bgSurface }}
        >
          {profile.cover_url ? (
            <img
              src={profile.cover_url}
              alt="cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${theme.accentDim} 0%, ${theme.bgSurface} 100%)`,
              }}
            />
          )}
          {/* Refresh button overlay */}
          <button
            onClick={() => fetchProfile(username)}
            className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5
              rounded-md text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm
              transition-all border"
            style={{
              background: "rgba(0,0,0,0.45)",
              borderColor: "rgba(255,255,255,0.08)",
              color: theme.textMuted,
            }}
            title="Refresh profile"
          >
            <RefreshCw size={10} />
            Refresh
          </button>
        </div>

        {/* Avatar + name row */}
        <div className="px-5 pb-5">
          <div className="flex items-end gap-4 -mt-8 mb-4">
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-xl border-2 overflow-hidden flex-shrink-0 flex items-center justify-center"
              style={{
                borderColor: theme.bgElevated,
                background: theme.bgSurface,
              }}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={24} style={{ color: theme.textMuted }} />
              )}
            </div>

            {/* Name + slug */}
            <div className="pb-1 flex-1 min-w-0">
              <h2
                className="text-xl font-black leading-none truncate"
                style={{
                  color: theme.textPrimary,
                  fontFamily: theme.fontDisplay,
                  textShadow: theme.glowAccent,
                }}
              >
                {profile.name}
              </h2>
              <p
                className="text-[11px] mt-0.5"
                style={{ color: theme.textMuted }}
              >
                kitsu.app/users/{profile.slug}
              </p>
            </div>
          </div>

          {/* About / bio */}
          {profile.about && (
            <p
              className="text-xs leading-relaxed mb-4 line-clamp-3"
              style={{ color: theme.textSecondary }}
            >
              {profile.about}
            </p>
          )}

          {/* Meta rows */}
          <div className="flex flex-col gap-1.5">
            <InfoRow
              label="Gender"
              value={profile.gender ? capitalize(profile.gender) : null}
            />
            <InfoRow
              label="Location"
              value={
                profile.location
                  ? ((
                      <span className="flex items-center gap-1">
                        <MapPin size={10} />
                        {profile.location}
                      </span>
                    ) as unknown as string)
                  : null
              }
            />
            <InfoRow label="Birthday" value={formatDate(profile.birthday)} />
            <InfoRow
              label="Joined"
              value={
                profile.created_at
                  ? ((
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {formatDate(profile.created_at)}
                      </span>
                    ) as unknown as string)
                  : null
              }
            />
            {profile.waifu_name && (
              <InfoRow
                label={profile.waifu_or_husbando ?? "Waifu"}
                value={profile.waifu_name}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Anime Stats summary pills ────────────────────────────────────────── */}
      {profile.anime_stats && (
        <div className="flex gap-3">
          <StatPill
            label="Days Watched"
            value={animeDays ?? "—"}
            icon={<Clock size={14} />}
          />
          <StatPill
            label="Completed"
            value={String(Math.round(profile.anime_stats.completed))}
            icon={<CheckCircle size={14} />}
          />
          {profile.manga_stats && (
            <StatPill
              label="Chapters Read"
              value={String(Math.round(profile.manga_stats.chapters_read))}
              icon={<BookOpen size={14} />}
            />
          )}
        </div>
      )}

      {/* ── Anime Stats Card ─────────────────────────────────────────────────── */}
      {profile.anime_stats && (
        <StatsCard
          title="Anime Stats"
          icon={<Clock size={14} />}
          genres={profile.anime_stats.genre_breakdown}
          statsLine={
            <>
              <span
                className="text-[11px] px-2 py-1 rounded-md"
                style={{
                  background: theme.bgSurface,
                  color: theme.textSecondary,
                }}
              >
                ⏱ {animeDays} watched
              </span>
              <span
                className="text-[11px] px-2 py-1 rounded-md"
                style={{
                  background: theme.bgSurface,
                  color: theme.textSecondary,
                }}
              >
                ✅ {Math.round(profile.anime_stats.completed)} completed
              </span>
            </>
          }
        />
      )}

      {/* ── Manga Stats Card ──────────────────────────────────────────────────── */}
      {profile.manga_stats && (
        <StatsCard
          title="Manga Stats"
          icon={<BookOpen size={14} />}
          genres={profile.manga_stats.genre_breakdown}
          statsLine={
            <>
              <span
                className="text-[11px] px-2 py-1 rounded-md"
                style={{
                  background: theme.bgSurface,
                  color: theme.textSecondary,
                }}
              >
                📖 {Math.round(profile.manga_stats.chapters_read)} chapters
              </span>
              <span
                className="text-[11px] px-2 py-1 rounded-md"
                style={{
                  background: theme.bgSurface,
                  color: theme.textSecondary,
                }}
              >
                ✅ {Math.round(profile.manga_stats.completed)} completed
              </span>
            </>
          }
        />
      )}

      {/* ── Waifu card ────────────────────────────────────────────────────────── */}
      {profile.waifu_name && (
        <div
          className="rounded-xl border p-5 flex items-center gap-4"
          style={{
            background: theme.bgElevated,
            borderColor: theme.borderSubtle,
          }}
        >
          <Heart size={14} style={{ color: theme.accent }} />
          <div className="flex-1 min-w-0">
            <p
              className="text-[10px] uppercase tracking-widest"
              style={{ color: theme.textMuted }}
            >
              {profile.waifu_or_husbando ?? "Waifu"}
            </p>
            <p
              className="text-sm font-black truncate"
              style={{
                color: theme.textPrimary,
                fontFamily: theme.fontDisplay,
              }}
            >
              {profile.waifu_name}
            </p>
          </div>
          {profile.waifu_image_url && (
            <img
              src={profile.waifu_image_url}
              alt={profile.waifu_name}
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
          )}
        </div>
      )}
    </div>
  );
}
