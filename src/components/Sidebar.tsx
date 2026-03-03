import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";
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
}

function NavItem({ icon, label, page, activePage, onNavigate }: NavItemProps) {
  const isActive = activePage === page;
  return (
    <button
      onClick={() => onNavigate(page)}
      className={`
        w-full flex items-center gap-3 px-5 py-2.5 text-sm
        border-l-2 transition-all duration-150 cursor-pointer
        ${
          isActive
            ? "border-[#00d4ff] bg-[#00d4ff]/10 text-[#00d4ff] font-medium"
            : "border-transparent text-[#8899bb] hover:bg-[#1c1c30] hover:text-[#f0f4ff]"
        }
      `}
    >
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function NavSection({ label }: { label: string }) {
  return (
    <div
      className="px-5 pt-4 pb-1.5 text-[10px] font-bold tracking-[0.2em] 
      uppercase text-[#445566] font-[Syne]"
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
  return (
    <aside
      className="w-[220px] flex-shrink-0 bg-[#0e0e1a] border-r 
      border-[#00d4ff]/10 flex flex-col h-full"
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[#00d4ff]/10">
        <div className="flex items-center gap-2">
          <Library className="w-5 h-5 text-[#00d4ff]" />
          <div>
            <span
              className="font-black text-lg text-[#00d4ff] 
              drop-shadow-[0_0_10px_rgba(0,212,255,0.4)]"
            >
              RU:
            </span>
            <span className="font-black text-lg text-[#f0f4ff]"> AniShelf</span>
          </div>
        </div>
        <p className="text-[10px] text-[#445566] mt-1 tracking-widest uppercase pl-7">
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
          overflow: {
            x: "hidden",
            y: "scroll",
          },
        }}
        defer
      >
        <NavSection label="Navigate" />
        <NavItem
          icon={<LayoutGrid size={15} />}
          label="Library"
          page="library"
          activePage={activePage}
          onNavigate={onNavigate}
        />
        <NavItem
          icon={<History size={15} />}
          label="Recently Watched"
          page="history"
          activePage={activePage}
          onNavigate={onNavigate}
        />
        <NavItem
          icon={<PlusCircle size={15} />}
          label="Add Anime"
          page="add"
          activePage={activePage}
          onNavigate={onNavigate}
        />

        <NavSection label="Filter" />
        <NavItem
          icon={<Play size={15} />}
          label="Watching"
          page="watching"
          activePage={activePage}
          onNavigate={onNavigate}
        />
        <NavItem
          icon={<CheckCircle size={15} />}
          label="Completed"
          page="completed"
          activePage={activePage}
          onNavigate={onNavigate}
        />
        <NavItem
          icon={<PauseCircle size={15} />}
          label="On Hold"
          page="onhold"
          activePage={activePage}
          onNavigate={onNavigate}
        />
        <NavItem
          icon={<BookmarkPlus size={15} />}
          label="Plan to Watch"
          page="plantowatch"
          activePage={activePage}
          onNavigate={onNavigate}
        />

        <NavSection label="System" />
        <NavItem
          icon={<Settings size={15} />}
          label="Settings"
          page="settings"
          activePage={activePage}
          onNavigate={onNavigate}
        />
      </OverlayScrollbarsComponent>

      {/* Bottom stats */}
      <div className="px-5 py-4 border-t border-[#00d4ff]/10">
        <div className="text-[11px] text-[#445566] mb-2">
          Library · {seriesCount} series
        </div>
        <div className="h-[3px] bg-[#1c1c30] rounded-full">
          <div
            className="h-full bg-gradient-to-r from-[#0099cc] to-[#00d4ff] 
              rounded-full transition-all duration-500"
            style={{ width: `${Math.min((seriesCount / 100) * 100, 100)}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
