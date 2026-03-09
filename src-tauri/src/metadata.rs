use reqwest::Client;
use serde::{Deserialize, Serialize};

const ANILIST_URL: &str = "https://graphql.anilist.co";
const MAL_URL: &str = "https://api.myanimelist.net/v2/anime";

#[derive(Deserialize)]
struct AniListPageResponse {
    data: Option<AniListPageData>,
}

#[derive(Deserialize)]
struct AniListPageData {
    #[serde(rename = "Page")]
    page: Option<AniListPage>,
}

#[derive(Deserialize)]
struct AniListPage {
    media: Option<Vec<AniListMedia>>,
}
#[derive(Serialize)]
struct GraphQLQuery {
    query: String,
    variables: serde_json::Value,
}

/// Full response wrapper from AniList
#[derive(Deserialize)]
struct AniListResponse {
    data: Option<AniListData>,
}

#[derive(Deserialize)]
struct AniListData {
    #[serde(rename = "Media")]
    media: Option<AniListMedia>,
}

/// The actual anime data we get back from AniList
#[derive(Deserialize)]
struct AniListMedia {
    id: Option<i64>,
    title: Option<AniListTitle>,
    description: Option<String>,
    episodes: Option<i32>,
    #[serde(rename = "averageScore")]
    average_score: Option<f64>,
    #[serde(rename = "coverImage")]
    cover_image: Option<AniListCoverImage>,
    genres: Option<Vec<String>>,
    status: Option<String>,
    format: Option<String>,
    season_year: Option<i32>,
}

#[derive(Deserialize)]
struct AniListTitle {
    romaji: Option<String>,
    english: Option<String>,
    native: Option<String>,
}

#[derive(Deserialize)]
struct AniListCoverImage {
    large: Option<String>,
    medium: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SeriesMetadata {
    pub anilist_id: i64,
    pub title: String,
    pub title_english: Option<String>,
    pub title_native: Option<String>,
    pub synopsis: Option<String>,
    pub episode_count: Option<i32>,
    pub anilist_score: Option<f64>,
    pub cover_url: Option<String>,
    pub genres: Vec<String>,
    pub status: Option<String>,
    pub format: Option<String>,
    pub season_year: Option<i32>,
}

/// Strips HTML tags from AniList synopsis
/// AniList wraps descriptions in <br> and <i> tags sometimes
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

/// MAL API response structs
#[derive(Deserialize)]
struct MalSearchResponse {
    data: Option<Vec<MalSearchNode>>,
}

#[derive(Deserialize)]
struct MalSearchNode {
    node: Option<MalAnime>,
}

#[derive(Deserialize)]
struct MalAnime {
    id: Option<i64>,
    title: Option<String>,
    main_picture: Option<MalPicture>,
    alternative_titles: Option<MalAlternativeTitles>,
    synopsis: Option<String>,
    num_episodes: Option<i32>,
    mean: Option<f64>,
    genres: Option<Vec<MalGenre>>,
    status: Option<String>,
    media_type: Option<String>,
    start_season: Option<MalSeason>,
}

#[derive(Deserialize)]
struct MalPicture {
    large: Option<String>,
    medium: Option<String>,
}

#[derive(Deserialize)]
struct MalAlternativeTitles {
    en: Option<String>,
    ja: Option<String>,
}

#[derive(Deserialize)]
struct MalGenre {
    name: String,
}

#[derive(Deserialize)]
struct MalSeason {
    year: Option<i32>,
}

/// MAL metadata result — mirrors SeriesMetadata shape
#[derive(Debug, Serialize, Clone)]
pub struct MalMetadata {
    pub mal_id: i64,
    pub title: String,
    pub title_english: Option<String>,
    pub title_native: Option<String>,
    pub synopsis: Option<String>,
    pub episode_count: Option<i32>,
    pub mal_score: Option<f64>,
    pub cover_url: Option<String>,
    pub genres: Vec<String>,
    pub status: Option<String>,
    pub format: Option<String>,
    pub season_year: Option<i32>,
}

/// Main fetch function — searches AniList by title
/// Returns the best matching result or an error message
pub async fn fetch_anilist_metadata(title: &str) -> Result<SeriesMetadata, String> {
    // The GraphQL query we send to AniList
    // We search by title and request only the fields we need
    let query = r#"
        query ($search: String) {
            Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
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
            }
        }
    "#
    .to_string();

    let variables = serde_json::json!({
        "search": title
    });

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .post(ANILIST_URL)
        .header("Content-Type", "application/json")
        .json(&GraphQLQuery { query, variables })
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let body: AniListResponse = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    // Drill into the response
    let media = body
        .data
        .and_then(|d| d.media)
        .ok_or_else(|| format!("No results found for '{}'", title))?;

    // Extract title — prefer romaji, fall back to english, then "Unknown"
    let display_title = media
        .title
        .as_ref()
        .and_then(|t| t.romaji.clone().or_else(|| t.english.clone()))
        .unwrap_or_else(|| title.to_string());

    let title_english = media.title.as_ref().and_then(|t| t.english.clone());

    let title_native = media.title.as_ref().and_then(|t| t.native.clone());

    // Clean the synopsis of any HTML tags
    let synopsis = media.description.map(|d| strip_html(&d));

    // Prefer large cover, fall back to medium
    let cover_url = media.cover_image.and_then(|c| c.large.or(c.medium));

    // Normalize score from 0-100 to 0-10 for consistency
    let anilist_score = media
        .average_score
        .map(|s| (s / 10.0 * 10.0).round() / 10.0);

    Ok(SeriesMetadata {
        anilist_id: media.id.unwrap_or(0),
        title: display_title,
        title_english,
        title_native,
        synopsis,
        episode_count: media.episodes,
        anilist_score,
        cover_url,
        genres: media.genres.unwrap_or_default(),
        status: media.status,
        format: media.format,
        season_year: media.season_year,
    })
}

pub async fn search_anime_multi(title: &str) -> Result<Vec<SeriesMetadata>, String> {
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
    "#
    .to_string();

    let variables = serde_json::json!({ "search": title });

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .post(ANILIST_URL)
        .header("Content-Type", "application/json")
        .json(&GraphQLQuery { query, variables })
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let body: AniListPageResponse = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let media_list = body
        .data
        .and_then(|d| d.page)
        .and_then(|p| p.media)
        .unwrap_or_default();

    if media_list.is_empty() {
        return Err(format!("No results found for '{}'", title));
    }

    let results = media_list
        .into_iter()
        .map(|media| {
            let display_title = media
                .title
                .as_ref()
                .and_then(|t| t.romaji.clone().or_else(|| t.english.clone()))
                .unwrap_or_else(|| title.to_string());

            let title_english = media.title.as_ref().and_then(|t| t.english.clone());
            let title_native = media.title.as_ref().and_then(|t| t.native.clone());
            let synopsis = media.description.map(|d| strip_html(&d));
            let cover_url = media.cover_image.and_then(|c| c.large.or(c.medium));
            let anilist_score = media
                .average_score
                .map(|s| (s / 10.0 * 10.0).round() / 10.0);

            SeriesMetadata {
                anilist_id: media.id.unwrap_or(0),
                title: display_title,
                title_english,
                title_native,
                synopsis,
                episode_count: media.episodes,
                anilist_score,
                cover_url,
                genres: media.genres.unwrap_or_default(),
                status: media.status,
                format: media.format,
                season_year: media.season_year,
            }
        })
        .collect();

    Ok(results)
}

/// Searches MAL by title — returns up to 5 results
/// Requires a MAL Client ID passed in from settings
pub async fn search_mal_multi(title: &str, client_id: &str) -> Result<Vec<MalMetadata>, String> {
    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let url = format!(
        "{}?q={}&limit=5&fields=id,title,alternative_titles,main_picture,\
         synopsis,num_episodes,mean,genres,status,media_type,start_season",
        MAL_URL,
        urlencoding::encode(title)
    );

    let response = client
        .get(&url)
        .header("X-MAL-CLIENT-ID", client_id)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "MAL API error: {} — check your Client ID in Settings",
            response.status()
        ));
    }

    let body: MalSearchResponse = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let nodes = body.data.unwrap_or_default();

    if nodes.is_empty() {
        return Err(format!("No MAL results found for '{}'", title));
    }

    let results = nodes
        .into_iter()
        .filter_map(|node| node.node)
        .map(|anime| {
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
            let cover_url = anime.main_picture.and_then(|p| p.large.or(p.medium));
            let genres = anime
                .genres
                .unwrap_or_default()
                .into_iter()
                .map(|g| g.name)
                .collect();
            let season_year = anime.start_season.and_then(|s| s.year);

            MalMetadata {
                mal_id: anime.id.unwrap_or(0),
                title,
                title_english,
                title_native,
                synopsis: anime.synopsis,
                episode_count: anime.num_episodes,
                mal_score: anime.mean,
                cover_url,
                genres,
                status: anime.status,
                format: anime.media_type,
                season_year,
            }
        })
        .collect();

    Ok(results)
}

// ─── Kitsu ────────────────────────────────────────────────────────────────────
// Kitsu uses the JSON:API spec, so the response shape is different from
// AniList/MAL. Genres come via an `include=categories` sideload.

#[derive(Deserialize)]
struct KitsuSearchResponse {
    data: Option<Vec<KitsuAnimeData>>,
    included: Option<Vec<KitsuIncluded>>,
}

#[derive(Deserialize)]
struct KitsuAnimeData {
    id: Option<String>,
    attributes: Option<KitsuAttributes>,
    relationships: Option<KitsuRelationships>,
}

#[derive(Deserialize)]
struct KitsuAttributes {
    #[serde(rename = "canonicalTitle")]
    canonical_title: Option<String>,
    titles: Option<KitsuTitles>,
    synopsis: Option<String>,
    #[serde(rename = "episodeCount")]
    episode_count: Option<i32>,
    #[serde(rename = "averageRating")]
    average_rating: Option<String>, // e.g. "82.67" — Kitsu returns a string
    #[serde(rename = "posterImage")]
    poster_image: Option<KitsuImage>,
    status: Option<String>,
    subtype: Option<String>,    // "TV", "OVA", "movie", etc.
    #[serde(rename = "startDate")]
    start_date: Option<String>, // "YYYY-MM-DD"
}

#[derive(Deserialize)]
struct KitsuTitles {
    en: Option<String>,
    en_jp: Option<String>,
    ja_jp: Option<String>,
}

#[derive(Deserialize)]
struct KitsuImage {
    large: Option<String>,
    medium: Option<String>,
    original: Option<String>,
}

#[derive(Deserialize)]
struct KitsuRelationships {
    categories: Option<KitsuCategoryRel>,
}

#[derive(Deserialize)]
struct KitsuCategoryRel {
    data: Option<Vec<KitsuRelData>>,
}

#[derive(Deserialize)]
struct KitsuRelData {
    id: String,
}

/// Sideloaded record from the `included` array (categories, etc.)
#[derive(Deserialize)]
struct KitsuIncluded {
    id: Option<String>,
    #[serde(rename = "type")]
    kind: Option<String>,
    attributes: Option<KitsuIncludedAttributes>,
}

#[derive(Deserialize)]
struct KitsuIncludedAttributes {
    title: Option<String>, // category name
}

/// Public metadata result for a Kitsu anime — mirrors MalMetadata shape
#[derive(Debug, Serialize, Clone)]
pub struct KitsuMetadata {
    pub kitsu_id: i64,
    pub title: String,
    pub title_english: Option<String>,
    pub title_native: Option<String>,
    pub synopsis: Option<String>,
    pub episode_count: Option<i32>,
    pub kitsu_score: Option<f64>,
    pub cover_url: Option<String>,
    pub genres: Vec<String>,
    pub status: Option<String>,
    pub format: Option<String>,
    pub season_year: Option<i32>,
}

/// Searches Kitsu for up to 8 results by title.
/// No API key required — Kitsu's edge API is public.
pub async fn search_kitsu_multi(title: &str) -> Result<Vec<KitsuMetadata>, String> {
    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    // include=categories sidecars the genre data in a single request
    let url = format!(
        "https://kitsu.io/api/edge/anime?filter[text]={}&page[limit]=8&include=categories",
        urlencoding::encode(title)
    );

    let response = client
        .get(&url)
        .header("Accept", "application/vnd.api+json")
        .header("Content-Type", "application/vnd.api+json")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Kitsu API error: {}", response.status()));
    }

    let body: KitsuSearchResponse = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let anime_list = body.data.unwrap_or_default();

    if anime_list.is_empty() {
        return Err(format!("No Kitsu results found for '{}'", title));
    }

    // Build id → name map from the sideloaded categories
    let category_map: std::collections::HashMap<String, String> = body
        .included
        .unwrap_or_default()
        .into_iter()
        .filter(|inc| inc.kind.as_deref() == Some("categories"))
        .filter_map(|inc| Some((inc.id?, inc.attributes?.title?)))
        .collect();

    let results = anime_list
        .into_iter()
        .filter_map(|anime| {
            let attrs = anime.attributes?;
            let kitsu_id: i64 = anime.id?.parse().unwrap_or(0);

            // Prefer canonicalTitle, then romanised en_jp, then English
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

            // averageRating is "0.00"–"100.00"; normalise to 0–10
            let kitsu_score = attrs
                .average_rating
                .as_ref()
                .and_then(|s| s.parse::<f64>().ok())
                .map(|s| (s / 10.0).round() / 1.0); // one decimal place

            // Prefer large poster, fall back to medium, then original
            let cover_url = attrs
                .poster_image
                .and_then(|img| img.large.or(img.medium).or(img.original));

            // Extract year from "YYYY-MM-DD"
            let season_year = attrs
                .start_date
                .as_ref()
                .and_then(|d| d.split('-').next())
                .and_then(|y| y.parse::<i32>().ok());

            // Resolve genres via the category relationship IDs
            let genres = anime
                .relationships
                .and_then(|r| r.categories)
                .and_then(|c| c.data)
                .unwrap_or_default()
                .into_iter()
                .filter_map(|rel| category_map.get(&rel.id).cloned())
                .collect();

            Some(KitsuMetadata {
                kitsu_id,
                title: display_title,
                title_english,
                title_native,
                synopsis: attrs.synopsis,
                episode_count: attrs.episode_count,
                kitsu_score,
                cover_url,
                genres,
                status: attrs.status,
                format: attrs.subtype,
                season_year,
            })
        })
        .collect();

    Ok(results)
}

/// Downloads a cover image and saves it locally
/// Returns the local file path
pub async fn download_cover(
    cover_url: &str,
    series_title: &str,
    force_refresh: bool,
) -> Result<String, String> {
    // Build the local covers directory path
    let mut covers_dir = dirs::data_dir().ok_or("Could not find app data directory")?;
    covers_dir.push("ru-anishelf");
    covers_dir.push("covers");

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&covers_dir)
        .map_err(|e| format!("Failed to create covers dir: {}", e))?;

    // Sanitize the title for use as a filename
    let safe_title = series_title
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>();

    let file_name = format!("{}.jpg", safe_title);
    let file_path = covers_dir.join(&file_name);

    // Skip download if already cached — unless force_refresh is set
    // (e.g. when rescanning with a different metadata source)
    if file_path.exists() && !force_refresh {
        return Ok(file_path.to_string_lossy().to_string());
    }

    // Download the image
    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;

    let bytes = client
        .get(cover_url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?
        .bytes()
        .await
        .map_err(|e| format!("Failed to read bytes: {}", e))?;

    std::fs::write(&file_path, &bytes).map_err(|e| format!("Failed to save cover: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}