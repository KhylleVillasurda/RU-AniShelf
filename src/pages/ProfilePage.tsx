import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTheme } from "../contexts/ThemeContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
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
import { BsClock, BsCheckCircleFill, BsBookFill } from "react-icons/bs";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Active slice — expands on hover ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } =
    props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius - 2}
      outerRadius={outerRadius + 5}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      opacity={1}
    />
  );
}

// ─── Genre Wheel — NO Recharts Tooltip to avoid overlap ──────────────────────

function GenreWheel({ genres }: { genres: KitsuGenreEntry[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const top = genres.slice(0, 10);
  const total = top.reduce((s, g) => s + g.count, 0);
  const data = top.map((g) => ({ name: g.genre, value: g.count, total }));
  const maxCount = top[0]?.count ?? 1;

  const displayIndex = activeIndex ?? 0;
  const activeGenre = top[displayIndex]?.genre ?? "";
  const activePct =
    total > 0
      ? (((top[displayIndex]?.count ?? 0) / total) * 100).toFixed(1)
      : "0";
  const activeColor = GENRE_COLORS[displayIndex % GENRE_COLORS.length];

  const onMouseEnter = useCallback((_: unknown, index: number) => {
    setActiveIndex(index);
  }, []);
  const onMouseLeave = useCallback(() => setActiveIndex(null), []);

  if (top.length === 0) {
    return (
      <div
        className="h-20 rounded-lg flex items-center justify-center border border-dashed text-[11px]"
        style={{
          borderColor: "var(--border-subtle)",
          color: "var(--text-muted)",
        }}
      >
        No genre data available
      </div>
    );
  }

  return (
    <div className="flex gap-6 items-center">
      {/* Donut — NO <Tooltip> component, info shown in centre label only */}
      <div
        className="relative flex-shrink-0"
        style={{ width: 160, height: 160 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Pie
              {...({} as any)}
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={46}
              outerRadius={66}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              strokeWidth={2}
              stroke="var(--bg-elevated)"
              activeIndex={activeIndex ?? undefined}
              activeShape={ActiveSlice}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={GENRE_COLORS[i % GENRE_COLORS.length]}
                  opacity={activeIndex === null || activeIndex === i ? 1 : 0.35}
                />
              ))}
            </Pie>
            {/* Tooltip intentionally omitted — avoids overlap with centre label */}
          </PieChart>
        </ResponsiveContainer>

        {/* Centre label — sole source of hover info, no floating tooltip */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span
            className="text-[8px] uppercase tracking-widest leading-none mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            {activeIndex !== null ? "genre" : "top"}
          </span>
          <span
            className="font-black leading-tight px-1"
            style={{
              color: activeColor,
              fontFamily: "var(--font-display)",
              fontSize: activeGenre.length > 9 ? "9px" : "11px",
              textShadow: `0 0 8px ${activeColor}55`,
              maxWidth: 80,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeGenre}
          </span>
          <span
            className="text-[10px] mt-0.5 font-bold tabular-nums"
            style={{ color: "var(--text-secondary)" }}
          >
            {activePct}%
          </span>
        </div>
      </div>

      {/* Genre bar list */}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {top.map((g, i) => {
          const pct = maxCount > 0 ? (g.count / maxCount) * 100 : 0;
          const color = GENRE_COLORS[i % GENRE_COLORS.length];
          const isActive = (activeIndex ?? 0) === i;
          return (
            <div
              key={g.genre}
              className="flex items-center gap-2 cursor-default"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 transition-all duration-150"
                style={{
                  background: color,
                  transform: isActive ? "scale(1.5)" : "scale(1)",
                  boxShadow: isActive ? `0 0 5px ${color}` : "none",
                }}
              />
              <span
                className="text-[11px] w-24 flex-shrink-0 truncate transition-colors duration-150"
                style={{
                  color: isActive
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                }}
              >
                {g.genre}
              </span>
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--bg-surface)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    background: color,
                    opacity: isActive ? 1 : 0.6,
                    boxShadow: isActive ? `0 0 6px ${color}` : "none",
                  }}
                />
              </div>
              <span
                className="text-[10px] w-7 text-right flex-shrink-0 tabular-nums"
                style={{
                  color: isActive
                    ? "var(--text-secondary)"
                    : "var(--text-muted)",
                }}
              >
                {Math.round(g.count)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

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
  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-4"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >
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
      <div className="flex gap-2 flex-wrap">{statsLine}</div>
      <GenreWheel genres={genres} />
    </div>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────

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

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode | null;
}) {
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { theme } = useTheme();
  const [username, setUsername] = useState<string | null>(null);
  const [profile, setProfile] = useState<KitsuProfile | null>(null);
  const [loadingUsername, setLoadingUsername] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // ── States ─────────────────────────────────────────────────────────────────

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
      {/* ── Cover + avatar header — Twitter/Kitsu style absolute positioning ───── */}
      <div className="relative">
        {/* Cover image — fully natural size, div grows to fit the image exactly */}
        <div className="w-full rounded-xl overflow-hidden relative">
          {profile.cover_url ? (
            <img
              src={profile.cover_url}
              alt="cover"
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          ) : (
            <div
              style={{
                height: 96,
                background: `linear-gradient(135deg, ${theme.accentDim} 0%, ${theme.bgBase} 100%)`,
              }}
            />
          )}
          {/* Subtle bottom fade */}
          <div
            className="absolute inset-x-0 bottom-0 h-10"
            style={{
              background: `linear-gradient(to bottom, transparent, rgba(0,0,0,0.35))`,
            }}
          />
          {/* Refresh button */}
          <button
            onClick={() => fetchProfile(username)}
            className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5
              rounded-md text-[10px] font-bold uppercase tracking-widest border backdrop-blur-sm transition-all"
            style={{
              background: "rgba(0,0,0,0.5)",
              borderColor: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            <RefreshCw size={10} />
            Refresh
          </button>
        </div>

        {/* Avatar — absolutely pinned to bottom-left of cover, half overhanging */}
        <div
          className="absolute left-4 w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center"
          style={{
            bottom:
              "-2.25rem" /* half of avatar height (h-20 = 5rem → half = 2.5rem, minus 2px border) */,
            border: `3px solid ${theme.bgBase}`,
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
            <User size={26} style={{ color: theme.textMuted }} />
          )}
        </div>
      </div>

      {/* ── Name row — left-padded to clear the avatar ───────────────────────── */}
      {/* pl-28 = avatar left offset (4) + avatar width (20) + gap (4) = 28 */}
      <div className="pl-28 pr-1 pt-1">
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
        <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
          kitsu.app/users/{profile.slug}
        </p>
      </div>

      {/* ── Bio + meta — plain, no card ───────────────────────────────────────── */}
      <div className="flex flex-col gap-3 px-1">
        {profile.about && (
          <p
            className="text-xs leading-relaxed"
            style={{ color: theme.textSecondary }}
          >
            {profile.about}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <InfoRow
            label="Gender"
            value={profile.gender ? capitalize(profile.gender) : null}
          />
          <InfoRow
            label="Location"
            value={
              profile.location ? (
                <span className="flex items-center gap-1">
                  <MapPin size={10} />
                  {profile.location}
                </span>
              ) : null
            }
          />
          <InfoRow label="Birthday" value={formatDate(profile.birthday)} />
          <InfoRow
            label="Joined"
            value={
              profile.created_at ? (
                <span className="flex items-center gap-1">
                  <Calendar size={10} />
                  {formatDate(profile.created_at)}
                </span>
              ) : null
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

      {/* ── Divider ───────────────────────────────────────────────────────────── */}
      <div className="h-px" style={{ background: theme.borderSubtle }} />

      {/* ── Summary stat pills ────────────────────────────────────────────────── */}
      {profile.anime_stats && (
        <div className="flex gap-3">
          <StatPill
            label="Days Watched"
            value={animeDays ?? "—"}
            icon={<Clock size={14} />}
          />
          <StatPill
            label="Anime Done"
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

      {/* ── Anime Stats card ──────────────────────────────────────────────────── */}
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
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                }}
              >
                <BsClock
                  size={11}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                />
                {animeDays} watched
              </span>
              <span
                className="text-[11px] px-2 py-1 rounded-md"
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                }}
              >
                <BsCheckCircleFill
                  size={11}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                    color: "#06d6a0",
                  }}
                />
                {Math.round(profile.anime_stats.completed)} completed
              </span>
            </>
          }
        />
      )}

      {/* ── Manga Stats card ──────────────────────────────────────────────────── */}
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
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                }}
              >
                <BsBookFill
                  size={11}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                />
                {Math.round(profile.manga_stats.chapters_read)} chapters
              </span>
              <span
                className="text-[11px] px-2 py-1 rounded-md"
                style={{
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                }}
              >
                <BsCheckCircleFill
                  size={11}
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                    color: "#06d6a0",
                  }}
                />
                {Math.round(profile.manga_stats.completed)} completed
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
