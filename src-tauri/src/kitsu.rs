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
// =============================================================================

use serde::{Deserialize, Serialize};

// ─── 1. Kitsu API deserialisation types ───────────────────────────────────────
// These mirror the raw JSON:API response. Fields use the Kitsu camelCase names
// mapped via serde rename so our Rust structs stay snake_case.

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

#[derive(Deserialize, Debug)]
struct KitsuUserAttributes {
    name: String,
    slug: String,
    about: Option<String>,
    location: Option<String>,
    gender: Option<String>,
    birthday: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: Option<String>,
    avatar: Option<KitsuImageSet>,
    #[serde(rename = "coverImage")]
    cover_image: Option<KitsuImageSet>,
    #[serde(rename = "waifuOrHusbando")]
    waifu_or_husbando: Option<String>,
}

#[derive(Deserialize, Debug)]
struct KitsuImageSet {
    small: Option<String>,
    medium: Option<String>,
    large: Option<String>,
    original: Option<String>,
}

impl KitsuImageSet {
    /// Returns the best available image URL, preferring larger sizes
    fn best_url(self) -> Option<String> {
        self.large.or(self.original).or(self.medium).or(self.small)
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
    #[serde(rename = "type")]
    resource_type: String,
}

/// Included side-loaded resources (e.g. waifu character object)
#[derive(Deserialize, Debug)]
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

// ─── Stats response ────────────────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
struct KitsuStatsResponse {
    data: Vec<KitsuStatData>,
}

#[derive(Deserialize, Debug)]
struct KitsuStatData {
    attributes: KitsuStatAttributes,
}

#[derive(Deserialize, Debug)]
struct KitsuStatAttributes {
    #[serde(rename = "statType")]
    stat_type: String,
    value: serde_json::Value,
}

// ─── 2. Output types ─────────────────────────────────────────────────────────
// These derive Serialize so Tauri can return them directly to the frontend.

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
    /// Raw label: "Waifu" or "Husbando"
    pub waifu_or_husbando: Option<String>,
    /// The character's display name
    pub waifu_name: Option<String>,
    /// The character's image URL
    pub waifu_image_url: Option<String>,
    pub anime_stats: Option<KitsuAnimeStats>,
    pub manga_stats: Option<KitsuMangaStats>,
}

#[derive(Serialize, Debug)]
pub struct KitsuAnimeStats {
    /// Raw seconds — divide by 86400 on the frontend to get days
    pub time_spent_seconds: f64,
    pub completed: f64,
    /// Sorted descending by count
    pub genre_breakdown: Vec<KitsuGenreEntry>,
}

#[derive(Serialize, Debug)]
pub struct KitsuMangaStats {
    pub chapters_read: f64,
    pub completed: f64,
    /// Sorted descending by count
    pub genre_breakdown: Vec<KitsuGenreEntry>,
}

#[derive(Serialize, Debug)]
pub struct KitsuGenreEntry {
    pub genre: String,
    pub count: f64,
}

// ─── 3. Public fetch function ─────────────────────────────────────────────────

/// Fetches a public Kitsu user profile and their anime/manga stats.
/// Makes two sequential requests: one for profile + waifu, one for stats.
pub async fn fetch_kitsu_profile(username: &str) -> Result<KitsuProfile, String> {
    let client = reqwest::Client::builder()
        .user_agent("ru-anishelf/1.0")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // ── Request 1: User profile + waifu character ──────────────────────────
    // Try slug first (matches the kitsu.app/users/my-slug URL format).
    // If that returns no results, fall back to display name search.
    let user_body = fetch_user(&client, "slug", username).await?;

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

    // ── Request 2: User stats ──────────────────────────────────────────────
    let stats_url = format!("https://kitsu.app/api/edge/users/{}/stats", user.id);

    let stats_resp = client
        .get(&stats_url)
        .header("Accept", "application/vnd.api+json")
        .send()
        .await
        .map_err(|e| format!("Network error fetching stats: {}", e))?;

    let stats_body: KitsuStatsResponse = stats_resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse stats response: {}", e))?;

    let (anime_stats, manga_stats) = parse_stats(stats_body.data);

    Ok(KitsuProfile {
        id: user.id,
        name: attrs.name,
        slug: attrs.slug,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

    resp.json::<KitsuUserResponse>()
        .await
        .map_err(|e| format!("Failed to parse profile response: {}", e))
}

/// Extracts waifu name and image from the included sideloaded resources
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

/// Parses the flat stats array into typed anime and manga stat structs
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
        let val = &stat.attributes.value;
        match stat.attributes.stat_type.as_str() {
            "anime-amount-consumed" => {
                has_anime = true;
                anime_time = val["time"].as_f64().unwrap_or(0.0);
                anime_completed = val["completed"].as_f64().unwrap_or(0.0);
            }
            "anime-category-breakdown" => {
                if let Some(obj) = val.as_object() {
                    anime_genres = obj
                        .iter()
                        .map(|(genre, count)| KitsuGenreEntry {
                            genre: genre.clone(),
                            count: count.as_f64().unwrap_or(0.0),
                        })
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
                // `media` = number of chapters read in the Kitsu stats schema
                manga_chapters = val["media"].as_f64().unwrap_or(0.0);
                manga_completed = val["completed"].as_f64().unwrap_or(0.0);
            }
            "manga-category-breakdown" => {
                if let Some(obj) = val.as_object() {
                    manga_genres = obj
                        .iter()
                        .map(|(genre, count)| KitsuGenreEntry {
                            genre: genre.clone(),
                            count: count.as_f64().unwrap_or(0.0),
                        })
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
