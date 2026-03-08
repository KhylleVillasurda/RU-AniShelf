// =============================================================================
// kitsu.rs — Kitsu API integration
//
// Fetches a user's public Kitsu profile and activity stats using the
// Kitsu JSON:API. No authentication required — public profiles only.
//
// SECTIONS:
//   1. Kitsu API deserialisation types  (raw JSON shapes)
//   2. Output types                     (serialised back to frontend)
//   3. Public fetch function
//   4. Helpers
// =============================================================================

use serde::{Deserialize, Serialize};

// ─── 1. Kitsu API deserialisation types ───────────────────────────────────────

#[derive(Deserialize, Debug)]
struct KitsuUserResponse {
    data: Vec<KitsuUserData>,
    included: Option<Vec<KitsuIncluded>>,
}

#[derive(Deserialize, Debug)]
struct KitsuUserData {
    id: String,
    attributes: KitsuUserAttributes,
    relationships: Option<KitsuUserRelationships>,
}

/// Only the fields we actually use are typed — everything else is absorbed
/// by serde_json::Value to prevent parse failures on unknown/nullable keys.
#[allow(dead_code)]
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct KitsuUserAttributes {
    name: Option<String>,
    slug: Option<String>,
    about: Option<String>,
    location: Option<String>,
    gender: Option<String>,
    birthday: Option<String>,
    created_at: Option<String>,
    avatar: Option<KitsuImageSet>,
    cover_image: Option<KitsuImageSet>,
    waifu_or_husbando: Option<String>,
    /// Total seconds spent watching anime — lives on the user object, not stats
    #[serde(default)]
    life_spent_on_anime: Option<serde_json::Value>,
    // ── Absorb all other fields so unknown keys never break parsing ───────────
    #[serde(default)]
    past_names: Option<serde_json::Value>,
    #[serde(default)]
    followers_count: Option<serde_json::Value>,
    #[serde(default)]
    following_count: Option<serde_json::Value>,
    #[serde(default)]
    likes_given_count: Option<serde_json::Value>,
    #[serde(default)]
    reviews_count: Option<serde_json::Value>,
    #[serde(default)]
    comments_count: Option<serde_json::Value>,
    #[serde(default)]
    favorites_count: Option<serde_json::Value>,
    #[serde(default)]
    likes_received_count: Option<serde_json::Value>,
    #[serde(default)]
    posts_count: Option<serde_json::Value>,
    #[serde(default)]
    ratings_count: Option<serde_json::Value>,
    #[serde(default)]
    media_reactions_count: Option<serde_json::Value>,
    #[serde(default)]
    updated_at: Option<serde_json::Value>,
    #[serde(default)]
    pro_expires_at: Option<serde_json::Value>,
    #[serde(default)]
    pro_tier: Option<serde_json::Value>,
    #[serde(default)]
    title: Option<serde_json::Value>,
    #[serde(default)]
    profile_completed: Option<serde_json::Value>,
    #[serde(default)]
    feed_completed: Option<serde_json::Value>,
    #[serde(default)]
    website: Option<serde_json::Value>,
    #[serde(default)]
    share_to_global: Option<serde_json::Value>,
    #[serde(default)]
    title_language_preference: Option<serde_json::Value>,
    #[serde(default)]
    ao_pro: Option<serde_json::Value>,
    #[serde(default)]
    role: Option<serde_json::Value>,
    #[serde(default)]
    status: Option<serde_json::Value>,
}

/// Kitsu image objects can include tiny, meta, blurhash etc.
/// We only need the URL strings — everything else is ignored via meta field.
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct KitsuImageSet {
    tiny: Option<String>,
    small: Option<String>,
    medium: Option<String>,
    large: Option<String>,
    original: Option<String>,
}

impl KitsuImageSet {
    fn best_url(self) -> Option<String> {
        self.large
            .or(self.original)
            .or(self.medium)
            .or(self.small)
            .or(self.tiny)
    }
}

#[derive(Deserialize, Debug)]
struct KitsuUserRelationships {
    waifu: Option<KitsuRelationshipRef>,
}

#[derive(Deserialize, Debug)]
struct KitsuRelationshipRef {
    data: Option<KitsuResourceIdentifier>,
}

#[derive(Deserialize, Debug)]
struct KitsuResourceIdentifier {
    id: String,
}

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct KitsuIncluded {
    id: String,
    #[serde(rename = "type")]
    resource_type: String,
    attributes: KitsuIncludedAttributes,
}

#[derive(Deserialize, Debug)]
struct KitsuIncludedAttributes {
    name: Option<String>,
    image: Option<KitsuImageSet>,
}

// ─── Stats response ───────────────────────────────────────────────────────────
//
// Real API shape (verified from live response):
// {
//   "data": [{
//     "attributes": {
//       "kind": "anime-category-breakdown",   ← NOT "statType"
//       "statsData": {                         ← NOT "value"
//         "total": 48,
//         "categories": { "Action": 33, ... } ← nested under categories
//       }
//     }
//   }, {
//     "attributes": {
//       "kind": "anime-amount-consumed",
//       "statsData": {
//         "time": 2230404,   ← seconds
//         "media": 114,      ← total entries
//         "units": 152,      ← episodes watched
//         "completed": 33
//       }
//     }
//   }]
// }

#[derive(Deserialize, Debug)]
struct KitsuStatsResponse {
    data: Vec<KitsuStatData>,
}

#[derive(Deserialize, Debug)]
struct KitsuStatData {
    attributes: KitsuStatAttributes,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct KitsuStatAttributes {
    kind: String,
    stats_data: KitsuStatsData,
}

/// statsData shape varies by kind — use Value for flexibility
#[derive(Deserialize, Debug)]
struct KitsuStatsData(serde_json::Value);

// ─── 2. Output types ─────────────────────────────────────────────────────────

#[derive(Serialize, Debug)]
pub struct KitsuProfile {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub about: Option<String>,
    pub location: Option<String>,
    pub gender: Option<String>,
    pub birthday: Option<String>,
    pub created_at: Option<String>,
    pub avatar_url: Option<String>,
    pub cover_url: Option<String>,
    pub waifu_or_husbando: Option<String>,
    pub waifu_name: Option<String>,
    pub waifu_image_url: Option<String>,
    pub anime_stats: Option<KitsuAnimeStats>,
    pub manga_stats: Option<KitsuMangaStats>,
}

#[derive(Serialize, Debug)]
pub struct KitsuAnimeStats {
    /// Raw seconds — frontend divides by 86400 for days
    pub time_spent_seconds: f64,
    pub completed: f64,
    pub genre_breakdown: Vec<KitsuGenreEntry>,
}

#[derive(Serialize, Debug)]
pub struct KitsuMangaStats {
    pub chapters_read: f64,
    pub completed: f64,
    pub genre_breakdown: Vec<KitsuGenreEntry>,
}

#[derive(Serialize, Debug)]
pub struct KitsuGenreEntry {
    pub genre: String,
    pub count: f64,
}

// ─── 3. Public fetch function ─────────────────────────────────────────────────

pub async fn fetch_kitsu_profile(username: &str) -> Result<KitsuProfile, String> {
    let client = reqwest::Client::builder()
        .user_agent("ru-anishelf/1.0")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // ── Request 1: User profile + waifu ───────────────────────────────────
    // Numeric input → filter by ID directly (e.g. "1613403")
    // Otherwise try slug, fall back to display name
    let is_numeric = username.chars().all(|c| c.is_ascii_digit());

    let user_body = if is_numeric {
        fetch_user(&client, "id", username).await?
    } else {
        fetch_user(&client, "slug", username).await?
    };

    let user_body = if user_body.data.is_empty() {
        fetch_user(&client, "name", username).await?
    } else {
        user_body
    };

    let included = user_body.included.unwrap_or_default();

    let user = user_body.data.into_iter().next().ok_or_else(|| {
        format!(
            "User '{}' not found on Kitsu — check your username in Settings",
            username
        )
    })?;

    let attrs = user.attributes;
    let (waifu_name, waifu_image_url) = resolve_waifu(&user.relationships, &included);

    // ── Request 2: Stats ───────────────────────────────────────────────────
    let stats_url = format!("https://kitsu.app/api/edge/users/{}/stats", user.id);

    let stats_resp = client
        .get(&stats_url)
        .header("Accept", "application/vnd.api+json")
        .send()
        .await
        .map_err(|e| format!("Network error fetching stats: {}", e))?;

    let stats_text = stats_resp
        .text()
        .await
        .map_err(|e| format!("Failed to read stats body: {}", e))?;

    let stats_body: KitsuStatsResponse =
        serde_json::from_str(&stats_text).map_err(|e| format!("Failed to parse stats: {}", e))?;

    let (anime_stats, manga_stats) = parse_stats(stats_body.data);

    let user_id = user.id;
    Ok(KitsuProfile {
        id: user_id.clone(),
        name: attrs.name.unwrap_or_else(|| username.to_string()),
        slug: attrs.slug.unwrap_or_else(|| user_id.clone()),
        about: attrs.about,
        location: attrs.location,
        gender: attrs.gender,
        birthday: attrs.birthday,
        created_at: attrs.created_at,
        avatar_url: attrs.avatar.and_then(KitsuImageSet::best_url),
        cover_url: attrs.cover_image.and_then(KitsuImageSet::best_url),
        waifu_or_husbando: attrs.waifu_or_husbando,
        waifu_name,
        waifu_image_url,
        anime_stats,
        manga_stats,
    })
}

// ─── 4. Helpers ───────────────────────────────────────────────────────────────

async fn fetch_user(
    client: &reqwest::Client,
    filter: &str,
    username: &str,
) -> Result<KitsuUserResponse, String> {
    let url = format!(
        "https://kitsu.app/api/edge/users?filter[{}]={}&include=waifu",
        filter,
        urlencoding::encode(username)
    );

    let resp = client
        .get(&url)
        .header("Accept", "application/vnd.api+json")
        .send()
        .await
        .map_err(|e| format!("Network error fetching profile: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Kitsu API error: HTTP {}", resp.status().as_u16()));
    }

    let body = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read profile body: {}", e))?;

    serde_json::from_str::<KitsuUserResponse>(&body)
        .map_err(|e| format!("Failed to parse profile response: {}", e))
}

fn resolve_waifu(
    relationships: &Option<KitsuUserRelationships>,
    included: &[KitsuIncluded],
) -> (Option<String>, Option<String>) {
    let waifu_id = relationships
        .as_ref()
        .and_then(|r| r.waifu.as_ref())
        .and_then(|w| w.data.as_ref())
        .map(|d| d.id.as_str());

    if let Some(id) = waifu_id {
        if let Some(character) = included
            .iter()
            .find(|inc| inc.resource_type == "characters" && inc.id == id)
        {
            let name = character.attributes.name.clone();
            let image = character.attributes.image.as_ref().and_then(|img| {
                img.original
                    .clone()
                    .or_else(|| img.large.clone())
                    .or_else(|| img.medium.clone())
                    .or_else(|| img.small.clone())
            });
            return (name, image);
        }
    }

    (None, None)
}

/// Parses the stats array using the real API shape:
/// kind = "anime-category-breakdown" | "anime-amount-consumed" | "manga-*"
/// statsData = { categories: {...} } or { time, media, units, completed }
fn parse_stats(stats: Vec<KitsuStatData>) -> (Option<KitsuAnimeStats>, Option<KitsuMangaStats>) {
    let mut anime_time: f64 = 0.0;
    let mut anime_completed: f64 = 0.0;
    let mut anime_genres: Vec<KitsuGenreEntry> = vec![];
    let mut has_anime = false;

    let mut manga_chapters: f64 = 0.0;
    let mut manga_completed: f64 = 0.0;
    let mut manga_genres: Vec<KitsuGenreEntry> = vec![];
    let mut has_manga = false;

    for stat in stats {
        let kind = stat.attributes.kind.as_str();
        let data = &stat.attributes.stats_data.0;

        match kind {
            "anime-amount-consumed" => {
                has_anime = true;
                anime_time = data["time"].as_f64().unwrap_or(0.0);
                anime_completed = data["completed"].as_f64().unwrap_or(0.0);
            }
            "anime-category-breakdown" => {
                // categories lives one level deeper: statsData.categories
                if let Some(cats) = data["categories"].as_object() {
                    anime_genres = cats
                        .iter()
                        .map(|(genre, count)| KitsuGenreEntry {
                            genre: genre.clone(),
                            count: count.as_f64().unwrap_or(0.0),
                        })
                        .filter(|e| e.count > 0.0)
                        .collect();
                    anime_genres.sort_by(|a, b| {
                        b.count
                            .partial_cmp(&a.count)
                            .unwrap_or(std::cmp::Ordering::Equal)
                    });
                }
            }
            "manga-amount-consumed" => {
                has_manga = true;
                manga_chapters = data["media"].as_f64().unwrap_or(0.0);
                manga_completed = data["completed"].as_f64().unwrap_or(0.0);
            }
            "manga-category-breakdown" => {
                if let Some(cats) = data["categories"].as_object() {
                    manga_genres = cats
                        .iter()
                        .map(|(genre, count)| KitsuGenreEntry {
                            genre: genre.clone(),
                            count: count.as_f64().unwrap_or(0.0),
                        })
                        .filter(|e| e.count > 0.0)
                        .collect();
                    manga_genres.sort_by(|a, b| {
                        b.count
                            .partial_cmp(&a.count)
                            .unwrap_or(std::cmp::Ordering::Equal)
                    });
                }
            }
            _ => {}
        }
    }

    let anime = has_anime.then_some(KitsuAnimeStats {
        time_spent_seconds: anime_time,
        completed: anime_completed,
        genre_breakdown: anime_genres,
    });

    let manga = has_manga.then_some(KitsuMangaStats {
        chapters_read: manga_chapters,
        completed: manga_completed,
        genre_breakdown: manga_genres,
    });

    (anime, manga)
}
