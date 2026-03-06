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
