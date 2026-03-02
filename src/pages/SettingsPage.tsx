import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Settings,
  FolderOpen,
  Play,
  Database,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";

interface SettingsState {
  player_path: string;
  library_folder: string;
  metadata_source: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  player_path: "",
  library_folder: "",
  metadata_source: "anilist",
};

// Reusable section wrapper component
function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-[#0e0e1a] border border-[#00d4ff]/10 rounded-lg
      overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-[#00d4ff]/10 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-md bg-[#00d4ff]/10 border
          border-[#00d4ff]/20 flex items-center justify-center
          text-[#00d4ff]"
        >
          {icon}
        </div>
        <div>
          <div className="text-sm font-bold text-[#f0f4ff]">{title}</div>
          <div className="text-[11px] text-[#445566]">{description}</div>
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// Reusable input row
function SettingsInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-[#8899bb] tracking-wide">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[#13131f] border border-[#00d4ff]/10 rounded-md
          px-3 py-2 text-sm text-[#f0f4ff] placeholder-[#445566]
          outline-none focus:border-[#00d4ff]/40 transition-colors"
      />
      {hint && <p className="text-[10px] text-[#445566]">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [clearingHistory, setClearingHistory] = useState(false);

  // Load all settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const all = await invoke<Record<string, string>>("get_all_settings");
      setSettings({
        player_path: all["player_path"] ?? "",
        library_folder: all["library_folder"] ?? "",
        metadata_source: all["metadata_source"] ?? "anilist",
      });
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus("idle");
    try {
      // Save each setting individually
      await Promise.all([
        invoke("save_setting", {
          key: "player_path",
          value: settings.player_path,
        }),
        invoke("save_setting", {
          key: "library_folder",
          value: settings.library_folder,
        }),
        invoke("save_setting", {
          key: "metadata_source",
          value: settings.metadata_source,
        }),
      ]);
      setSaveStatus("success");
      // Reset status after 3 seconds
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearHistory() {
    if (!confirm("Are you sure you want to clear all watch history?")) return;
    setClearingHistory(true);
    try {
      await invoke("clear_history");
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error("Failed to clear history:", err);
      setSaveStatus("error");
    } finally {
      setClearingHistory(false);
    }
  }

  async function handleBrowsePlayer() {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Executable",
            extensions: ["exe"],
          },
        ],
        title: "Select Video Player Executable",
      });

      if (selected && typeof selected === "string") {
        updateSetting("player_path", selected);
      }
    } catch (err) {
      console.error("File picker error:", err);
    }
  }

  function updateSetting<K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K],
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3">
        <Loader2 size={18} className="animate-spin text-[#00d4ff]" />
        <span className="text-[#445566] text-sm">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* ── Video Player ── */}
      <SettingsSection
        icon={<Play size={15} />}
        title="Video Player"
        description="Configure your preferred external video player"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-[#8899bb] tracking-wide">
            Player Executable Path
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.player_path}
              onChange={(e) => updateSetting("player_path", e.target.value)}
              placeholder="e.g. C:\Program Files\VideoLAN\VLC\vlc.exe"
              className="flex-1 bg-[#13131f] border border-[#00d4ff]/10
          rounded-md px-3 py-2 text-sm text-[#f0f4ff]
          placeholder-[#445566] outline-none
          focus:border-[#00d4ff]/40 transition-colors"
            />
            <button
              onClick={handleBrowsePlayer}
              className="flex items-center gap-2 px-4 py-2 rounded-md
          border border-[#00d4ff]/15 text-[#8899bb] text-sm
          hover:border-[#00d4ff]/40 hover:text-[#00d4ff]
          hover:bg-[#00d4ff]/07 transition-all flex-shrink-0"
            >
              <FolderOpen size={13} />
              Browse
            </button>
          </div>
          <p className="text-[10px] text-[#445566]">
            Leave empty to use your system default player. Supports VLC, MPC-HC,
            MPV and any other player.
          </p>
        </div>
      </SettingsSection>

      {/* ── Library ── */}
      <SettingsSection
        icon={<FolderOpen size={15} />}
        title="Library"
        description="Default folder to scan for anime"
      >
        <SettingsInput
          label="Default Library Folder"
          value={settings.library_folder}
          onChange={(v) => updateSetting("library_folder", v)}
          placeholder="e.g. E:\Videos\Anime"
          hint="This will be pre-filled in the scan bar so you don't have to type it every time."
        />
      </SettingsSection>

      {/* ── Metadata Source ── */}
      <SettingsSection
        icon={<Settings size={15} />}
        title="Metadata Source"
        description="Choose where to fetch anime metadata from"
      >
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-[#8899bb] tracking-wide">
            Source
          </label>
          <div className="flex gap-2">
            {[
              { value: "anilist", label: "AniList", hint: "No API key needed" },
              { value: "mal", label: "MyAnimeList", hint: "Requires API key" },
              { value: "both", label: "Both", hint: "AniList + MAL merged" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateSetting("metadata_source", opt.value)}
                className={`flex-1 flex flex-col items-center gap-1 py-3
                  rounded-md border text-xs font-bold transition-all
                  ${
                    settings.metadata_source === opt.value
                      ? "border-[#00d4ff]/40 text-[#00d4ff] bg-[#00d4ff]/10"
                      : "border-[#00d4ff]/10 text-[#445566] hover:text-[#8899bb]"
                  }`}
              >
                {opt.label}
                <span className="text-[9px] font-normal opacity-70">
                  {opt.hint}
                </span>
              </button>
            ))}
          </div>
        </div>
      </SettingsSection>

      {/* ── Danger Zone ── */}
      <SettingsSection
        icon={<Database size={15} />}
        title="Data Management"
        description="Manage your library data and history"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[#f0f4ff] mb-0.5">
                Clear Watch History
              </div>
              <div className="text-[11px] text-[#445566]">
                Permanently removes all watch history entries
              </div>
            </div>
            <button
              onClick={handleClearHistory}
              disabled={clearingHistory}
              className="flex items-center gap-2 px-4 py-2 rounded-md
                border border-[#ff4466]/20 text-[#ff4466] text-xs
                hover:bg-[#ff4466]/10 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {clearingHistory ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Trash2 size={12} />
              )}
              Clear History
            </button>
          </div>
        </div>
      </SettingsSection>

      {/* ── Save Button ── */}
      <div className="flex items-center justify-between pt-2">
        {/* Save status */}
        <div className="flex items-center gap-2 text-sm">
          {saveStatus === "success" && (
            <div className="flex items-center gap-1.5 text-[#00ff9d]">
              <CheckCircle size={14} />
              Settings saved!
            </div>
          )}
          {saveStatus === "error" && (
            <div className="flex items-center gap-1.5 text-[#ff4466]">
              <AlertCircle size={14} />
              Failed to save settings
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-md
            bg-[#00d4ff] text-[#050508] font-bold text-sm
            hover:bg-[#00bfe8] transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
