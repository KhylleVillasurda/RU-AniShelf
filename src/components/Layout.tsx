import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

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
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
