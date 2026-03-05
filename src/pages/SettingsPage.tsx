import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useTheme, themes, ThemeId } from "../contexts/ThemeContext";
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
  Plus,
  X,
  ExternalLink,
  FlaskConical,
} from "lucide-react";

interface SettingsState {
  player_path: string;
  library_folder: string;
  metadata_source: string;
  mal_client_id: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  player_path: "",
  library_folder: "",
  metadata_source: "anilist",
  mal_client_id: "",
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
      className="rounded-xl border p-5 flex flex-col gap-4"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="flex items-start gap-3">
        <div style={{ color: "var(--accent)" }} className="mt-0.5">
          {icon}
        </div>
        <div>
          <div
            style={{ color: "var(--text-primary)" }}
            className="text-sm font-black"
          >
            {title}
          </div>
          <div
            style={{ color: "var(--text-muted)" }}
            className="text-[11px] mt-0.5"
          >
            {description}
          </div>
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { themeId, setThemeId } = useTheme();
  const [folders, setFolders] = useState<string[]>([]);
  const [addingFolder, setAddingFolder] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [clearingDemo, setClearingDemo] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [clearingHistory, setClearingHistory] = useState(false);

  // Load all settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSeedDemo() {
    if (
      !confirm(
        "This creates 10 fake anime folders so you can test the full scan flow. Continue?",
      )
    )
      return;
    setSeedingDemo(true);
    try {
      const demoPath = await invoke<string>("seed_demo_data");
      alert(`Demo folders created!\n\nGo to Library and scan:\n${demoPath}`);
    } catch (err: any) {
      // If already exists, tell user to clear first
      alert(err?.toString() ?? "Failed to create demo data");
    } finally {
      setSeedingDemo(false);
    }
  }

  async function handleClearDemo() {
    if (
      !confirm("This will remove all demo series from your library. Continue?")
    )
      return;
    setClearingDemo(true);
    try {
      const count = await invoke<number>("clear_demo_data");
      setSaveStatus(count > 0 ? "success" : "idle");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error("Failed to clear demo data:", err);
      setSaveStatus("error");
    } finally {
      setClearingDemo(false);
    }
  }

  async function handleAddFolder() {
    setFolders((await invoke<string[]>("get_library_folders")).map(String));
    try {
      const selected = await open({
        multiple: false,
        directory: true,
        title: "Select Anime Folder",
      });

      if (selected && typeof selected === "string") {
        setAddingFolder(true);
        await invoke("add_library_folder", { path: selected });
        // Also set as default library_folder if it's the first one
        if (folders.length === 0) {
          updateSetting("library_folder", selected);
          await invoke("save_setting", {
            key: "library_folder",
            value: selected,
          });
        }
        setFolders(await invoke<string[]>("get_library_folders"));
      }
    } catch (err) {
      console.error("Failed to add folder:", err);
    } finally {
      setAddingFolder(false);
    }
  }

  async function handleRemoveFolder(path: string) {
    setFolders((await invoke<string[]>("get_library_folders")).map(String));
    try {
      await invoke("remove_library_folder", { path });
      setFolders(await invoke<string[]>("get_library_folders"));
    } catch (err) {
      console.error("Failed to remove folder:", err);
    }
  }

  async function loadSettings() {
    const folderList = await invoke<string[]>("get_library_folders");
    setFolders(folderList.map(String));
    setLoading(true);
    try {
      const [all, folderList] = await Promise.all([
        invoke<Record<string, string>>("get_all_settings"),
        invoke<string[]>("get_library_folders"),
      ]);
      setSettings({
        player_path: all["player_path"] ?? "",
        library_folder: all["library_folder"] ?? "",
        metadata_source: all["metadata_source"] ?? "anilist",
        mal_client_id: all["mal_client_id"] ?? "",
      });
      setFolders(folderList);
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
        invoke("save_setting", {
          key: "mal_client_id",
          value: settings.mal_client_id,
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
        <Loader2 size={18} className="animate-spin text-var(--accent)" />
        <span className="text-var(--text-muted) text-sm">
          Loading settings...
        </span>
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
          <label
            style={{ color: "var(--text-secondary)" }}
            className="text-xs font-bold tracking-wide"
          >
            Player Executable Path
          </label>
          <div className="flex gap-2">
            <input
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-body)",
              }}
              type="text"
              value={settings.player_path}
              onChange={(e) => updateSetting("player_path", e.target.value)}
              placeholder="e.g. C:\Program Files\VideoLAN\VLC\vlc.exe"
              className="w-full border rounded-md px-3 py-2 text-sm outline-none
                  transition-colors"
            />
            <button
              onClick={handleBrowsePlayer}
              className="flex items-center gap-2 px-4 py-2 rounded-md
    border text-sm transition-all flex-shrink-0"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
              }}
            >
              <FolderOpen size={13} />
              Browse
            </button>
          </div>
          <p style={{ color: "var(--text-muted)" }} className="text-[10px]">
            Leave empty to use your system default player...
          </p>
        </div>
      </SettingsSection>

      {/* ── Library ── */}
      <SettingsSection
        icon={<FolderOpen size={15} />}
        title="Library Folders"
        description="Anime folders to scan — add folders from different drives"
      >
        <div className="flex flex-col gap-3">
          {/* Folder list */}
          {folders.length === 0 ? (
            <div
              className="text-[11px] py-3 text-center rounded-md border
          border-dashed"
              style={{
                color: "var(--text-muted)",
                borderColor: "var(--border-subtle)",
              }}
            >
              No folders added yet — click Add Folder to get started
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {folders.map((folder, i) => (
                <div
                  key={folder}
                  className="flex items-center gap-3 px-3 py-2.5
              rounded-md border"
                  style={{
                    background: "var(--bg-surface)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  {/* Primary badge */}
                  {i === 0 && (
                    <span
                      className="text-[9px] font-black px-1.5 py-0.5
                  rounded tracking-wide uppercase flex-shrink-0"
                      style={{
                        color: "var(--accent)",
                        background: "var(--accent-dim)",
                      }}
                    >
                      Primary
                    </span>
                  )}

                  {/* Folder icon */}
                  <FolderOpen
                    size={13}
                    className="flex-shrink-0"
                    style={{ color: "var(--text-muted)" }}
                  />

                  {/* Path */}
                  <span
                    className="flex-1 text-xs truncate font-mono"
                    style={{ color: "var(--text-secondary)" }}
                    title={folder}
                  >
                    {folder}
                  </span>

                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveFolder(folder)}
                    className="flex-shrink-0 transition-colors p-1 rounded"
                    style={{ color: "var(--text-muted)" }}
                    title="Remove folder"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add folder button */}
          <button
            onClick={handleAddFolder}
            disabled={addingFolder}
            className="flex items-center gap-2 px-4 py-2.5 rounded-md
        border text-sm font-bold transition-all self-start
        disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: "var(--border-default)",
              color: "var(--accent)",
              background: "var(--accent-dim)",
            }}
          >
            {addingFolder ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Plus size={13} />
            )}
            Add Folder
          </button>

          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            The first folder is your primary scan target. All folders are
            scanned when you click Scan Library.
          </p>
        </div>
      </SettingsSection>

      {/* ── Metadata Source ── */}
      <SettingsSection
        icon={<Settings size={15} />}
        title="Metadata Source"
        description="Choose where to fetch anime metadata from"
      >
        <div className="flex flex-col gap-2">
          <label
            style={{ color: "var(--text-secondary)" }}
            className="text-xs font-bold tracking-wide"
          >
            Source
          </label>
          <div className="flex gap-2">
            {[
              { value: "anilist", label: "AniList", hint: "No API key needed" },
              { value: "mal", label: "MyAnimeList", hint: "Requires API key" },
              { value: "both", label: "Both", hint: "AniList + MAL merged" },
            ].map((opt) => {
              const isActive = settings.metadata_source === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateSetting("metadata_source", opt.value)}
                  className="flex-1 flex flex-col items-center gap-1 py-3
        rounded-md border text-xs font-bold transition-all"
                  style={{
                    borderColor: isActive
                      ? "var(--border-strong)"
                      : "var(--border-subtle)",
                    color: isActive ? "var(--accent)" : "var(--text-muted)",
                    background: isActive ? "var(--accent-dim)" : "transparent",
                  }}
                >
                  {opt.label}
                  <span className="text-[9px] font-normal opacity-70">
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* MAL Client ID — shown when MAL or Both is selected */}
        {(settings.metadata_source === "mal" ||
          settings.metadata_source === "both") && (
          <div className="flex flex-col gap-2">
            <label
              style={{ color: "var(--text-secondary)" }}
              className="text-xs font-bold tracking-wide"
            >
              MAL Client ID
            </label>
            <input
              type="text"
              value={settings.mal_client_id}
              onChange={(e) => updateSetting("mal_client_id", e.target.value)}
              placeholder="Paste your MAL Client ID here..."
              className="border rounded-md px-3 py-2 text-sm
            outline-none transition-colors font-mono"
              style={{
                background: "var(--bg-surface)",
                borderColor: settings.mal_client_id
                  ? "var(--border-default)"
                  : "rgba(255,170,0,0.3)",
                color: "var(--text-primary)",
              }}
            />
            {/* Warning if empty */}
            {!settings.mal_client_id && (
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-md
                  border text-[11px]"
                style={{
                  background: "rgba(255,170,0,0.06)",
                  borderColor: "rgba(255,170,0,0.2)",
                  color: "#ffaa00",
                }}
              >
                <span className="flex-shrink-0">⚠</span>
                <span>
                  MAL Client ID required.{" "}
                  <a
                    href="https://myanimelist.net/apiconfig"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-0.5"
                    style={{ color: "#ffaa00" }}
                  >
                    Get one here
                    <ExternalLink size={10} />
                  </a>{" "}
                  — App Type: other, Redirect URL: http://localhost
                </span>
              </div>
            )}

            {settings.mal_client_id && (
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                ✓ Client ID saved — remember to click Save Settings below.
              </p>
            )}
          </div>
        )}
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
              <div
                style={{ color: "var(--text-primary)" }}
                className="text-sm mb-0.5"
              >
                Clear Watch History
              </div>
              <div
                style={{ color: "var(--text-muted)" }}
                className="text-[11px]"
              >
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

      {/* ── Theme ── */}
      <SettingsSection
        icon={<Settings size={15} />}
        title="Appearance"
        description="Choose your preferred visual theme"
      >
        <div className="flex flex-col gap-2">
          <label
            style={{ color: "var(--text-secondary)" }}
            className="text-xs font-bold tracking-wide"
          >
            Theme
          </label>
          <div className="flex gap-3">
            {(Object.keys(themes) as ThemeId[]).map((id) => {
              const t = themes[id];
              const isActive = themeId === id;
              return (
                <button
                  key={id}
                  onClick={() => setThemeId(id)}
                  className="flex-1 flex flex-col items-center gap-2
              py-4 rounded-md border transition-all"
                  style={{
                    borderColor: isActive ? t.accent : "rgba(100,120,150,0.2)",
                    background: isActive ? t.accentDim : "transparent",
                  }}
                >
                  {/* Mini preview */}
                  <div
                    className="w-16 h-10 rounded border flex items-center
                justify-center gap-1"
                    style={{
                      background: t.bgSurface,
                      borderColor: t.borderDefault,
                    }}
                  >
                    <div className="flex flex-col gap-0.5">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="rounded-full"
                          style={{
                            width: i === 1 ? "28px" : i === 2 ? "20px" : "24px",
                            height: "2px",
                            background: i === 1 ? t.accent : t.textMuted,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <span
                    className="text-[11px] font-bold"
                    style={{
                      color: isActive ? t.accent : "#667799",
                      fontFamily: t.fontBody,
                    }}
                  >
                    {t.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      {/* ── Demo Data ── */}
      <SettingsSection
        icon={<FlaskConical size={15} />}
        title="Demo Data"
        description="Populate your library with sample anime for testing"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-sm mb-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                Load Demo Library
              </div>
              <div
                className="text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                Adds 10 sample anime series with covers, genres and fake
                episodes
              </div>
            </div>
            <button
              onClick={handleSeedDemo}
              disabled={seedingDemo}
              className="flex items-center gap-2 px-4 py-2 rounded-md
          border text-xs font-bold transition-all
          disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--accent)",
                background: "var(--accent-dim)",
              }}
            >
              {seedingDemo ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <FlaskConical size={12} />
              )}
              {seedingDemo ? "Loading..." : "Load Demo Data"}
            </button>
          </div>

          <div
            className="h-px"
            style={{ background: "var(--border-subtle)" }}
          />

          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-sm mb-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                Clear Demo Library
              </div>
              <div
                className="text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                Removes all demo series — your real library is unaffected
              </div>
            </div>
            <button
              onClick={handleClearDemo}
              disabled={clearingDemo}
              className="flex items-center gap-2 px-4 py-2 rounded-md
          border text-xs font-bold transition-all
          disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                borderColor: "rgba(255,68,102,0.2)",
                color: "#ff4466",
              }}
            >
              {clearingDemo ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Trash2 size={12} />
              )}
              {clearingDemo ? "Clearing..." : "Clear Demo Data"}
            </button>
          </div>

          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            ⚠ Demo episodes use fake file paths — playback won't work, but all
            UI features like metadata, genres and status are fully functional.
          </p>
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
          style={{ background: "var(--accent)" }}
          className="flex items-center gap-2 px-6 py-2.5 rounded-md
    font-bold text-sm text-[#050508]"
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
