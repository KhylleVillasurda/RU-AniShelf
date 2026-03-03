import { useState } from "react";
import { AnimeCardData } from "./components/AnimeCard";
import { useTheme } from "./contexts/ThemeContext";
import { useEffect } from "react";
import Layout from "./components/Layout";
import LibraryPage from "./pages/LibraryPage";
import SeriesDetailPage from "./pages/SeriesDetailPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";

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
  const { theme } = useTheme();
  const [statusUpdates, setStatusUpdates] = useState<
    Record<number, AnimeCardData["status"]>
  >({});
  const [selectedAnime, setSelectedAnime] = useState<AnimeCardData | null>(
    null,
  );

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", theme.accent);
    root.style.setProperty("--accent-dim", theme.accentDim);
    root.style.setProperty("--accent-hover", theme.accentHover);
    root.style.setProperty("--bg-base", theme.bgBase);
    root.style.setProperty("--bg-surface", theme.bgSurface);
    root.style.setProperty("--bg-elevated", theme.bgElevated);
    root.style.setProperty("--bg-card", theme.bgCard);
    root.style.setProperty("--border-subtle", theme.borderSubtle);
    root.style.setProperty("--border-default", theme.borderDefault);
    root.style.setProperty("--border-strong", theme.borderStrong);
    root.style.setProperty("--text-primary", theme.textPrimary);
    root.style.setProperty("--text-secondary", theme.textSecondary);
    root.style.setProperty("--text-muted", theme.textMuted);
    root.style.setProperty("--font-display", theme.fontDisplay);
    root.style.setProperty("--font-body", theme.fontBody);
    root.style.setProperty("--font-mono", theme.fontMono);
    root.style.setProperty("--glow-accent", theme.glowAccent);
    root.style.setProperty("--glow-card", theme.glowCard);
    root.style.setProperty("--progress-bar", theme.progressBar);
  }, [theme]);

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

  function handleStatusUpdate(id: number, status: AnimeCardData["status"]) {
    setStatusUpdates((prev) => ({ ...prev, [id]: status }));
  }

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
      return (
        <SeriesDetailPage
          anime={selectedAnime}
          onBack={handleBack}
          onStatusUpdate={handleStatusUpdate}
        />
      );
    }

    if (isLibraryPage) {
      return (
        <LibraryPage
          searchQuery={searchQuery}
          onSeriesCountChange={setSeriesCount}
          statusFilter={statusFilter}
          onSelectAnime={handleSelectAnime}
          statusUpdates={statusUpdates}
        />
      );
    }

    if (activePage === "settings") {
      return <SettingsPage />;
    }

    if (activePage === "history") {
      return <HistoryPage />;
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
