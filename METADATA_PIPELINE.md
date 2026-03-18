# RU: AniShelf — Metadata Pipeline Deep Dive

Complete walkthrough of how anime metadata flows through the entire system: from user search → API fetch → normalization → storage → display. Includes detailed explanations, code examples, and error handling strategies.

---

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [Step-by-Step Data Flow](#step-by-step-data-flow)
3. [API Integration Details](#api-integration-details)
4. [Data Normalization](#data-normalization)
5. [Cover Image Handling](#cover-image-handling)
6. [Database Persistence](#database-persistence)
7. [Error Handling & Recovery](#error-handling--recovery)
8. [Update Workflows](#update-workflows)

---

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INITIATES SEARCH                        │
│                  (MetadataEditModal, LibraryPage)               │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND: SEND SEARCH REQUEST                      │
│                                                                  │
│  invoke('search_anime_multi', { title: "Attack on Titan" })    │
│             OR                                                   │
│  invoke('search_mal_multi', { title: "..." })                  │
│             OR                                                   │
│  invoke('search_kitsu_multi', { title: "..." })                │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         BACKEND: ROUTE TO CORRECT API [lib.rs]                 │
│                                                                  │
│  Check metadata_source setting:                                 │
│   - "anilist" → call metadata::search_anime_multi()            │
│   - "mal" → call metadata::search_mal_multi()                  │
│   - "kitsu" → call metadata::search_kitsu_multi()              │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         API FETCH & RESPONSE PARSING [metadata.rs]             │
│                                                                  │
│  AniList: POST graphql.anilist.co (GraphQL query)             │
│  MAL: GET api.myanimelist.net/v2/anime (REST + Client ID)     │
│  Kitsu: GET kitsu.io/api/edge/anime (JSON:API + sideload)     │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│        NORMALIZE TO COMMON DTO [metadata.rs]                    │
│                                                                  │
│  • Extract title (Romaji → English → Unknown)                  │
│  • Normalize score (MAL/Kitsu 0-100 → 0-10)                    │
│  • Strip HTML from synopsis                                     │
│  • Select cover URL (prefer large → medium)                    │
│  • Parse genres from array/sideload                            │
│  • Extract year from date string                               │
│                                                                  │
│  Output: SearchResult[] (up to 8 results)                      │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│        FRONTEND: DISPLAY RESULTS [AniListPickerModal]          │
│                                                                  │
│  • Show up to 8 results in scrollable list                      │
│  • First result pre-selected                                    │
│  • User can click to select best match                          │
│  • Shows: cover, title variants, format, year, score, genres   │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│        USER CONFIRMS SELECTION & OPTIONAL EDITS                │
│                                                                  │
│  • Can skip adding metadata                                     │
│  • Can edit title/synopsis before saving                       │
│  • Or proceed directly with selected result                    │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│    BACKEND: DOWNLOAD & CACHE COVER [metadata.rs]              │
│                                                                  │
│  1. Sanitize filename (special chars → underscores)            │
│  2. Check if already cached locally                            │
│  3. If not cached: download from cover_url                    │
│  4. Save to %APPDATA%/ru-anishelf/covers/                     │
│  5. Return local path for database storage                     │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│   BACKEND: SAVE TO DATABASE [db.rs::upsert_series]            │
│                                                                  │
│  1. Check if series exists by local_path                       │
│  2. Insert or update series record                             │
│  3. Clear and reinsert genres via junction table               │
│  4. Save episodes (from folder scan)                           │
│  5. Set default status = 'plan_to_watch'                       │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│        FRONTEND: DISPLAY IN LIBRARY                             │
│                                                                  │
│  • Show AnimeCard with cover, title, genres, status            │
│  • User can open detail page, edit metadata, update status     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Data Flow

### Step 1: User Initiates Search

**Where:** Frontend component (LibraryPage, SeriesDetailPage, or MetadataEditModal)

**Action:** User types anime title and triggers search.

**Frontend Code:**
```typescript
// In MetadataEditModal or similar
const handleSearch = async (title: string) => {
  if (!title.trim()) return;
  
  setSearching(true);
  setError("");
  
  try {
    const results = await invoke<SearchResult[]>('search_anime_multi', { 
      title: title.trim() 
    });
    
    if (results.length === 0) {
      setError(`No results found for "${title}"`);
      return;
    }
    
    if (results.length === 1) {
      // Auto-save single result
      await handleSave(results[0]);
    } else {
      // Show picker for multiple results
      setPickerResults(results);
    }
  } catch (error) {
    setError(`Search failed: ${error}`);
  } finally {
    setSearching(false);
  }
};
```

**Data at this point:**
```typescript
{
  query: "Attack on Titan",  // User-provided search term
  source: "anilist"          // From metadata_source setting
}
```

---

### Step 2: Route to Correct API

**Where:** [lib.rs::search_anime_multi()](src-tauri/src/lib.rs)

**Decision Logic:**

Frontend reads `metadata_source` setting and calls appropriate command:
```typescript
// In MetadataEditModal
const [metadataSource, setMetadataSource] = useState("anilist");

useEffect(() => {
  invoke<string | null>("get_setting", { key: "metadata_source" })
    .then((val) => setMetadataSource(val ?? "anilist"));
}, []);

// Route to correct search function
const handleSearch = async () => {
  try {
    if (isMal) {
      results = await invoke<MalResult[]>("search_mal_multi", { title: query });
    } else if (isKitsu) {
      results = await invoke<KitsuResult[]>("search_kitsu_multi", { title: query });
    } else {
      results = await invoke<SearchResult[]>("search_anime_multi", { title: query });
    }
  } catch (error) {
    setError(`Search failed: ${error}`);
  }
};
```

**Tauri Command Layer:**
```rust
#[tauri::command]
async fn search_anime_multi(title: String) -> Result<Vec<SearchResultDto>, String> {
    let results = metadata::search_anime_multi(&title).await?;
    
    Ok(results
        .into_iter()
        .map(|m| SearchResultDto {
            anilist_id: m.anilist_id,
            title: m.title,
            title_english: m.title_english,
            title_native: m.title_native,
            synopsis: m.synopsis,
            episode_count: m.episode_count,
            anilist_score: m.anilist_score,
            cover_url: m.cover_url,
            genres: m.genres,
            status: m.status,
            format: m.format,
            season_year: m.season_year,
        })
        .collect())
}
```

---

### Step 3: API Fetch & Parse Response

#### AniList GraphQL

**File:** [metadata.rs::search_anime_multi()](src-tauri/src/metadata.rs)

**GraphQL Query:**
```rust
let query = r#"
  query ($search: String) {
    Page(perPage: 8) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title {
          romaji
          english
          native
        }
        description
        episodes
        averageScore
        coverImage {
          large
          medium
        }
        genres
        status
        format
        seasonYear
      }
    }
  }
"#;

let variables = serde_json::json!({ "search": title });

let client = Client::builder()
    .use_rustls_tls()
    .build()?;

let response = client
    .post(ANILIST_URL)  // https://graphql.anilist.co
    .header("Content-Type", "application/json")
    .json(&GraphQLQuery { query, variables })
    .send()
    .await?;
```

**API Response Structure:**
```json
{
  "data": {
    "Page": {
      "media": [
        {
          "id": 16498,
          "title": {
            "romaji": "Shingeki no Kyojin",
            "english": "Attack on Titan",
            "native": "進撃の巨人"
          },
          "description": "In a world where giant humanoid creatures...",
          "episodes": 89,
          "averageScore": 87,
          "coverImage": {
            "large": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/n16498-xyz.jpg",
            "medium": "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/n16498-xyz.jpg"
          },
          "genres": ["Action", "Adventure", "Mystery", "Drama"],
          "status": "FINISHED",
          "format": "TV",
          "seasonYear": 2013
        }
      ]
    }
  }
}
```

#### MyAnimeList REST API

**File:** [metadata.rs::search_mal_multi()](src-tauri/src/metadata.rs)

**REST Request:**
```rust
let search_title = title
    .split_whitespace()
    .take(4)
    .collect::<Vec<_>>()
    .join(" ")
    .replace(',', "")
    .replace('.', "")
    .trim()
    .to_string();

let url = format!(
    "https://api.myanimelist.net/v2/anime?q={}&limit=5&fields=id,title,\
     alternative_titles,main_picture,synopsis,num_episodes,mean,genres,\
     status,media_type,start_season",
    urlencoding::encode(&search_title)
);

let client_id = get_setting("mal_client_id")?;

let response = client
    .get(&url)
    .header("X-MAL-CLIENT-ID", client_id)
    .send()
    .await?;
```

**API Response:**
```json
{
  "data": [
    {
      "node": {
        "id": 16498,
        "title": "Attack on Titan",
        "alternative_titles": {
          "en": "Shingeki no Kyojin",
          "ja": "進撃の巨人"
        },
        "main_picture": {
          "large": "https://cdn.myanimelist.net/images/anime/10/47347l.jpg",
          "medium": "https://cdn.myanimelist.net/images/anime/10/47347.jpg"
        },
        "synopsis": "Humanity has been decimated by the sudden appearance of...",
        "num_episodes": 89,
        "mean": 8.65,
        "genres": [
          { "id": 1, "name": "Action" },
          { "id": 8, "name": "Adventure" },
          { "id": 27, "name": "Shounen" }
        ],
        "status": "finished_airing",
        "media_type": "tv",
        "start_season": {
          "year": 2013,
          "season": "spring"
        }
      }
    }
  ]
}
```

#### Kitsu JSON:API

**File:** [metadata.rs::search_kitsu_multi()](src-tauri/src/metadata.rs)

**Request:**
```rust
let search_title = title
    .split_whitespace()
    .take(4)
    .collect::<Vec<_>>()
    .join(" ")
    .replace(',', "")
    .replace('.', "")
    .trim()
    .to_string();

let url = format!(
    "https://kitsu.io/api/edge/anime?filter[text]={}&page[limit]=8&include=categories",
    urlencoding::encode(&search_title)
);

let response = client
    .get(&url)
    .header("Accept", "application/vnd.api+json")
    .header("Content-Type", "application/vnd.api+json")
    .send()
    .await?;
```

**API Response (with sideloaded categories):**
```json
{
  "data": [
    {
      "id": "5350",
      "type": "anime",
      "attributes": {
        "canonicalTitle": "Shingeki no Kyojin",
        "titles": {
          "en": "Attack on Titan",
          "en_jp": "Shingeki no Kyojin",
          "ja_jp": "進撃の巨人"
        },
        "synopsis": "In a world where giant humanoid creatures...",
        "episodeCount": 89,
        "averageRating": "85.00",
        "posterImage": {
          "large": "https://media.kitsu.io/anime/poster_images/5350/large.jpg",
          "medium": "https://media.kitsu.io/anime/poster_images/5350/medium.jpg",
          "original": "https://media.kitsu.io/anime/poster_images/5350/original.jpg"
        },
        "status": "finished",
        "subtype": "TV",
        "startDate": "2013-04-07"
      },
      "relationships": {
        "categories": {
          "data": [
            { "id": "1", "type": "categories" },
            { "id": "2", "type": "categories" },
            { "id": "5", "type": "categories" }
          ]
        }
      }
    }
  ],
  "included": [
    {
      "id": "1",
      "type": "categories",
      "attributes": { "title": "Action" }
    },
    {
      "id": "2",
      "type": "categories",
      "attributes": { "title": "Adventure" }
    },
    {
      "id": "5",
      "type": "categories",
      "attributes": { "title": "Mystery" }
    }
  ]
}
```

---

### Step 4: Normalize to Common DTO

**Purpose:** Convert diverse API response formats into a single `SearchResultDto` structure.

#### Title Normalization

**AniList:**
```rust
let display_title = media
    .title
    .as_ref()
    .and_then(|t| t.romaji.clone().or_else(|| t.english.clone()))
    .unwrap_or_else(|| title.to_string());

let title_english = media.title.as_ref().and_then(|t| t.english.clone());
let title_native = media.title.as_ref().and_then(|t| t.native.clone());
```

**MAL:**
```rust
let title = anime.title.unwrap_or_default();

let title_english = anime
    .alternative_titles
    .as_ref()
    .and_then(|t| t.en.clone())
    .filter(|s| !s.is_empty());

let title_native = anime
    .alternative_titles
    .as_ref()
    .and_then(|t| t.ja.clone())
    .filter(|s| !s.is_empty());
```

**Kitsu:**
```rust
let display_title = attrs
    .canonical_title
    .clone()
    .or_else(|| attrs.titles.as_ref().and_then(|t| t.en_jp.clone()))
    .or_else(|| attrs.titles.as_ref().and_then(|t| t.en.clone()))
    .unwrap_or_else(|| title.to_string());

let title_english = attrs
    .titles
    .as_ref()
    .and_then(|t| t.en.clone())
    .filter(|s| !s.is_empty());

let title_native = attrs
    .titles
    .as_ref()
    .and_then(|t| t.ja_jp.clone())
    .filter(|s| !s.is_empty());
```

#### Score Normalization

All sources normalized to **0-10 scale** for consistency:

```rust
// AniList: Already 0-10 scale
let anilist_score = media
    .average_score
    .map(|s| (s / 10.0 * 10.0).round() / 10.0);
// Input: 87 → 8.7

// MAL: 1-10 scale, already correct
let mal_score = anime.mean;
// Already: 8.65

// Kitsu: 0-100 scale, normalize
let kitsu_score = attrs
    .average_rating
    .as_ref()
    .and_then(|s| s.parse::<f64>().ok())
    .map(|s| (s / 10.0).round() / 1.0);
// Input: "85.00" → 8.5
```

#### Synopsis Cleaning

**HTML Stripping:**
```rust
fn strip_html(input: &str) -> String {
    let mut result = String::new();
    let mut inside_tag = false;

    for c in input.chars() {
        match c {
            '<' => inside_tag = true,
            '>' => inside_tag = false,
            _ if !inside_tag => result.push(c),
            _ => {}
        }
    }
    result.trim().to_string()
}

// Example:
// Input: "In a world... <br> Humanity has been..."
// Output: "In a world...  Humanity has been..."
```

**Applied per source:**
```rust
let synopsis = media.description.map(|d| strip_html(&d));
```

#### Cover URL Selection

**Priority: large → medium → original**

```rust
// AniList & MAL
let cover_url = media.cover_image.and_then(|c| c.large.or(c.medium));

// Kitsu (has three variants)
let cover_url = attrs
    .poster_image
    .and_then(|img| img.large.or(img.medium).or(img.original));
```

#### Genre Extraction

**AniList (direct array):**
```rust
genres: media.genres.unwrap_or_default()
```

**MAL (array of objects):**
```rust
genres: anime
    .genres
    .unwrap_or_default()
    .into_iter()
    .map(|g| g.name)
    .collect()
```

**Kitsu (sideloaded categories):**
```rust
// Build lookup map from included section
let category_map: HashMap<String, String> = body
    .included
    .unwrap_or_default()
    .into_iter()
    .filter(|inc| inc.kind.as_deref() == Some("categories"))
    .filter_map(|inc| Some((inc.id?, inc.attributes?.title?)))
    .collect();

// Resolve via relationship IDs
genres: anime
    .relationships
    .and_then(|r| r.categories)
    .and_then(|c| c.data)
    .unwrap_or_default()
    .into_iter()
    .filter_map(|rel| category_map.get(&rel.id).cloned())
    .collect()
```

#### Year Extraction

**AniList & MAL (direct field):**
```rust
let season_year = media.season_year;
// e.g., 2013
```

**Kitsu (from ISO date):**
```rust
let season_year = attrs
    .start_date
    .as_ref()
    .and_then(|d| d.split('-').next())
    .and_then(|y| y.parse::<i32>().ok());
// Input: "2013-04-07" → 2013
```

#### Final Normalized Output

```typescript
SearchResultDto {
  anilist_id: 16498,
  title: "Shingeki no Kyojin",
  title_english: "Attack on Titan",
  title_native: "進撃の巨人",
  synopsis: "In a world where giant humanoid creatures...",
  episode_count: 89,
  anilist_score: 8.7,
  cover_url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/n16498.jpg",
  genres: ["Action", "Adventure", "Mystery", "Drama"],
  status: "FINISHED",
  format: "TV",
  season_year: 2013
}
```

---

### Step 5: Display Results to User

**File:** [components/AniListPickerModal.tsx](src/components/AniListPickerModal.tsx)

**Rendered UI:**
```typescript
{results.map((result) => (
  <button
    key={result.anilist_id}
    onClick={() => setSelected(result.anilist_id)}
    className={`result-card ${isSelected ? 'selected' : ''}`}
  >
    {/* Cover thumbnail */}
    <img src={result.cover_url} alt={result.title} />
    
    {/* Title variants */}
    <h3>{result.title}</h3>
    {result.title_english && <p>{result.title_english}</p>}
    
    {/* Metadata */}
    <div className="meta">
      {result.format && <span>{result.format}</span>}
      {result.season_year && <span>{result.season_year}</span>}
      {result.episode_count && <span>{result.episode_count} eps</span>}
      {result.anilist_score && <span>★ {result.anilist_score}</span>}
    </div>
    
    {/* Genres */}
    <div className="genres">
      {result.genres.slice(0, 4).map(g => <tag key={g}>{g}</tag>)}
    </div>
    
    {/* Selection indicator */}
    {isSelected && <CheckCircle className="indicator" />}
  </button>
))}
```

**User selects best match** → proceeds to Step 6.

---

### Step 6: Download & Cache Cover Art

**File:** [metadata.rs::download_cover()](src-tauri/src/metadata.rs)

**Process:**

1. **Build local path:**
```rust
let mut covers_dir = dirs::data_dir()?;
covers_dir.push("ru-anishelf");
covers_dir.push("covers");
std::fs::create_dir_all(&covers_dir)?;
```

2. **Sanitize filename:**
```rust
let safe_title = series_title
    .chars()
    .map(|c| {
        if c.is_alphanumeric() || c == '-' || c == '_' {
            c
        } else {
            '_'  // Replace special chars with underscore
        }
    })
    .collect::<String>();

let file_name = format!("{}.jpg", safe_title);
let file_path = covers_dir.join(&file_name);
// "Attack on Titan!" → "Attack_on_Titan.jpg"
```

3. **Check cache:**
```rust
if file_path.exists() && !force_refresh {
    return Ok(file_path.to_string_lossy().to_string());
    // Cache hit: return immediately without network call
}
```

4. **Download image:**
```rust
let bytes = client
    .get(cover_url)
    .send()
    .await?
    .bytes()
    .await?;
```

5. **Save locally:**
```rust
std::fs::write(&file_path, &bytes)?;
```

6. **Return local path:**
```rust
Ok(file_path.to_string_lossy().to_string())
// "C:\\Users\\XX443\\AppData\\Local\\ru-anishelf\\covers\\Shingeki_no_Kyojin.jpg"
```

**Cache Behavior:**

- **First fetch:** Download from remote, save to cache
- **Subsequent fetches:** Use cached file instantly (no network)
- **Force refresh:** Re-download even if cached (`force_refresh: true`)
  - Used when switching metadata sources
  - Ensures new cover immediately visible

---

### Step 7: Save to Database

**File:** [lib.rs::save_series_to_library()](src-tauri/src/lib.rs)

**Frontend invocation:**
```typescript
const seriesId = await invoke<number>('save_series_to_library', {
  title: "Attack on Titan",
  title_english: "Attack on Titan",
  title_native: "進撃の巨人",
  local_path: "C:\\Anime\\Attack on Titan",
  cover_remote_url: "https://s4.anilist.co/...",
  cover_local_path: "C:\\Users\\XX443\\AppData\\Local\\ru-anishelf\\covers\\Attack_on_Titan.jpg",
  synopsis: "In a world where...",
  episode_count: 89,
  anilist_id: 16498,
  anilist_score: 8.72,
  genres: ["Action", "Adventure", "Dark Fantasy"],
  force_refresh: false,
  episodes: [
    [1, "C:\\Anime\\AoT\\S1\\01.mkv", "01.mkv", "Season 1"],
    [2, "C:\\Anime\\AoT\\S1\\02.mkv", "02.mkv", "Season 1"],
    // ... 87 more episodes
  ]
});
```

**Backend execution:**

1. **Upsert series (check by local_path):**
```rust
let series_id = db::upsert_series(
    &conn,
    &title,
    title_english.as_deref(),
    title_native.as_deref(),
    &local_path,            // Stable key for update detection
    cover_local_path.as_deref(),
    cover_remote_url.as_deref(),
    synopsis.as_deref(),
    episode_count,
    "plan_to_watch",        // Default status for new series
    anilist_id,
    anilist_score,
    &genres,
)?;
```

2. **Clear and reinsert genres:**
```rust
// Delete old genre links
conn.execute(
    "DELETE FROM series_genres WHERE series_id = ?1",
    [series_id],
)?;

// Insert genre lookup entries
for genre in &genres {
    conn.execute("INSERT OR IGNORE INTO genres (name) VALUES (?1)", [genre])?;
    let genre_id: i64 = conn.query_row(
        "SELECT id FROM genres WHERE name = ?1",
        [genre],
        |row| row.get(0)
    )?;
    
    // Link series to genre
    conn.execute(
        "INSERT OR IGNORE INTO series_genres (series_id, genre_id) VALUES (?1, ?2)",
        rusqlite::params![series_id, genre_id],
    )?;
}
```

3. **Save episodes:**
```rust
db::save_episodes(&conn, series_id, &episodes)?;
// Clears existing episodes for series_id first
```

**Database state after save:**
```sql
-- series table (1 new row)
INSERT INTO series 
  (title, title_english, title_native, ..., status, ..., created_at, updated_at)
VALUES 
  ('Attack on Titan', 'Attack on Titan', '進撃の巨人', ..., 'plan_to_watch', ..., '2026-03-18T14:30:00Z', '2026-03-18T14:30:00Z');

-- episodes table (89 new rows)
INSERT INTO episodes (series_id, episode_number, file_path, file_name, season_name)
VALUES (1, 1, 'C:\Anime\AoT\S1\01.mkv', '01.mkv', 'Season 1');
-- ... 88 more

-- genres table (3-5 new rows, or reuse existing)
INSERT INTO genres (name) VALUES ('Action');
INSERT INTO genres (name) VALUES ('Adventure');
INSERT INTO genres (name) VALUES ('Dark Fantasy');

-- series_genres table (3-5 new rows)
INSERT INTO series_genres (series_id, genre_id) VALUES (1, 1);
INSERT INTO series_genres (series_id, genre_id) VALUES (1, 2);
INSERT INTO series_genres (series_id, genre_id) VALUES (1, 3);
```

---

### Step 8: Display in Library

**Flow:** Frontend calls `get_library()` → receives updated series list → renders AnimeCard grid.

**Card renders with:**
- Cover image (from `cover_local_path`)
- Title (from `title`)
- Status badge (color-coded from `status`)
- Primary genre tag
- Episode count progress

---

## API Integration Details

### AniList

**Endpoint:** https://graphql.anilist.co

**Pros:**
- Largest anime database, most accurate matches
- GraphQL allows precise field selection
- Rich title variants (Romaji, English, Native)
- Generous rate limits (60 req/min typical)
- Free tier sufficient for app use

**Cons:**
- Rate limits exist
- Requires internet for search

**Setup:** No API key required.

**Rate Limits:** ~60 requests/minute

---

### MyAnimeList (MAL)

**Endpoint:** https://api.myanimelist.net/v2/anime

**Pros:**
- Large database, reliable metadata
- REST API simple to use
- User ratings/scores frequently referenced
- Good alternative to AniList for comparison

**Cons:**
- Requires Client ID (free, but manual setup)
- 5 results per search (limited)
- Sometimes mixes manga in results

**Setup:**
1. Visit https://myanimelist.net/apiconfig
2. Create "OAuth2 application"
3. Copy Client ID to clipboard
4. In app Settings: paste Client ID, save
5. Stored in `settings` table, key `mal_client_id`

**Rate Limits:** ~100 requests/minute (generous)

---

### Kitsu

**Endpoint:** https://kitsu.io/api/edge/anime

**Pros:**
- Public API, no authentication required
- Good for obscure/niche titles
- Genre data efficiently sideloaded
- JSON:API spec standard

**Cons:**
- Smaller database than AniList
- Sometimes slower responses
- Fewer title variants
- Less accurate for common titles

**Setup:** None required. Public access.

**Rate Limits:** Generous, no strict limits documented

---

## Data Normalization

### Consistency Across Sources

| Aspect | AniList | MAL | Kitsu | Normalized |
|--------|---------|-----|-------|-----------|
| Title | Romaji | English + Alt | Canonical + variants | Romaji preferred |
| Score | 0-100 | 1-10 | 0-100 | All → 0-10 |
| Cover | Large + Medium | Large + Medium | Large + Medium + Original | Prefer large |
| Genres | String array | Object array | Sideloaded categories | String array |
| Status | FINISHED, ONGOING | finished_airing, currently_airing | finished, current | Normalized values |
| Format | TV, MOVIE, OVA, ONA | tv, movie, ova, ona | TV, movie, OVA, ONA | As-is |
| Year | seasonYear (int) | startSeason.year | startDate (ISO) | Parsed to int |

### Normalization Rules Applied

1. **NULL/Empty Handling:** Treat as missing, use fallback
2. **Case Normalization:** Titles kept as-is, genres title-cased
3. **Score Conversion:** Always 0-10 scale, rounded to 1 decimal
4. **HTML Stripping:** Removed from all synopsis/description fields
5. **URL Selection:** Prefer highest resolution available
6. **Date Parsing:** Extract year only, discard month/day

---

## Cover Image Handling

### Caching Strategy

**Storage Location:**
- Windows: `%APPDATA%\ru-anishelf\covers\`
- Linux: `~/.local/share/ru-anishelf/covers/`
- macOS: `~/Library/Application Support/ru-anishelf/covers/`

**Filename Format:**
```
{sanitized_title}.jpg
```
Special characters replaced with underscores for filesystem safety.

**Cache Hit:** Return cached path immediately (instant load, no network)

**Cache Miss:** Download from URL, save to cache, return path

**Force Refresh:** Skip cache check, always re-download (used on metadata source change)

### Browser Cache Busting

When cover updated and re-downloaded, frontend appends timestamp to URL:

```typescript
const url = anime.coverCacheBust
  ? `${anime.coverUrl}?t=${anime.coverCacheBust}`
  : anime.coverUrl;

// Example: 
// Before: "file:///C:/Users/XX443/.../covers/Attack_on_Titan.jpg"
// After:  "file:///C:/Users/XX443/.../covers/Attack_on_Titan.jpg?t=1710768645000"
// Forces fresh fetch instead of cached image
```

**Storage Estimate:**
- Per image: ~50KB average
- 1000 series collection: ~50MB total

---

## Database Persistence

### Upsert Logic (Key: local_path)

**Check if series exists by folder path:**
```rust
let existing_id = conn.query_row(
    "SELECT id FROM series WHERE local_path = ?1",
    [local_path],
    |row| row.get(0)
).optional()?;

if let Some(id) = existing_id {
    // UPDATE existing series
} else {
    // INSERT new series
}
```

**Why `local_path` is the key:**
- Uniquely identifies a series folder on disk
- Stable across metadata source changes
- Survives title updates

### Transaction Handling

Currently **no explicit transactions**, but bulk operations should wrap:

```rust
conn.execute("BEGIN TRANSACTION", [])?;
// ... bulk inserts
conn.execute("COMMIT", [])?;
```

---

## Error Handling & Recovery

### Network Errors

**Types:** Connection timeout, DNS failure, SSL error

**Code:**
```rust
.map_err(|e| format!("Network error: {}", e))?
```

**User sees:** Toast notification with error message

**Recovery:** Check internet connection, retry search

---

### Parse Errors

**Types:** Malformed JSON, unexpected response structure

**Code:**
```rust
.json::<T>()
.map_err(|e| format!("Parse error: {}", e))?
```

**Cause:** API changed format, or wrong endpoint

**Recovery:** May require code update to match new API

---

### No Results Found

**Code:**
```rust
.ok_or_else(|| format!("No results found for '{}'", title))?
```

**Causes:** Title doesn't exist, misspelling, transliteration issue

**Recovery:** Try different title format (English vs Romaji, with/without punctuation)

---

### Missing MAL Client ID

**Code:**
```rust
if client_id.is_empty() {
    return Err("MAL Client ID not set — add it in Settings".to_string());
}
```

**User sees:** Error message directing to Settings

**Recovery:** Open Settings, paste Client ID, retry

---

### Rate Limiting

**AniList:** 60 requests/minute
**MAL:** ~100 requests/minute
**Kitsu:** No strict limits

**Error Response:** 429 Too Many Requests

**Handling:** Automatic retry after delay, or manual user retry

---

## Update Workflows

### Workflow 1: Initial Series Add (Scan → Fetch)

1. User selects folder → scanner runs `scan_anime_folder()`
2. Scanner detects series folders and episodes
3. User reviews in `ScanConfirmModal`, edits titles if needed
4. Clicks "Confirm" → saves to DB with `status = 'plan_to_watch'`
5. (Optional) User clicks metadata card → `MetadataEditModal` opens
6. User searches, selects result → metadata saved
7. Series appears in library with cover, genres, score

---

### Workflow 2: Update Metadata (Change Source)

1. User clicks "Edit" on existing series
2. Modal opens, searches different source (AniList → MAL)
3. User selects result
4. `update_series_metadata()` called:
   - Updates title, cover, synopsis, genres, score
   - Cover force-refreshed
   - Timestamps updated
5. Card re-renders with new data

---

### Workflow 3: Metadata Merge (Compare Sources)

1. Search AniList → get results
2. Search MAL → get results
3. Show side-by-side comparison in `MetadataFieldPickerModal`
4. User picks which source for each field (title, cover, score, genres)
5. Merged result passed to `update_series_metadata()`
6. Only chosen fields saved

---

## Performance Optimization Tips

### Current Bottlenecks

1. **Loading all series at once:** No pagination
   - Fetches all + episodes + genres into memory
   - For 1000+ series, causes slow app startup

2. **Cover downloads sequential:** Download one, then next
   - Should batch or parallelize for speed

3. **API queries single:** One search at a time
   - Could batch multiple searches in one GraphQL query

### Future Improvements

1. **Pagination:** Load series in pages (e.g., 50 at a time)
2. **Lazy genres:** Only load when series detail opened
3. **Parallel downloads:** Download multiple covers concurrently
4. **API batching:** Combine multiple GraphQL queries
5. **Database indexing:** Add indexes on `status`, `anilist_id`, `watched_at`

---

**Version:** 0.1.0  
**Last Updated:** March 18, 2026
