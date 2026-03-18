# RU: AniShelf — API Reference

Complete reference for all Tauri commands callable from the React frontend. All commands are invoked via `@tauri-apps/api/core::invoke()`.

---

## Table of Contents

1. [Command Invocation Pattern](#command-invocation-pattern)
2. [Scanner Commands](#scanner-commands)
3. [Metadata Search Commands](#metadata-search-commands)
4. [Library Management Commands](#library-management-commands)
5. [Library Folder Commands](#library-folder-commands)
6. [Watch History Commands](#watch-history-commands)
7. [Settings Commands](#settings-commands)
8. [Utility Commands](#utility-commands)
9. [Kitsu Profile Commands](#kitsu-profile-commands)
10. [Data Transfer Objects (DTOs)](#data-transfer-objects-dtos)
11. [Error Handling](#error-handling)

---

## Command Invocation Pattern

All commands are invoked from the frontend using the Tauri invoke function:

```typescript
import { invoke } from '@tauri-apps/api/core';

// Invoke without args
const result = await invoke<ReturnType>('command_name');

// Invoke with args
const result = await invoke<ReturnType>('command_name', { 
  arg1: value1,
  arg2: value2
});
```

**Error Handling:**
```typescript
try {
  const result = await invoke<SeriesDto[]>('get_library');
} catch (error: string) {
  console.error('API error:', error);
  // Handle error (show toast, etc.)
}
```

---

## Scanner Commands

### `scan_anime_folder`

Recursively scans a folder for anime series and returns discovered entries.

**Signature:**
```typescript
invoke<DiscoveredSeries[]>('scan_anime_folder', { path: string })
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | Absolute filesystem path to scan (e.g., `C:\Anime` or `/home/user/anime`) |

**Returns:**
```typescript
DiscoveredSeries[]
// {
//   name: string                    // Series folder name
//   local_path: string              // Full path to series folder
//   episodes: DiscoveredEpisode[]   // Detected episode files
// }
```

**Example:**
```typescript
const discovered = await invoke<DiscoveredSeries[]>('scan_anime_folder', {
  path: 'C:\\Users\\XX443\\Anime'
});

// Result:
// [
//   {
//     name: "Attack on Titan",
//     local_path: "C:\\Users\\XX443\\Anime\\Attack on Titan",
//     episodes: [
//       {
//         episode_number: 1,
//         file_path: "C:\\...\\Attack on Titan\\Season 1\\01.mkv",
//         file_name: "01.mkv",
//         season_name: "Season 1"
//       },
//       ...
//     ]
//   },
//   ...
// ]
```

**Notes:**
- Synchronous (blocks UI briefly for large folders)
- Detects common video formats: `.mkv`, `.mp4`, `.avi`, `.mov`
- Extracts episode numbers from filenames (e.g., `01 - Title.mkv` → episode 1)
- Non-blocking for discovery; use only for initial folder scans or rescan operations

---

## Metadata Search Commands

### `search_anime_multi`

Searches **AniList** for up to 8 results matching a title. Best-match sorting.

**Signature:**
```typescript
invoke<SearchResultDto[]>('search_anime_multi', { title: string })
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `title` | `string` | Anime title to search (e.g., "Attack on Titan", "Jujutsu Kaisen") |

**Returns:**
```typescript
SearchResultDto[]
// {
//   anilist_id: number
//   title: string                  // Romaji or English title
//   title_english?: string
//   title_native?: string          // Japanese title
//   synopsis?: string
//   episode_count?: number
//   anilist_score?: number         // 0-10 scale
//   cover_url?: string
//   genres: string[]
//   status?: string                // ONGOING | FINISHED | NOT_YET_RELEASED
//   format?: string                // TV | MOVIE | OVA | ONA | etc
//   season_year?: number           // Release year
// }
```

**Example:**
```typescript
const results = await invoke<SearchResultDto[]>('search_anime_multi', {
  title: 'Demon Slayer'
});

// Result:
// [
//   {
//     anilist_id: 101922,
//     title: "Demon Slayer: Kimetsu no Yaiba",
//     title_english: "Demon Slayer",
//     title_native: "鬼滅の刃",
//     synopsis: "In Taisho-era Japan...",
//     episode_count: 50,
//     anilist_score: 8.73,
//     cover_url: "https://s4.anilist.co/...",
//     genres: ["Action", "Adventure", "Supernatural"],
//     status: "FINISHED",
//     format: "TV",
//     season_year: 2019
//   },
//   ...
// ]
```

**Error Cases:**
- `No results found for '{title}'` — Title didn't match any AniList entry
- `Network error: ...` — Connection failed
- `Parse error: ...` — Malformed API response

---

### `fetch_metadata`

Single best-match fetch from **AniList**. Used by the MetadataEditModal when auto-filling.

**Signature:**
```typescript
invoke<SeriesMetadata>('fetch_metadata', { title: string })
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `title` | `string` | Anime title to fetch |

**Returns:**
```typescript
SeriesMetadata
// {
//   anilist_id: number
//   title: string
//   title_english?: string
//   title_native?: string
//   synopsis?: string
//   episode_count?: number
//   anilist_score?: number
//   cover_url?: string
//   genres: string[]
//   status?: string
//   format?: string
//   season_year?: number
// }
```

**Example:**
```typescript
const metadata = await invoke<SeriesMetadata>('fetch_metadata', {
  title: 'Nana'
});
```

**Notes:**
- Returns single best match (same backend as `search_anime_multi` but filtered to 1 result)
- Preferred for auto-fill scenarios where user expects ONE result

---

### `search_mal_multi`

Searches **MyAnimeList** for up to 5 results. Requires MAL Client ID in settings.

**Signature:**
```typescript
invoke<MalResultDto[]>('search_mal_multi', { title: string })
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `title` | `string` | Anime title to search |

**Returns:**
```typescript
MalResultDto[]
// {
//   mal_id: number
//   title: string
//   title_english?: string
//   title_native?: string
//   synopsis?: string
//   episode_count?: number
//   mal_score?: number            // 1.0-10.0 scale
//   cover_url?: string
//   genres: string[]
//   status?: string               // "Currently Airing" | "Finished Airing"
//   format?: string               // "TV" | "Movie" | "OVA" | etc
//   season_year?: number
// }
```

**Example:**
```typescript
const malResults = await invoke<MalResultDto[]>('search_mal_multi', {
  title: 'Steins;Gate'
});
```

**Error Cases:**
- `MAL Client ID not set — add it in Settings` — User hasn't configured MAL API key
- `MAL API error: 401 — check your Client ID in Settings` — Invalid or expired Client ID
- `No MAL results found for '{title}'` — No matches on MAL

**Prerequisites:**
- User must set `mal_client_id` in Settings first
- Get MAL Client ID from: https://myanimelist.net/apiconfig

**Notes:**
- Automatic query cleanup: truncates title to first 4 words, removes punctuation
- Example: `"Jujutsu Kaisen 0: The Movie (2021)"` → `"Jujutsu Kaisen 0"` (cleaner MAL query)

---

### `search_kitsu_multi`

Searches **Kitsu** for up to 8 results. No authentication required (public API).

**Signature:**
```typescript
invoke<KitsuResultDto[]>('search_kitsu_multi', { title: string })
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `title` | `string` | Anime title to search |

**Returns:**
```typescript
KitsuResultDto[]
// {
//   kitsu_id: number
//   title: string
//   title_english?: string
//   title_native?: string
//   synopsis?: string
//   episode_count?: number
//   kitsu_score?: number           // 0-10 scale (normalized from 0-100)
//   cover_url?: string
//   genres: string[]               // Sideloaded from categories
//   status?: string                // "current" | "finished"
//   format?: string                // "TV" | "movie" | "OVA" | "ONA"
//   season_year?: number
// }
```

**Example:**
```typescript
const kitsuResults = await invoke<KitsuResultDto[]>('search_kitsu_multi', {
  title: 'A Certain Scientific Railgun'
});
```

**Error Cases:**
- `No Kitsu results found for '{title}'` — No matches on Kitsu
- `Network error: ...` — Connection failed
- `Kitsu API error: ...` — Rate limit or server error

**Notes:**
- Public API—no setup required
- Uses JSON:API spec (different response format than AniList/MAL)
- Genres sideloaded in single request (efficient)
- Slower than AniList, but good fallback when AniList has no match

---

## Library Management Commands

### `get_library`

Returns all series in the local library with their episodes.

**Signature:**
```typescript
invoke<SeriesDto[]>('get_library')
```

**Parameters:** None

**Returns:**
```typescript
SeriesDto[]
// {
//   id: number                           // Local DB ID
//   title: string
//   title_english?: string
//   title_native?: string
//   local_path: string                   // Folder path on disk
//   cover_local_path?: string            // Cached cover image path
//   cover_remote_url?: string            // Original URL (if fetched)
//   synopsis?: string
//   episode_count?: number
//   status: string                       // watching|completed|on_hold|plan_to_watch|dropped
//   anilist_id?: number
//   anilist_score?: number               // 0-10 scale
//   genres: string[]
//   episodes: EpisodeDto[]               // All episodes for this series
// }
//
// EpisodeDto {
//   episode_number: number
//   file_path: string
//   file_name: string
//   season_name: string
// }
```

**Example:**
```typescript
const library = await invoke<SeriesDto[]>('get_library');

library.forEach(series => {
  console.log(`${series.title}: ${series.episodes.length} episodes`);
});
```

**Performance:**
- Returns all series at once (no pagination)
- For 1000+ series, consider implementing client-side pagination

---

### `save_series_to_library`

Inserts a new series and its episodes into the library. Downloads and caches cover art.

**Signature:**
```typescript
invoke<number>('save_series_to_library', {
  title: string
  title_english?: string
  title_native?: string
  local_path: string
  cover_remote_url?: string
  synopsis?: string
  episode_count?: number
  anilist_id?: number
  anilist_score?: number
  genres: string[]
  force_refresh: boolean
  episodes: Array<[number, string, string, string]>  // [episode_num, file_path, file_name, season_name]
})
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `title` | `string` | Series title (romaji preferred) |
| `title_english` | `string?` | English title variant |
| `title_native` | `string?` | Native (Japanese) title |
| `local_path` | `string` | Folder path on disk |
| `cover_remote_url` | `string?` | URL to download cover from |
| `synopsis` | `string?` | Series description/summary |
| `episode_count` | `number?` | Total episode count |
| `anilist_id` | `number?` | AniList database ID |
| `anilist_score` | `number?` | Score (0-10) |
| `genres` | `string[]` | Genre tags (e.g., `["Action", "Drama"]`) |
| `force_refresh` | `boolean` | Force re-download cover even if cached |
| `episodes` | `tuple[]` | Array of `[episode_number, file_path, file_name, season_name]` |

**Returns:**
```typescript
number  // Newly created series ID in the database
```

**Example:**
```typescript
const seriesId = await invoke<number>('save_series_to_library', {
  title: 'Attack on Titan',
  title_english: 'Attack on Titan',
  title_native: '進撃の巨人',
  local_path: 'C:\\Anime\\Attack on Titan',
  cover_remote_url: 'https://s4.anilist.co/...',
  synopsis: 'In a world where giant humanoid creatures called Titans...',
  episode_count: 89,
  anilist_id: 16498,
  anilist_score: 8.72,
  genres: ['Action', 'Adventure', 'Dark Fantasy'],
  force_refresh: false,
  episodes: [
    [1, 'C:\\Anime\\Attack on Titan\\Season 1\\01.mkv', '01.mkv', 'Season 1'],
    [2, 'C:\\Anime\\Attack on Titan\\Season 1\\02.mkv', '02.mkv', 'Season 1'],
    // ...
  ]
});

console.log(`Series saved with ID: ${seriesId}`);
```

**Cover Handling:**
- Downloaded to `%APPDATA%/ru-anishelf/covers/` on Windows
- `~/.config/ru-anishelf/covers/` on Linux
- Sanitized filename: `Attack_on_Titan.jpg` (special chars → underscores)
- Cached: subsequent calls skip re-download unless `force_refresh: true`

**Initial Status:**
- Series always created with status `plan_to_watch`
- User can update status later with `update_series_status`

---

### `update_series_metadata`

Updates metadata (title, cover, synopsis, genres, etc.) for an existing series.

**Signature:**
```typescript
invoke<void>('update_series_metadata', {
  series_id: number
  title: string
  title_english?: string
  title_native?: string
  cover_remote_url?: string
  synopsis?: string
  episode_count?: number
  anilist_id?: number
  anilist_score?: number
  genres: string[]
})
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `series_id` | `number` | ID of series to update (from `get_library`) |
| `title` | `string` | New title |
| `title_english` | `string?` | New English title |
| `title_native` | `string?` | New native title |
| `cover_remote_url` | `string?` | New cover URL (always force-refreshed) |
| `synopsis` | `string?` | New synopsis |
| `episode_count` | `number?` | New episode count |
| `anilist_id` | `number?` | New AniList ID |
| `anilist_score` | `number?` | New score |
| `genres` | `string[]` | New genre list (replaces old) |

**Returns:** `void` (throws on error)

**Example:**
```typescript
await invoke<void>('update_series_metadata', {
  series_id: 42,
  title: 'Jujutsu Kaisen',
  title_english: 'Jujutsu Kaisen',
  title_native: '呪術廻戦',
  cover_remote_url: 'https://s4.anilist.co/...',
  synopsis: 'Yuji Itadori is a high school student...',
  episode_count: 47,
  anilist_id: 119912,
  anilist_score: 8.71,
  genres: ['Action', 'Dark', 'Supernatural']
});
```

**Notes:**
- Always force-refreshes cover (changes metadata source? → cover updates immediately)
- Episode list **not** updated (use `save_series_to_library` for new episodes)
- `updated_at` timestamp auto-set to current time

---

### `update_series_status`

Updates only the watch status for a series.

**Signature:**
```typescript
invoke<void>('update_series_status', {
  series_id: number
  status: string
})
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `series_id` | `number` | Series ID to update |
| `status` | `string` | One of: `watching`, `completed`, `on_hold`, `plan_to_watch`, `dropped` |

**Returns:** `void`

**Example:**
```typescript
await invoke<void>('update_series_status', {
  series_id: 5,
  status: 'completed'
});
```

**Valid Statuses:**
- `watching` — Currently watching
- `completed` — Finished watching
- `on_hold` — Paused, plans to resume
- `plan_to_watch` — Interested, not started
- `dropped` — Abandoned

---

## Library Folder Commands

### `get_library_folders`

Returns all folder paths registered in the library.

**Signature:**
```typescript
invoke<string[]>('get_library_folders')
```

**Parameters:** None

**Returns:**
```typescript
string[]  // Array of absolute folder paths
```

**Example:**
```typescript
const folders = await invoke<string[]>('get_library_folders');
// ['C:\\Users\\XX443\\Anime', 'D:\\Anime2', ...]
```

---

### `add_library_folder`

Registers a new folder path to monitor for anime. First folder becomes "primary".

**Signature:**
```typescript
invoke<void>('add_library_folder', { path: string })
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | Absolute folder path (e.g., `C:\Anime`) |

**Returns:** `void`

**Example:**
```typescript
await invoke<void>('add_library_folder', {
  path: 'D:\\Anime Collections'
});
```

**Notes:**
- Duplicates ignored (INSERT OR IGNORE)
- First folder added automatically becomes "primary"
- Can manage multiple library folders

---

### `remove_library_folder`

Unregisters a folder from the library. Doesn't delete files on disk.

**Signature:**
```typescript
invoke<void>('remove_library_folder', { path: string })
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | Exact path to remove |

**Returns:** `void`

**Example:**
```typescript
await invoke<void>('remove_library_folder', {
  path: 'C:\\Anime'
});
```

**Notes:**
- Removes folder metadata, **not** series that were in it
- If "primary" folder removed, promotes oldest remaining folder

---

## Watch History Commands

### `log_watch_event`

Records an episode play event to the watch history.

**Signature:**
```typescript
invoke<void>('log_watch_event', {
  series_name: string
  series_path: string
  cover_url?: string
  episode_name: string
  episode_path: string
  episode_number: number
  season_name: string
})
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `series_name` | `string` | Series title |
| `series_path` | `string` | Series folder path |
| `cover_url` | `string?` | Cover image URL (for history display) |
| `episode_name` | `string` | Episode filename |
| `episode_path` | `string` | Full episode file path |
| `episode_number` | `number` | Episode number (e.g., 5) |
| `season_name` | `string` | Season folder name (e.g., "Season 1") |

**Returns:** `void`

**Example:**
```typescript
await invoke<void>('log_watch_event', {
  series_name: 'Demon Slayer',
  series_path: 'C:\\Anime\\Demon Slayer',
  cover_url: 'https://s4.anilist.co/...',
  episode_name: '01 - Cruelty.mkv',
  episode_path: 'C:\\Anime\\Demon Slayer\\Season 1\\01 - Cruelty.mkv',
  episode_number: 1,
  season_name: 'Season 1'
});
```

**Typical Flow:**
1. User clicks "Play" on an episode in SeriesDetailPage
2. Episode opens in media player (via `open_episode`)
3. Frontend calls `log_watch_event` to record the watch
4. Frontend optionally calls `update_series_status` to mark series as "watching"

---

### `get_history`

Returns recent watch events.

**Signature:**
```typescript
invoke<WatchEventDto[]>('get_history', { limit: number })
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `limit` | `number` | Max events to return (e.g., 50) |

**Returns:**
```typescript
WatchEventDto[]
// {
//   series_name: string
//   series_path: string
//   cover_url?: string
//   episode_name: string
//   episode_path: string
//   episode_number: number
//   season_name: string
//   watched_at: string             // ISO 8601 timestamp
// }
```

**Example:**
```typescript
const history = await invoke<WatchEventDto[]>('get_history', { limit: 100 });

history.forEach(event => {
  console.log(`${event.watched_at}: ${event.series_name} Ep ${event.episode_number}`);
});
```

**Notes:**
- Results ordered by `watched_at` DESC (newest first)
- `watched_at` is ISO 8601 string (e.g., `"2026-03-18T14:30:45.123Z"`)

---

### `clear_history`

Deletes all watch events from history.

**Signature:**
```typescript
invoke<void>('clear_history')
```

**Parameters:** None

**Returns:** `void`

**Example:**
```typescript
await invoke<void>('clear_history');
```

**⚠️ Warning:**
- Irreversible—clears entire history table
- Consider confirmation dialog before calling

---

## Settings Commands

### `save_setting`

Stores a key-value setting.

**Signature:**
```typescript
invoke<void>('save_setting', {
  key: string
  value: string
})
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Setting name (e.g., `mal_client_id`, `player_path`, `theme`) |
| `value` | `string` | Setting value |

**Returns:** `void`

**Common Keys:**
| Key | Example Value | Purpose |
|-----|---------------|---------|
| `mal_client_id` | `"abcd1234..."` | MyAnimeList API authentication |
| `player_path` | `"C:\\Program Files\\VLC\\vlc.exe"` | Media player executable path |
| `theme` | `"obsidian"` | Active theme name |
| `kitsu_username` | `"myusername"` | Kitsu profile username |

**Example:**
```typescript
await invoke<void>('save_setting', {
  key: 'mal_client_id',
  value: 'your_mal_client_id_here'
});

await invoke<void>('save_setting', {
  key: 'theme',
  value: 'obsidian'
});
```

---

### `get_setting`

Retrieves a single setting.

**Signature:**
```typescript
invoke<string | null>('get_setting', { key: string })
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `key` | `string` | Setting key |

**Returns:**
```typescript
string | null  // Setting value, or null if not set
```

**Example:**
```typescript
const malId = await invoke<string | null>('get_setting', {
  key: 'mal_client_id'
});

if (malId) {
  console.log('MAL Client ID:', malId);
} else {
  console.log('MAL Client ID not configured');
}
```

---

### `get_all_settings`

Returns all settings as a key-value map.

**Signature:**
```typescript
invoke<Record<string, string>>('get_all_settings')
```

**Parameters:** None

**Returns:**
```typescript
Record<string, string>  // Object with all settings
```

**Example:**
```typescript
const allSettings = await invoke<Record<string, string>>('get_all_settings');

console.log(allSettings);
// {
//   mal_client_id: "abc123",
//   theme: "obsidian",
//   player_path: "C:\\VLC\\vlc.exe",
//   ...
// }
```

---

## Utility Commands

### `open_episode`

Opens an episode file with the configured media player (or OS default).

**Signature:**
```typescript
invoke<void>('open_episode', { file_path: string })
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `file_path` | `string` | Absolute path to episode file |

**Returns:** `void`

**Example:**
```typescript
await invoke<void>('open_episode', {
  file_path: 'C:\\Anime\\Attack on Titan\\Season 1\\01.mkv'
});
```

**Behavior:**
1. Checks if `player_path` setting is configured
2. If set & non-empty → launches that player with the file as argument
3. Otherwise → uses OS default player (via `opener` crate)

**Common Player Paths:**
- **VLC:** `C:\Program Files\VideoLAN\VLC\vlc.exe`
- **MPV:** `C:\Program Files\mpv\mpv.exe`
- **MPC-HC:** `C:\Program Files\MPC-HC\mpc-hc64.exe`

---

### `get_mal_client_id`

Retrieves the configured MAL Client ID (convenience method).

**Signature:**
```typescript
invoke<string>('get_mal_client_id')
```

**Parameters:** None

**Returns:**
```typescript
string  // Client ID, or empty string if not set
```

**Example:**
```typescript
const clientId = await invoke<string>('get_mal_client_id');

if (!clientId) {
  // Prompt user to configure MAL Client ID
}
```

**Notes:**
- Equivalent to `get_setting('mal_client_id')`
- Always returns a string (empty string if not set, not null)

---

## Kitsu Profile Commands

### `fetch_kitsu_profile`

Fetches a public Kitsu user profile with statistics.

**Signature:**
```typescript
invoke<KitsuProfile>('fetch_kitsu_profile', { username: string })
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `username` | `string` | Kitsu username (e.g., `@ColinOffshore`) |

**Returns:**
```typescript
KitsuProfile
// {
//   username: string
//   avatar_url?: string
//   bio?: string
//   anime_count: number            // Total anime in list
//   watched_episodes: number       // Total episodes watched
//   average_rating: number         // Average score given (0-10)
//   gender?: string
//   location?: string
//   website?: string
//   genres: GenreStats[]           // Genre breakdown with counts
//   stats: ProfileStats            // Additional stats
// }
```

**Example:**
```typescript
const profile = await invoke<KitsuProfile>('fetch_kitsu_profile', {
  username: '@ColinOffshore'
});

console.log(`${profile.username} has watched ${profile.watched_episodes} episodes`);
console.log('Favorite genres:', profile.genres.map(g => g.name).join(', '));
```

**Error Cases:**
- `User not found` — Username doesn't exist on Kitsu
- `Network error: ...` — Connection failed

---

### `save_kitsu_cache`

Caches a fetched KitsuProfile JSON for offline access.

**Signature:**
```typescript
invoke<void>('save_kitsu_cache', {
  username: string
  json: string
})
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `username` | `string` | Kitsu username |
| `json` | `string` | Serialized KitsuProfile JSON |

**Returns:** `void`

**Example:**
```typescript
const profile = await invoke<KitsuProfile>('fetch_kitsu_profile', {
  username: '@ColinOffshore'
});

// Cache it locally
await invoke<void>('save_kitsu_cache', {
  username: '@ColinOffshore',
  json: JSON.stringify(profile)
});
```

**Typical Usage:**
1. Fetch fresh profile from Kitsu API
2. Save to local cache
3. On next visit, load from cache (show stale data while fetching fresh)

---

### `get_kitsu_cache`

Retrieves a cached KitsuProfile, if available.

**Signature:**
```typescript
invoke<string | null>('get_kitsu_cache', { username: string })
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `username` | `string` | Kitsu username |

**Returns:**
```typescript
string | null  // Serialized JSON, or null if not cached
```

**Example:**
```typescript
const cached = await invoke<string | null>('get_kitsu_cache', {
  username: '@ColinOffshore'
});

if (cached) {
  const profile = JSON.parse(cached) as KitsuProfile;
  console.log('Using cached profile:', profile);
} else {
  console.log('No cache found, fetching from Kitsu...');
}
```

---

## Data Transfer Objects (DTOs)

### SearchResultDto

AniList search result.

```typescript
{
  anilist_id: number
  title: string                    // Romaji preferred
  title_english?: string
  title_native?: string
  synopsis?: string
  episode_count?: number
  anilist_score?: number           // 0-10
  cover_url?: string
  genres: string[]
  status?: string                  // ONGOING | FINISHED | NOT_YET_RELEASED
  format?: string                  // TV | MOVIE | OVA | ONA
  season_year?: number
}
```

### SeriesDto

Local library series (with episodes).

```typescript
{
  id: number                       // Local DB ID
  title: string
  title_english?: string
  title_native?: string
  local_path: string               // Folder path
  cover_local_path?: string        // Local cached cover
  cover_remote_url?: string        // Original URL
  synopsis?: string
  episode_count?: number
  status: string                   // watching | completed | on_hold | plan_to_watch | dropped
  anilist_id?: number
  anilist_score?: number           // 0-10
  genres: string[]
  episodes: EpisodeDto[]
}

// Nested:
EpisodeDto {
  episode_number: number
  file_path: string
  file_name: string
  season_name: string
}
```

### MalResultDto

MyAnimeList search result.

```typescript
{
  mal_id: number
  title: string
  title_english?: string
  title_native?: string
  synopsis?: string
  episode_count?: number
  mal_score?: number               // 1.0-10.0
  cover_url?: string
  genres: string[]
  status?: string                  // "Currently Airing" | "Finished Airing"
  format?: string                  // TV | Movie | OVA | etc
  season_year?: number
}
```

### KitsuResultDto

Kitsu search result.

```typescript
{
  kitsu_id: number
  title: string
  title_english?: string
  title_native?: string
  synopsis?: string
  episode_count?: number
  kitsu_score?: number             // 0-10 (normalized from 0-100)
  cover_url?: string
  genres: string[]                 // Sideloaded categories
  status?: string                  // current | finished
  format?: string                  // TV | movie | OVA | ONA
  season_year?: number
}
```

### WatchEventDto

Watch history entry.

```typescript
{
  series_name: string
  series_path: string
  cover_url?: string
  episode_name: string
  episode_path: string
  episode_number: number
  season_name: string
  watched_at: string               // ISO 8601 timestamp
}
```

---

## Error Handling

All commands return `Result<T, String>` in Rust, which translates to:
- **Success:** Returns typed value `T`
- **Failure:** Throws error message as string

### Try-Catch Pattern

```typescript
try {
  const result = await invoke<SeriesDto[]>('get_library');
  // Handle success
} catch (error) {
  const message = typeof error === 'string' ? error : String(error);
  console.error('API error:', message);
  // Show user-friendly toast:
  // showErrorToast(message);
}
```

### Common Error Messages

| Error | Cause | Resolution |
|-------|-------|-----------|
| `DB lock error: ...` | Database busy | Retry after brief delay |
| `DB error: ...` | SQLite error | Check database integrity |
| `Network error: ...` | API unreachable | Check internet connection |
| `Parse error: ...` | Malformed JSON response | API may have changed |
| `No results found for '{title}'` | Search had no matches | Try different title |
| `MAL Client ID not set` | MAL API not configured | Add Client ID in Settings |
| `Failed to build HTTP client: ...` | TLS/SSL issue | Check system certificates |

### Retry Strategy

```typescript
async function invokeWithRetry<T>(
  command: string,
  args: Record<string, any>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await invoke<T>(command, args);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      // Exponential backoff: 100ms, 200ms, 400ms
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
    }
  }
  throw new Error('Retry limit exceeded');
}

// Usage:
const series = await invokeWithRetry<SeriesDto[]>('get_library', {});
```

---

## Summary Table

| Command | Async | Purpose |
|---------|-------|---------|
| `scan_anime_folder` | No | Filesystem scan |
| `search_anime_multi` | Yes | AniList search (8 results) |
| `fetch_metadata` | Yes | AniList single fetch |
| `search_mal_multi` | Yes | MAL search (5 results) |
| `search_kitsu_multi` | Yes | Kitsu search (8 results) |
| `get_library` | Yes | All series + episodes |
| `save_series_to_library` | Yes | Insert series + episodes |
| `update_series_metadata` | Yes | Update series metadata |
| `update_series_status` | Yes | Update watch status |
| `get_library_folders` | Yes | List registered folders |
| `add_library_folder` | Yes | Register folder |
| `remove_library_folder` | Yes | Unregister folder |
| `log_watch_event` | No | Record episode play |
| `get_history` | No | Fetch watch events |
| `clear_history` | No | Clear all history |
| `save_setting` | No | Store setting |
| `get_setting` | No | Retrieve setting |
| `get_all_settings` | No | Get all settings |
| `open_episode` | Yes | Launch media player |
| `get_mal_client_id` | Yes | Retrieve MAL API key |
| `fetch_kitsu_profile` | Yes | Fetch Kitsu user profile |
| `save_kitsu_cache` | No | Cache profile JSON |
| `get_kitsu_cache` | No | Load cached profile |

---

**Version:** 0.1.0  
**Last Updated:** March 18, 2026
