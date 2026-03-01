import { useState } from "react";
import Layout from "./components/Layout";
import LibraryPage from "./pages/LibraryPage";

type StatusFilter =
  | "all"
  | "watching"
  | "completed"
  | "on_hold"
  | "plan_to_watch";

const STATUS_PAGES: Record<string, StatusFilter> = {
  watching: "watching",
  completed: "completed",
  onhold: "on_hold",
  plantowatch: "plan_to_watch",
};

export default function App() {
  const [activePage, setActivePage] = useState("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [seriesCount, setSeriesCount] = useState(0);

  const pageTitles: Record<string, string> = {
    library: "Library",
    history: "Recently Watched",
    add: "Add Anime",
    watching: "Watching",
    completed: "Completed",
    onhold: "On Hold",
    plantowatch: "Plan to Watch",
    settings: "Settings",
  };

  // Determine if the current page is a status filter page
  const statusFilter = STATUS_PAGES[activePage] ?? "all";
  const isLibraryPage = [
    "library",
    "watching",
    "completed",
    "onhold",
    "plantowatch",
  ].includes(activePage);

  function renderPage() {
    if (isLibraryPage) {
      return (
        <LibraryPage
          searchQuery={searchQuery}
          onSeriesCountChange={setSeriesCount}
          statusFilter={statusFilter}
        />
      );
    }

    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#445566] text-sm">
          {pageTitles[activePage]} — coming soon
        </p>
      </div>
    );
  }

  return (
    <Layout
      activePage={activePage}
      onNavigate={setActivePage}
      seriesCount={seriesCount}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      pageTitle={pageTitles[activePage] ?? "Library"}
    >
      {renderPage()}
    </Layout>
  );
}
