# RU: AniShelf — Component Documentation

Complete reference for all React components in the RU: AniShelf frontend. Each component includes props, state, usage patterns, and visual examples.

---

## Table of Contents

1. [Layout Components](#layout-components)
2. [Card Components](#card-components)
3. [Modal Components](#modal-components)
4. [Utility Components](#utility-components)
5. [Component Hierarchy](#component-hierarchy)
6. [Styling & Theming](#styling--theming)
7. [Common Patterns](#common-patterns)

---

## Layout Components

### Layout

**File:** [src/components/Layout.tsx](src/components/Layout.tsx)

**Purpose:** Root wrapper component that combines sidebar, topbar, and main content area with scrollable content container.

**Props:**
```typescript
interface LayoutProps {
  activePage: string              // Current page (e.g., "library", "history")
  onNavigate: (page: string) => void  // Callback when navigation clicked
  seriesCount: number             // Total series count (for sidebar badge)
  searchQuery: string             // Current search filter text
  onSearchChange: (query: string) => void  // Callback when search input changes
  pageTitle: string               // Title shown in topbar (e.g., "My Library")
  children: React.ReactNode       // Page content to render
}
```

**Features:**
- Wraps Sidebar + Topbar + OverlayScrollbars container
- Applies theme background colors and fonts
- Manages overall layout grid: sidebar (fixed width 220px) + content (flex 1)
- Uses OverlayScrollbars for custom scrollbar styling

**Usage Example:**
```typescript
<Layout
  activePage="library"
  onNavigate={setActivePage}
  seriesCount={42}
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  pageTitle="My Library"
>
  <LibraryPage series={series} />
</Layout>
```

---

### Topbar

**File:** [src/components/Topbar.tsx](src/components/Topbar.tsx)

**Purpose:** Header bar with page title and search input.

**Props:**
```typescript
interface TopbarProps {
  title: string                   // Page title to display
  searchQuery: string             // Current search text
  onSearchChange: (query: string) => void  // Called on input change
}
```

**Features:**
- Fixed height, sticky to top of content area
- Search icon + input field (Lucide `Search` icon)
- Uses CSS variables for colors (`--bg-surface`, `--border-subtle`)
- Responsive design: title flex-shrinks, search input flex-grows

**Styling:**
- Background: `var(--bg-surface)`
- Border: `var(--border-subtle)` (bottom border)
- Title font: `var(--font-display)` (bold, large)
- Input font: `var(--font-body)`

**Example:**
```typescript
<Topbar
  title="History"
  searchQuery="demon"
  onSearchChange={(q) => setQuery(q)}
/>
```

---

### Sidebar

**File:** [src/components/Sidebar.tsx](src/components/Sidebar.tsx)

**Purpose:** Left navigation panel with main menu, status filters, and settings access.

**Props:**
```typescript
interface SidebarProps {
  activePage: string              // Current page (matches nav item)
  onNavigate: (page: string) => void  // Called when nav item clicked
  seriesCount: number             // Total series (for Library badge)
}
```

**Internal Components:**

**NavItem** — Single navigation button
```typescript
interface NavItemProps {
  icon: React.ReactNode           // Lucide icon
  label: string                   // Button label
  page: string                    // Page ID (e.g., "library")
  activePage: string              // Current active page
  onNavigate: (page: string) => void
  theme: Theme                    // Theme object from context
}
```

**NavSection** — Category header (e.g., "STATUS FILTERS")
```typescript
interface NavSectionProps {
  label: string                   // Section title
  theme: Theme
}
```

**Features:**
- Logo section at top (RU: AniShelf branding)
- Main navigation: Library, History, Settings, Profile
- Status filter section with 4 buttons: Watching, Completed, On Hold, Plan to Watch
- Scrollable area for nav items
- Active page highlighted with accent color + left border
- Hover state changes background to `accentDim`

**Styling:**
- Width: 220px (fixed)
- Background: `var(--bg-surface)`
- Right border: `var(--border-subtle)`
- Active state: `theme.accent` color + left border
- Hover state: `theme.accentDim` background

**Navigation Items:**
| Icon | Label | Page |
|------|-------|------|
| 📋 | Library | `library` |
| ⏱️ | History | `history` |
| ⚙️ | Settings | `settings` |
| 👤 | Profile | `profile` |

**Status Filters:**
| Icon | Label | Page |
|------|-------|------|
| ▶️ | Watching | `library?status=watching` |
| ✓ | Completed | `library?status=completed` |
| ⏸️ | On Hold | `library?status=on_hold` |
| 📌 | Plan to Watch | `library?status=plan_to_watch` |

---

## Card Components

### AnimeCard

**File:** [src/components/AnimeCard.tsx](src/components/AnimeCard.tsx)

**Purpose:** Clickable series card for grid display with cover art, title, status badge, and metadata.

**Props:**
```typescript
interface AnimeCardProps {
  anime: AnimeCardData              // Series data to display
  onClick?: () => void              // Called when card clicked
  size?: CardSize                   // "small" | "medium" | "large"
}

interface AnimeCardData {
  id?: number                       // Series DB ID
  name: string                      // Series title
  coverUrl: string | null           // Cover image URL or local path
  coverCacheBust?: number           // Timestamp to bypass image cache
  status: "watching" | "completed" | "on_hold" | "plan_to_watch"
  episodesWatched: number           // Current watch progress
  episodeCount: number | null       // Total episodes
  genres: string[]                  // Genre tags
  score?: number                    // User score (0-10)
  synopsis?: string                 // Description
  seasons?: SeasonData[]            // Episode structure (optional)
}
```

**Size Variants:**

| Size | Title | Meta | Padding | Use Case |
|------|-------|------|---------|----------|
| `small` | `text-[10px]` | `text-[8px]` | `p-1.5` | Dense grid (many cards) |
| `medium` | `text-xs` | `text-[9px]` | `p-2` | Default library view |
| `large` | `text-sm` | `text-[10px]` | `p-3` | Detail/spotlight view |

**Status Badge Colors:**

```typescript
{
  watching: { color: "#00ffff", bg: "rgba(0,200,255,0.25)" },
  completed: { color: "#00ffaa", bg: "rgba(0,255,150,0.25)" },
  on_hold: { color: "#ffcc00", bg: "rgba(255,180,0,0.25)" },
  plan_to_watch: { color: "#aabbdd", bg: "rgba(150,170,200,0.2)" }
}
```

**Visual Structure:**
```
┌─────────────────────────────┐
│     [Cover Image 2:3]       │  ← 2:3 aspect ratio
│                             │
│                             │
├─────────────────────────────┤
│ [Title (max 2 lines)]       │
│ [Status Badge]  [Genre]     │
│ X / Y episodes              │
└─────────────────────────────┘
```

**Features:**
- Cover art with hover zoom effect (scale 1.05)
- Status badge with color coding
- Primary genre tag (right of status)
- Episode count progress (X / Y)
- Missing cover fallback (ImageOff icon)
- Cache-busting for cover updates (`coverCacheBust` timestamp)

**Cache Busting:**
When metadata is updated and cover re-downloaded, append `?t=<timestamp>` to URL:
```typescript
const url = anime.coverCacheBust
  ? `${anime.coverUrl}?t=${anime.coverCacheBust}`
  : anime.coverUrl
```
Forces browser to fetch fresh image instead of serving cached version.

**Example Usage:**
```typescript
<AnimeCard
  anime={{
    name: "Attack on Titan",
    coverUrl: "file:///C:/Users/XX443/.../covers/Attack_on_Titan.jpg",
    coverCacheBust: 1710768645000,
    status: "watching",
    episodesWatched: 25,
    episodeCount: 89,
    genres: ["Action", "Adventure", "Dark Fantasy"],
  }}
  onClick={() => navigateToDetail(42)}
  size="medium"
/>
```

---

### SkeletonCard

**File:** [src/components/SkeletonCard.tsx](src/components/SkeletonCard.tsx)

**Purpose:** Loading placeholder card that matches AnimeCard dimensions with shimmer animation.

**Props:**
```typescript
interface SkeletonCardProps {
  variant?: "active" | "pending"  // Animation style
}
```

**Variants:**

| Variant | Behavior |
|---------|----------|
| `active` | Shimmer sweep + spinner, used when actively loading |
| `pending` | Static dim placeholder, used for pre-allocated slots |

**Visual:**
```
┌─────────────────────────────┐
│  [Shimmer sweep animation]  │  ← 2:3 aspect, shimmer 1.4s loop
│        or Spinner ⟳         │     or static if pending
├─────────────────────────────┤
│ ━━━━━  (title line)         │  ← Pulse animation (active) or dim
│ ━━  (subtitle line)         │
│ ━  (meta line)              │
└─────────────────────────────┘
```

**Animation:**
- **Active:** Horizontal shimmer sweep across cover (1.4s infinite) + spinner in center
- **Pending:** Static dim appearance, placeholder effect

**Example:**
```typescript
{/* Grid of 12 cards, 3 loading */}
{loadedCards.map((card) => <AnimeCard key={card.id} anime={card} />)}
{[0, 1, 2].map((i) => <SkeletonCard key={`loading-${i}`} variant="active" />)}
```

---

## Modal Components

Modals use fixed positioning with backdrop blur and appear above all other content (z-50).

### AniListPickerModal

**File:** [src/components/AniListPickerModal.tsx](src/components/AniListPickerModal.tsx)

**Purpose:** Displays AniList search results and lets user select the best match.

**Props:**
```typescript
interface AniListPickerModalProps {
  results: SearchResult[]               // Array of search results (8 max)
  searchedTitle: string                 // Title that was searched
  onConfirm: (result: SearchResult) => void  // User picked a result
  onSkip: () => void                    // Skip adding metadata
  onCancel: () => void                  // Close without selecting
}

interface SearchResult {
  anilist_id: number
  title: string                         // Romaji title
  title_english: string | null
  title_native: string | null
  synopsis: string | null
  episode_count: number | null
  anilist_score: number | null          // 0-10 scale
  cover_url: string | null
  genres: string[]
  status: string | null                 // ONGOING | FINISHED
  format: string | null                 // TV | MOVIE | OVA
  season_year: number | null
}
```

**Features:**
- Scrollable list of results
- Click to select result (highlighted with `accent` border)
- Checkmark indicator on selected row
- Result card shows: thumbnail + title variants + meta (format, year, episodes, score) + genres
- Footer with "Confirm", "Skip", "Cancel" buttons
- First result pre-selected
- Max-width: 32rem (max-w-2xl), max-height: 85vh

**Layout:**
```
┌────────────────────────────────────────┐
│ Search Results for "Demon Slayer"      │
├────────────────────────────────────────┤
│ ┌──────────────────────────────────┐   │
│ │ [Cover]  Title                   │   │
│ │          English Title           │   │
│ │          [Format] [Year] [Eps]   │   │
│ │          [Genre] [Tags...]       │   │
│ └──────────────────────────────────┘   │
│ ┌──────────────────────────────────┐   │
│ │ [Cover]  Another Title       [✓] │   │ ← Selected
│ │          ...                      │   │
│ └──────────────────────────────────┘   │
├────────────────────────────────────────┤
│ [Skip]                  [Confirm] [X]  │
└────────────────────────────────────────┘
```

**Example:**
```typescript
const [pickerResults, setPickerResults] = useState<SearchResult[] | null>(null);

{pickerResults && (
  <AniListPickerModal
    results={pickerResults}
    searchedTitle="Attack on Titan"
    onConfirm={(result) => {
      saveMetadata(result);
      setPickerResults(null);
    }}
    onSkip={() => setPickerResults(null)}
    onCancel={() => setPickerResults(null)}
  />
)}
```

---

### MetadataEditModal

**File:** [src/components/MetadataEditModal.tsx](src/components/MetadataEditModal.tsx)

**Purpose:** Compact modal to search and update a series' metadata from AniList, MAL, or Kitsu.

**Props:**
```typescript
interface MetadataEditModalProps {
  seriesId: number                      // Series to update (DB ID)
  currentTitle: string                  // Series' current title
  onSaved: (updated: SearchResult) => void  // Metadata saved
  onCancel: () => void                  // Close without saving
}
```

**Features:**
- Search input + Search button (Tauri invoke)
- Auto-detects metadata source from settings (`anilist` | `mal` | `kitsu`)
- Handles source-specific API calls:
  - **AniList:** Positive IDs, returns 8 results
  - **MAL:** Negative ID sentinels (guards against saving MAL-only data to AniList fields), returns 5 results
  - **Kitsu:** Negative ID sentinels, returns 8 results, no API key required
- If 1 result, auto-saves without picker
- If 2+ results, shows AniListPickerModal
- Loading state: Search button shows spinner, disabled during search/save
- Error display for network/validation failures
- Help text below input (source-specific hints)

**State:**
```typescript
const [query, setQuery] = useState(currentTitle)       // Search text
const [searching, setSearching] = useState(false)      // API call in progress
const [saving, setSaving] = useState(false)            // Metadata save in progress
const [error, setError] = useState("")                 // Error message
const [pickerResults, setPickerResults] = useState(null)  // Multi-result picker
const [metadataSource, setMetadataSource] = useState("anilist")  // From settings
```

**Layout:**
```
┌──────────────────────────────┐
│ ✏ Edit Metadata              │ [X]
│ "Current Series Name"        │
├──────────────────────────────┤
│ Search AniList               │
│ [Search input...] [Search ⟳] │
│ Hint text about search...    │
│ [Error message if any]       │
└──────────────────────────────┘
```

**Example:**
```typescript
const [editingId, setEditingId] = useState<number | null>(null);

{editingId && (
  <MetadataEditModal
    seriesId={editingId}
    currentTitle={series[editingId].title}
    onSaved={(result) => {
      // Refresh series data
      setSeries((prev) => 
        prev.map((s) => 
          s.id === editingId ? { ...s, ...result } : s
        )
      );
      setEditingId(null);
    }}
    onCancel={() => setEditingId(null)}
  />
)}
```

---

### MetadataFieldPickerModal

**File:** [src/components/MetadataFieldPickerModal.tsx](src/components/MetadataFieldPickerModal.tsx)

**Purpose:** Allows user to choose which source wins for each metadata field when comparing AniList vs MAL.

**Props:**
```typescript
interface MetadataFieldPickerModalProps {
  anilist: SearchResult             // AniList search result
  mal: MalResult                    // MAL search result
  seriesTitle: string               // Series name (for display)
  onConfirm: (merged: SearchResult) => void  // User picked field sources
  onCancel: () => void              // Close without choosing
}

interface MalResult {
  mal_id: number
  title: string
  title_english: string | null
  title_native: string | null
  synopsis: string | null
  episode_count: number | null
  mal_score: number | null
  cover_url: string | null
  genres: string[]
  status: string | null
  format: string | null
  season_year: number | null
}
```

**Features:**
- Side-by-side comparison of 6 fields:
  - **Title** (display name)
  - **Score** (AniList 0-10 vs MAL 1-10)
  - **Episodes** (count)
  - **Synopsis** (first 80 chars preview)
  - **Cover Art** (image URL availability)
  - **Genres** (first 3 genres preview)
- Quick actions: "Use All from AniList" / "Use All from MAL"
- Per-field toggle to pick source
- Merged result built from choices on confirm

**State:**
```typescript
const [choices, setChoices] = useState<FieldChoice>({
  title: "anilist",       // Field: source
  synopsis: "anilist",
  cover: "anilist",
  score: "anilist",
  episodes: "anilist",
  genres: "anilist",
})
```

**Visual Layout:**
```
┌────────────────────────────────────────────────┐
│ Compare Metadata                               │
│ "Series Name"                                  │
├────────────────────────────────────────────────┤
│ [Use All from AniList]  [Use All from MAL]    │
├────────────────────────────────────────────────┤
│ Field   │ AniList [◯] │ MAL [◯]               │
├─────────┼─────────────┼─────────────────────┤
│ Title   │ Romaji   [●] │ English Variant     │
│ Score   │ 8.72/10 [●] │ 8.65/10             │
│ Episodes│ 89       [●] │ 89                  │
│ Synopsis│ "Long..."[●] │ "Different..."      │
│ Cover   │ AniList  [●] │ MAL image           │
│ Genres  │ Action...[●] │ Action Drama...     │
├────────────────────────────────────────────────┤
│                       [Confirm] [Cancel]       │
└────────────────────────────────────────────────┘
```

**Example Usage:**
```typescript
{showFieldPicker && (
  <MetadataFieldPickerModal
    anilist={anilistResult}
    mal={malResult}
    seriesTitle="My Series"
    onConfirm={(merged) => {
      saveMetadata(merged);
      setShowFieldPicker(false);
    }}
    onCancel={() => setShowFieldPicker(false)}
  />
)}
```

---

### ScanConfirmModal

**File:** [src/components/ScanConfirmModal.tsx](src/components/ScanConfirmModal.tsx)

**Purpose:** Review and edit detected series names before committing scan results to database.

**Props:**
```typescript
interface ScanConfirmModalProps {
  entries: ScanEntry[]                // Detected series
  onConfirm: (entries: ScanEntry[]) => void  // Save scan results
  onCancel: () => void                // Discard scan
}

interface ScanEntry {
  originalName: string              // Raw folder name
  cleanedName: string               // Auto-cleaned title
  editedName: string                // User's final choice
  path: string                      // Full folder path
  episodeCount: number              // Episodes detected
}
```

**Features:**
- Scrollable list of detected series
- Inline edit mode (click ✏ pencil icon)
- Edit input with keyboard shortcuts: Enter (confirm), Esc (cancel)
- Reset to cleaned name button
- Shows: folder icon, cleaned name, episode count, file path
- Confirm/Cancel buttons at footer

**State:**
```typescript
const [items, setItems] = useState<ScanEntry[]>(entries)
const [editingIndex, setEditingIndex] = useState<number | null>(null)
const [editValue, setEditValue] = useState("")
```

**Editing Workflow:**
1. User clicks ✏ pencil on a row → enter edit mode
2. Input shows current `editedName`, autofocused
3. User types new name
4. Click ✓ or press Enter → confirm edit
5. Click ✗ or press Esc → cancel edit
6. "Reset" button reverts to auto-cleaned name

**Visual Layout:**
```
┌──────────────────────────────────────┐
│ 🔍 Review Titles                     │
│ Titles were auto-cleaned from your   │
│ folder names. Use the ✏ pencil to    │
│ fix any before fetching metadata.    │
├──────────────────────────────────────┤
│ 📁 Attack on Titan       (25 eps)    │
│ 📁 Demon Slayer          (28 eps)    │
│ 📁 Jujutsu Kaisen [edit input] [✓][✗]│
│ 📁 My Anime Series       (12 eps)    │
├──────────────────────────────────────┤
│                  [Confirm] [Cancel]  │
└──────────────────────────────────────┘
```

**Example:**
```typescript
const [scannedSeries, setScannedSeries] = useState<ScanEntry[]>([]);

<ScanConfirmModal
  entries={scannedSeries}
  onConfirm={(edited) => {
    // Save edited entries to DB
    saveScanResults(edited);
  }}
  onCancel={() => setScannedSeries([])}
/>
```

---

## Utility Components

### NavItem (Sidebar subcomponent)

Internal component used by Sidebar for navigation buttons.

**Props:**
```typescript
interface NavItemProps {
  icon: React.ReactNode
  label: string
  page: string
  activePage: string
  onNavigate: (page: string) => void
  theme: Theme
}
```

**Behavior:**
- Left border (2px) colored on active page
- Background changes on hover (accentDim)
- Font color: accent if active, muted if inactive, accent on hover

---

### NavSection (Sidebar subcomponent)

Section header for grouping nav items.

**Props:**
```typescript
interface NavSectionProps {
  label: string
  theme: Theme
}
```

**Styling:**
- Small uppercase text
- Tracking-wide letter spacing
- Muted text color
- Used for: "MAIN", "STATUS FILTERS"

---

## Component Hierarchy

```
App
├── Layout
│   ├── Sidebar
│   │   ├── NavSection ("MAIN")
│   │   ├── NavItem (Library)
│   │   ├── NavItem (History)
│   │   ├── NavItem (Settings)
│   │   ├── NavItem (Profile)
│   │   ├── NavSection ("STATUS FILTERS")
│   │   ├── NavItem (Watching)
│   │   ├── NavItem (Completed)
│   │   ├── NavItem (On Hold)
│   │   └── NavItem (Plan to Watch)
│   ├── Topbar
│   │   └── Search Input
│   └── Main Content
│       ├── LibraryPage
│       │   ├── AnimeCard (grid)
│       │   └── SkeletonCard (while loading)
│       ├── SeriesDetailPage
│       │   └── Episode List
│       ├── HistoryPage
│       │   └── Event Timeline
│       ├── SettingsPage
│       │   └── Form Controls
│       └── ProfilePage
│           └── Stats & Info
└── Modal Overlays (z-50)
    ├── AniListPickerModal
    ├── MetadataEditModal
    ├── MetadataFieldPickerModal
    └── ScanConfirmModal
```

---

## Styling & Theming

### CSS Variables

All components use CSS custom properties for theming. Variables injected at runtime in [ThemeContext.tsx](src/contexts/ThemeContext.tsx):

**Colors:**
```css
--accent               /* Bright highlight color */
--accent-dim          /* Accent with transparency */
--accent-hover        /* Accent on hover state */

--bg-base             /* Main background */
--bg-surface          /* Sidebar/card background */
--bg-elevated         /* Modal/input background */
--bg-card             /* Card container background */

--text-primary        /* Main text color */
--text-secondary      /* Emphasis text */
--text-muted          /* Disabled/subtitle text */

--border-subtle       /* Faint borders */
--border-default      /* Standard borders */
--border-strong       /* Prominent borders */
```

**Typography:**
```css
--font-display        /* Bold, headlines (logo, titles) */
--font-body           /* Regular text */
```

### Tailwind Integration

Components use Tailwind classes for layout + CSS variables for colors:

```tsx
<div
  className="px-6 py-4 rounded-lg border"
  style={{
    background: "var(--bg-surface)",
    borderColor: "var(--border-default)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-body)",
  }}
>
```

### Theme Classes

- `contain: layout style paint` — CSS containment for performance
- `transition-all duration-200` — Smooth state changes
- `hover:scale-105` — Zoom on hover
- `group-hover:scale-105` — Group-based hover effects

---

## Common Patterns

### Modal Pattern

All modals follow this structure:

```tsx
<div
  className="fixed inset-0 z-50 flex items-center justify-center
    bg-black/75 backdrop-blur-sm"
>
  <div
    className="w-full max-w-2xl max-h-[85vh] flex flex-col
      rounded-xl border shadow-2xl"
    style={{
      background: "var(--bg-surface)",
      borderColor: "var(--border-default)",
    }}
  >
    {/* Header */}
    <div className="px-6 py-4 border-b flex-shrink-0">
      {/* Title + close button */}
    </div>

    {/* Content (scrollable) */}
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {/* Items list */}
    </div>

    {/* Footer (buttons) */}
    <div className="px-6 py-4 border-t flex-shrink-0">
      {/* Action buttons */}
    </div>
  </div>
</div>
```

**Key Points:**
- `fixed inset-0` covers entire viewport
- `z-50` ensures it's above everything
- `max-h-[85vh]` prevents overflow on small screens
- `flex-shrink-0` on header/footer keeps them fixed height
- `flex-1 overflow-y-auto` makes content area scrollable

### Card Grid Pattern

Library page uses CSS Grid for responsive card layout:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
  {series.map((s) => (
    <AnimeCard key={s.id} anime={s} onClick={() => navigate(s.id)} />
  ))}
</div>
```

**Responsive Breakpoints:**
- Mobile: 2 columns
- Tablet: 3 columns
- Desktop: 4-5 columns
- Adjusts automatically based on viewport width

### State Lifting Pattern

Modals are managed in parent component with lifting state up:

```tsx
// In LibraryPage
const [showEditModal, setShowEditModal] = useState(false);
const [editingSeriesId, setEditingSeriesId] = useState<number | null>(null);

{showEditModal && editingSeriesId && (
  <MetadataEditModal
    seriesId={editingSeriesId}
    onSaved={(result) => {
      // Update parent state
      setSeriesCount(prev => prev);
      setShowEditModal(false);
    }}
    onCancel={() => setShowEditModal(false)}
  />
)}
```

### Error Handling Pattern

Modals capture errors and display them:

```tsx
const [error, setError] = useState("");

async function handleAction() {
  setError("");
  try {
    await invoke("command", args);
  } catch (err) {
    setError(`Failed: ${err}`);
    // Optionally auto-clear after delay
    setTimeout(() => setError(""), 5000);
  }
}

{error && (
  <div
    className="px-4 py-2 rounded-lg text-sm"
    style={{
      background: "rgba(255, 68, 102, 0.1)",
      color: "#ff4466",
      borderColor: "rgba(255, 68, 102, 0.2)",
    }}
  >
    {error}
  </div>
)}
```

### Loading State Pattern

Use boolean flags + disabled attributes:

```tsx
const [loading, setLoading] = useState(false);

<button
  onClick={handleClick}
  disabled={loading}
  className="disabled:opacity-50 disabled:cursor-not-allowed"
>
  {loading ? (
    <>
      <Loader2 className="animate-spin mr-2" />
      Loading...
    </>
  ) : (
    "Submit"
  )}
</button>
```

---

## Performance Considerations

### Re-render Prevention

- Use `key` prop on list items (prevent reordering issues)
- Memoize expensive components if needed: `React.memo(Component)`
- Move state down to reduce parent re-renders

### CSS Containment

Cards use `contain: layout style paint` to isolate rendering:

```tsx
style={{
  contain: "layout style paint",  // Prevents layout thrashing
}}
```

### Image Optimization

Cover images use:
- Lazy loading (native `loading="lazy"` could be added)
- Cache busting with timestamps for updates
- Object-fit for consistent aspect ratios

### Scroll Performance

- OverlayScrollbars for custom scrolling (better perf than native)
- `max-h-[85vh]` to prevent massive DOM trees
- Pagination (if 1000+ items, consider virtual scrolling)

---

## Accessibility Notes

- Buttons have `:focus` states (via Tailwind)
- Icons paired with text labels
- Modal backdrops prevent interaction with background content
- Inputs have `placeholder` text and labels
- Error messages display for form validation

---

**Version:** 0.1.0  
**Last Updated:** March 18, 2026
