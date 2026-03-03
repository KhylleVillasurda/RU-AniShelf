import { useState } from "react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";
import { useTheme } from "../contexts/ThemeContext";
import type { Theme } from "../themes/cinematic";
import {
  LayoutGrid,
  History,
  PlusCircle,
  Play,
  CheckCircle,
  PauseCircle,
  BookmarkPlus,
  Settings,
  Library,
} from "lucide-react";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  seriesCount: number;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  page: string;
  activePage: string;
  onNavigate: (page: string) => void;
  theme: Theme;
}

function NavItem({
  icon,
  label,
  page,
  activePage,
  onNavigate,
  theme,
}: NavItemProps) {
  const isActive = activePage === page;
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onNavigate(page)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-3 px-5 py-2.5 text-sm
        transition-all duration-150 cursor-pointer border-l-2"
      style={{
        borderColor: isActive ? theme.accent : "transparent",
        background: isActive
          ? theme.accentDim
          : hovered
            ? theme.accentDim
            : "transparent",
        color: isActive
          ? theme.accent
          : hovered
            ? theme.accent
            : theme.textMuted,
        fontFamily: theme.fontBody,
      }}
    >
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function NavSection({ label, theme }: { label: string; theme: Theme }) {
  return (
    <div
      className="px-5 pt-4 pb-1.5 text-[10px] font-bold tracking-[0.2em]
        uppercase"
      style={{
        color: theme.textMuted,
        fontFamily: theme.fontDisplay,
      }}
    >
      {label}
    </div>
  );
}

export default function Sidebar({
  activePage,
  onNavigate,
  seriesCount,
}: SidebarProps) {
  const { theme } = useTheme();

  return (
    <aside
      className="w-[220px] flex-shrink-0 flex flex-col h-full"
      style={{
        background: theme.bgSurface,
        borderRight: `1px solid ${theme.borderSubtle}`,
        fontFamily: theme.fontBody,
      }}
    >
      {/* Logo */}
      <div
        className="px-5 py-6"
        style={{ borderBottom: `1px solid ${theme.borderSubtle}` }}
      >
        <div className="flex items-center gap-2">
          <Library className="w-5 h-5" style={{ color: theme.accent }} />
          <div>
            <span
              className="font-black text-lg"
              style={{
                color: theme.accent,
                textShadow: theme.glowAccent,
                fontFamily: theme.fontDisplay,
              }}
            >
              RU:
            </span>
            <span
              className="font-black text-lg"
              style={{
                color: theme.textPrimary,
                fontFamily: theme.fontDisplay,
              }}
            >
              {" "}
              AniShelf
            </span>
          </div>
        </div>
        <p
          className="text-[10px] mt-1 tracking-widest uppercase pl-7"
          style={{ color: theme.textMuted }}
        >
          Anime Library Manager
        </p>
      </div>

      {/* Navigation */}
      <OverlayScrollbarsComponent
        element="nav"
        className="flex-1 py-2"
        options={{
          scrollbars: {
            theme: "os-theme-dark",
            autoHide: "scroll",
            autoHideDelay: 800,
          },
          overflow: { x: "hidden", y: "scroll" },
        }}
        defer
      >
        {/* Nav items — pass theme down */}
        <NavSection label="Navigate" theme={theme} />
        <NavItem
          icon={<LayoutGrid size={15} />}
          label="Library"
          page="library"
          activePage={activePage}
          onNavigate={onNavigate}
          theme={theme}
        />
        <NavItem
          icon={<History size={15} />}
          label="Recently Watched"
          page="history"
          activePage={activePage}
          onNavigate={onNavigate}
          theme={theme}
        />
        <NavItem
          icon={<PlusCircle size={15} />}
          label="Add Anime"
          page="add"
          activePage={activePage}
          onNavigate={onNavigate}
          theme={theme}
        />

        <NavSection label="Filter" theme={theme} />
        <NavItem
          icon={<Play size={15} />}
          label="Watching"
          page="watching"
          activePage={activePage}
          onNavigate={onNavigate}
          theme={theme}
        />
        <NavItem
          icon={<CheckCircle size={15} />}
          label="Completed"
          page="completed"
          activePage={activePage}
          onNavigate={onNavigate}
          theme={theme}
        />
        <NavItem
          icon={<PauseCircle size={15} />}
          label="On Hold"
          page="onhold"
          activePage={activePage}
          onNavigate={onNavigate}
          theme={theme}
        />
        <NavItem
          icon={<BookmarkPlus size={15} />}
          label="Plan to Watch"
          page="plantowatch"
          activePage={activePage}
          onNavigate={onNavigate}
          theme={theme}
        />

        <NavSection label="System" theme={theme} />
        <NavItem
          icon={<Settings size={15} />}
          label="Settings"
          page="settings"
          activePage={activePage}
          onNavigate={onNavigate}
          theme={theme}
        />
      </OverlayScrollbarsComponent>

      {/* Bottom stats */}
      <div
        className="px-5 py-4"
        style={{ borderTop: `1px solid ${theme.borderSubtle}` }}
      >
        <div className="text-[11px] mb-2" style={{ color: theme.textMuted }}>
          Library · {seriesCount} series
        </div>
        <div
          className="h-[3px] rounded-full"
          style={{ background: theme.bgElevated }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min((seriesCount / 100) * 100, 100)}%`,
              background: theme.progressBar,
            }}
          />
        </div>
      </div>
    </aside>
  );
}
