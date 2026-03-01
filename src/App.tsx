import { useState } from "react";
import Layout from "./components/Layout";
import LibraryPage from "./pages/LibraryPage";
import SeriesDetailPage from "./pages/SeriesDetailPage";
import { AnimeCardData } from "./components/AnimeCard";

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
  const [selectedAnime, setSelectedAnime] = useState<AnimeCardData | null>(
    null,
  );

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

  const statusFilter = STATUS_PAGES[activePage] ?? "all";
  const isLibraryPage = [
    "library",
    "watching",
    "completed",
    "onhold",
    "plantowatch",
  ].includes(activePage);

  function handleSelectAnime(anime: AnimeCardData) {
    setSelectedAnime(anime);
    // Clear search when entering detail view
    setSearchQuery("");
  }

  function handleBack() {
    setSelectedAnime(null);
  }

  function renderPage() {
    // Show detail page if an anime is selected
    if (selectedAnime) {
      return <SeriesDetailPage anime={selectedAnime} onBack={handleBack} />;
    }

    if (isLibraryPage) {
      return (
        <LibraryPage
          searchQuery={searchQuery}
          onSeriesCountChange={setSeriesCount}
          statusFilter={statusFilter}
          onSelectAnime={handleSelectAnime}
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
      onNavigate={(page) => {
        setSelectedAnime(null); // clear detail view on nav
        setActivePage(page);
      }}
      seriesCount={seriesCount}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      pageTitle={
        selectedAnime
          ? selectedAnime.name
          : (pageTitles[activePage] ?? "Library")
      }
    >
      {renderPage()}
    </Layout>
  );
}
