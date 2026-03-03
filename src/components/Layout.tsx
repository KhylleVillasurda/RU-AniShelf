import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";

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
  return (
    <div className="flex h-screen w-screen bg-[#050508] overflow-hidden">
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
          style={{ flex: 1, padding: "24px" }}
          options={{
            scrollbars: {
              theme: "os-theme-dark",
              autoHide: "scroll",
              autoHideDelay: 800,
              visibility: "auto",
            },
            overflow: {
              x: "hidden",
              y: "scroll",
            },
          }}
          defer
        >
          {children}
        </OverlayScrollbarsComponent>
      </div>
    </div>
  );
}
