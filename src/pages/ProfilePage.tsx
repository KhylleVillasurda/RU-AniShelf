import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTheme } from "../contexts/ThemeContext";
import { User, Settings, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { theme } = useTheme();
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUsername() {
      try {
        const all = await invoke<Record<string, string>>("get_all_settings");
        const u = all["kitsu_username"]?.trim() ?? "";
        setUsername(u || null);
      } catch {
        setUsername(null);
      } finally {
        setLoading(false);
      }
    }
    loadUsername();
  }, []);

  if (loading) {
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

  // No username set yet — guide user to settings
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

  // Username is set — Phase 2 will replace this with real data
  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Placeholder banner */}
      <div
        className="rounded-xl border p-6 flex items-center gap-4"
        style={{
          background: theme.bgElevated,
          borderColor: theme.borderSubtle,
        }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: theme.bgSurface }}
        >
          <User size={24} style={{ color: theme.accent }} />
        </div>
        <div>
          <p
            className="text-lg font-black"
            style={{
              color: theme.textPrimary,
              fontFamily: theme.fontDisplay,
            }}
          >
            {username}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: theme.textMuted }}>
            kitsu.app/users/{username}
          </p>
        </div>
        <div
          className="ml-auto px-3 py-1 rounded-md text-[10px] font-black tracking-widest uppercase"
          style={{ background: theme.accentDim, color: theme.accent }}
        >
          Phase 2 — coming soon
        </div>
      </div>

      {/* Placeholder cards */}
      {["Anime Stats", "Manga Stats"].map((label) => (
        <div
          key={label}
          className="rounded-xl border p-5"
          style={{
            background: theme.bgElevated,
            borderColor: theme.borderSubtle,
          }}
        >
          <p
            className="text-sm font-black mb-3"
            style={{ color: theme.textPrimary, fontFamily: theme.fontDisplay }}
          >
            {label}
          </p>
          <div
            className="h-32 rounded-lg flex items-center justify-center border border-dashed"
            style={{
              borderColor: theme.borderSubtle,
              color: theme.textMuted,
            }}
          >
            <p className="text-[11px]">
              Genre wheel &amp; stats will appear here after Phase 2
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
