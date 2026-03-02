use reqwest::Client;
use serde::{Deserialize, Serialize};

/// The AniList GraphQL endpoint — all queries go here
const ANILIST_URL: &str = "https://graphql.anilist.co";

/// What we send TO AniList
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

/// Clean struct we return to React — only what we need
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
    })
}

/// Downloads a cover image and saves it locally
/// Returns the local file path
pub async fn download_cover(cover_url: &str, series_title: &str) -> Result<String, String> {
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

    // Skip download if already cached
    if file_path.exists() {
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
