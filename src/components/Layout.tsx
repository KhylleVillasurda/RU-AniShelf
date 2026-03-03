import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";
import { useTheme } from "../contexts/ThemeContext";

interface LayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  seriesCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  pageTitle: string;
  children: React.ReactNode;
}

export default function Layout({
  activePage,
  onNavigate,
  seriesCount,
  searchQuery,
  onSearchChange,
  pageTitle,
  children,
}: LayoutProps) {
  const { theme } = useTheme();
  return (
    <div
      className="flex h-screen w-screen bg-[#050508] overflow-hidden"
      style={{
        background: theme.bgBase,
        color: theme.textPrimary,
        fontFamily: theme.fontBody,
      }}
    >
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        seriesCount={seriesCount}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar
          title={pageTitle}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
        />
        {/* OverlayScrollbars replaces the native scroll container */}
        <OverlayScrollbarsComponent
          element="main"
          style={{
            flex: 1,
            padding: "24px",
            background: theme.bgBase,
          }}
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
          {children}
        </OverlayScrollbarsComponent>
      </div>
    </div>
  );
}
