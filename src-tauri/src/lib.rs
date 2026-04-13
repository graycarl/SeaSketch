use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_store::{Store, StoreExt};
use uuid::Uuid;

#[cfg(target_os = "macos")]
use std::process::Command;

mod oauth;

#[cfg(test)]
mod lib_test;

const STORE_PATH: &str = "seasketch-state.json";
const STORE_KEY: &str = "state";
const SETTINGS_KEY: &str = "settings";
const SETTINGS_PATH: &str = "seasketch-settings.json";
const CHAT_FILENAME: &str = "chat.md";
const ATTACHMENTS_DIR: &str = "attachments";
const MAX_ATTACHMENT_BYTES: usize = 5 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotEntry {
    pub id: String,
    pub created_at: String,
    pub note: Option<String>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub id: String,
    pub name: String,
    pub content: String,
    pub preview_background: Option<String>,
    pub snapshots: Option<Vec<SnapshotEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderNode {
    pub id: String,
    pub name: String,
    pub files: Vec<FileNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutState {
    pub sidebar_width: Option<f64>,
    pub editor_width: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppState {
    pub folders: Vec<FolderNode>,
    pub current_folder_id: Option<String>,
    pub current_file_id: Option<String>,
    #[serde(default)]
    pub layout: Option<LayoutState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub attachments: Option<Vec<String>>,
    pub applied_mermaid: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentMeta {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AISettings {
    pub ai_provider: String,
    pub openai_api_key: String,
    pub openai_api_host: String,
    pub openai_model: Option<String>,
    pub gemini_api_key: String,
    #[serde(default, rename = "geminiOAuth")]
    pub gemini_oauth: Option<oauth::OAuthCredentials>,
    pub gemini_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMeta {
    pub id: String,
    pub role: String,
    pub timestamp: String,
    pub attachments: Option<Vec<String>>,
    pub applied_mermaid: Option<bool>,
}

impl Default for AppState {
    fn default() -> Self {
        let folder_id = Uuid::new_v4().to_string();
        let file_id = Uuid::new_v4().to_string();
        Self {
            folders: vec![FolderNode {
                id: folder_id.clone(),
                name: "Default Folder".to_string(),
                files: vec![FileNode {
                    id: file_id.clone(),
                    name: "New Diagram".to_string(),
                    content: "graph TD\n    A[SeaSketch] --> B[Start];".to_string(),
                    preview_background: None,
                    snapshots: None,
                }],
            }],
            current_folder_id: Some(folder_id),
            current_file_id: Some(file_id),
            layout: None,
        }
    }
}

fn get_store<R: Runtime>(app: &AppHandle<R>) -> Result<Arc<Store<R>>, String> {
    app.store(STORE_PATH).map_err(|e| e.to_string())
}

fn get_settings_store<R: Runtime>(app: &AppHandle<R>) -> Result<Arc<Store<R>>, String> {
    app.store(SETTINGS_PATH).map_err(|e| e.to_string())
}

fn get_data_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())
        .map(|dir| dir.join("seasketch"))
}

fn file_workspace<R: Runtime>(
    app: &AppHandle<R>,
    folder_id: &str,
    file_id: &str,
) -> Result<PathBuf, String> {
    let base = get_data_root(app)?;
    Ok(base.join("diagrams").join(folder_id).join(file_id))
}

fn chat_path<R: Runtime>(
    app: &AppHandle<R>,
    folder_id: &str,
    file_id: &str,
) -> Result<PathBuf, String> {
    Ok(file_workspace(app, folder_id, file_id)?.join(CHAT_FILENAME))
}

fn attachments_dir<R: Runtime>(
    app: &AppHandle<R>,
    folder_id: &str,
    file_id: &str,
) -> Result<PathBuf, String> {
    Ok(file_workspace(app, folder_id, file_id)?.join(ATTACHMENTS_DIR))
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

fn parse_chat(contents: &str) -> Vec<ChatMessage> {
    let mut messages = Vec::new();
    let mut current_meta: Option<ChatMeta> = None;
    let mut current_content: Vec<String> = Vec::new();

    for line in contents.lines() {
        if let Some(meta_json) = line
            .strip_prefix("<!-- message: ")
            .and_then(|s| s.strip_suffix(" -->"))
        {
            if let Some(meta) = current_meta.take() {
                let content = current_content.join("\n").trim_end().to_string();
                messages.push(ChatMessage {
                    id: meta.id,
                    role: meta.role,
                    content,
                    timestamp: meta.timestamp,
                    attachments: meta.attachments,
                    applied_mermaid: meta.applied_mermaid,
                });
                current_content.clear();
            }
            let parsed: Result<ChatMeta, _> = serde_json::from_str(meta_json);
            if let Ok(meta) = parsed {
                current_meta = Some(meta);
            }
        } else {
            current_content.push(line.to_string());
        }
    }

    if let Some(meta) = current_meta {
        let content = current_content.join("\n").trim_end().to_string();
        messages.push(ChatMessage {
            id: meta.id,
            role: meta.role,
            content,
            timestamp: meta.timestamp,
            attachments: meta.attachments,
            applied_mermaid: meta.applied_mermaid,
        });
    }

    messages
}

fn format_message(message: &ChatMessage) -> Result<String, String> {
    let meta = ChatMeta {
        id: message.id.clone(),
        role: message.role.clone(),
        timestamp: message.timestamp.clone(),
        attachments: message.attachments.clone(),
        applied_mermaid: message.applied_mermaid,
    };
    let meta_json = serde_json::to_string(&meta).map_err(|e| e.to_string())?;
    Ok(format!(
        "<!-- message: {} -->\n{}\n\n",
        meta_json,
        message.content.trim_end()
    ))
}

#[tauri::command]
async fn load_state<R: Runtime>(app: AppHandle<R>) -> Result<AppState, String> {
    let store = get_store(&app)?;
    let value = store.get(STORE_KEY.to_string());
    match value {
        Some(data) => serde_json::from_value(data).map_err(|e| e.to_string()),
        None => Ok(AppState::default()),
    }
}

#[tauri::command]
async fn save_state<R: Runtime>(app: AppHandle<R>, state: AppState) -> Result<(), String> {
    let store = get_store(&app)?;
    let serialized = serde_json::to_value(state).map_err(|e| e.to_string())?;
    store.set(STORE_KEY.to_string(), serialized);
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn load_settings<R: Runtime>(app: AppHandle<R>) -> Result<AISettings, String> {
    let store = get_settings_store(&app)?;
    let value = store.get(SETTINGS_KEY.to_string());
    match value {
        Some(data) => {
            let settings: AISettings = serde_json::from_value(data).map_err(|e| e.to_string())?;
            // Migration: if ai_provider is empty, migrate from old format
            if settings.ai_provider.is_empty() {
                Ok(AISettings {
                    ai_provider: "openai".to_string(),
                    openai_api_key: settings.openai_api_key,
                    openai_api_host: if settings.openai_api_host.is_empty() {
                        "https://api.openai.com".to_string()
                    } else {
                        settings.openai_api_host
                    },
                    openai_model: Some("gpt-4o".to_string()),
                    gemini_api_key: String::new(),
                    gemini_oauth: None,
                    gemini_model: Some("gemini-3-flash-preview".to_string()),
                })
            } else {
                let mut settings = settings;
                if settings.openai_model.is_none() {
                    settings.openai_model = Some("gpt-4o".to_string());
                }
                if settings.gemini_model.is_none() {
                    settings.gemini_model = Some("gemini-3-flash-preview".to_string());
                }
                Ok(settings)
            }
        }
        None => Ok(AISettings {
            ai_provider: "openai".to_string(),
            openai_api_key: String::new(),
            openai_api_host: "https://api.openai.com".to_string(),
            openai_model: Some("gpt-4o".to_string()),
            gemini_api_key: String::new(),
            gemini_oauth: None,
            gemini_model: Some("gemini-3-flash-preview".to_string()),
        }),
    }
}

#[tauri::command]
async fn save_settings<R: Runtime>(app: AppHandle<R>, settings: AISettings) -> Result<(), String> {
    let store = get_settings_store(&app)?;
    let serialized = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    store.set(SETTINGS_KEY.to_string(), serialized);
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
async fn read_chat<R: Runtime>(
    app: AppHandle<R>,
    folder_id: String,
    file_id: String,
) -> Result<Vec<ChatMessage>, String> {
    let path = chat_path(&app, &folder_id, &file_id)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let contents = fs::read_to_string(path).map_err(|e| e.to_string())?;
    Ok(parse_chat(&contents))
}

#[tauri::command]
async fn append_chat<R: Runtime>(
    app: AppHandle<R>,
    folder_id: String,
    file_id: String,
    message: ChatMessage,
) -> Result<(), String> {
    let path = chat_path(&app, &folder_id, &file_id)?;
    ensure_parent(&path)?;
    let entry = format_message(&message)?;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    file.write_all(entry.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn clear_chat_only<R: Runtime>(
    app: AppHandle<R>,
    folder_id: String,
    file_id: String,
) -> Result<(), String> {
    let chat_file = chat_path(&app, &folder_id, &file_id)?;
    if chat_file.exists() {
        fs::remove_file(chat_file).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn delete_attachments<R: Runtime>(
    app: AppHandle<R>,
    folder_id: String,
    file_id: String,
) -> Result<(), String> {
    let attachments = attachments_dir(&app, &folder_id, &file_id)?;
    if attachments.exists() {
        fs::remove_dir_all(attachments).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn clear_chat<R: Runtime>(
    app: AppHandle<R>,
    folder_id: String,
    file_id: String,
) -> Result<(), String> {
    clear_chat_only(app.clone(), folder_id.clone(), file_id.clone()).await?;
    delete_attachments(app, folder_id, file_id).await?;
    Ok(())
}

#[tauri::command]
async fn list_attachments<R: Runtime>(
    app: AppHandle<R>,
    folder_id: String,
    file_id: String,
) -> Result<Vec<AttachmentMeta>, String> {
    let dir = attachments_dir(&app, &folder_id, &file_id)?;
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut results = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            let filename = path
                .file_name()
                .and_then(|v| v.to_str())
                .unwrap_or_default()
                .to_string();
            results.push(AttachmentMeta {
                id: filename.clone(),
                name: filename.clone(),
                filename,
                size: metadata.len() as usize,
            });
        }
    }
    Ok(results)
}

#[tauri::command]
async fn save_attachment<R: Runtime>(
    app: AppHandle<R>,
    folder_id: String,
    file_id: String,
    filename: String,
    content: String,
) -> Result<AttachmentMeta, String> {
    if content.len() > MAX_ATTACHMENT_BYTES {
        return Err("Attachment exceeds size limit".to_string());
    }
    let dir = attachments_dir(&app, &folder_id, &file_id)?;
    ensure_dir(&dir)?;
    let sanitized_name = filename.replace('/', "_");
    let path = dir.join(&sanitized_name);
    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(AttachmentMeta {
        id: sanitized_name.clone(),
        name: sanitized_name.clone(),
        filename: sanitized_name,
        size: content.len(),
    })
}

#[tauri::command]
async fn read_attachment<R: Runtime>(
    app: AppHandle<R>,
    folder_id: String,
    file_id: String,
    filename: String,
) -> Result<String, String> {
    let dir = attachments_dir(&app, &folder_id, &file_id)?;
    let path = dir.join(filename);
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_gemini_oauth<R: Runtime>(
    app: AppHandle<R>,
) -> Result<oauth::OAuthCredentials, String> {
    let app_clone = app.clone();
    oauth::start_oauth_flow(
        move |url| {
            let _ = app_clone.emit("oauth_url", url);
        },
        move |progress| {
            let _ = app.emit("oauth_progress", progress);
        },
    )
    .await
}

#[tauri::command]
async fn refresh_gemini_token(
    refresh_token: String,
    project_id: String,
) -> Result<oauth::OAuthCredentials, String> {
    let mut creds = oauth::refresh_token(&refresh_token).await?;
    creds.project_id = project_id;
    Ok(creds)
}

#[tauri::command]
async fn copy_svg_to_clipboard(svg_content: String, filename: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // Create a temporary file in the system temp directory
        let temp_dir = std::env::temp_dir();
        let svg_path = temp_dir.join(&filename);
        
        // Write the SVG content to the file
        fs::write(&svg_path, svg_content.as_bytes()).map_err(|e| e.to_string())?;
        
        // Use AppleScript to copy the file to clipboard (so it can be pasted as file)
        let path_str = svg_path.to_string_lossy().to_string();
        let script = format!(
            r#"set theFile to POSIX file "{}"
set theClipboard to {}
set the clipboard to theClipboard"#,
            path_str.replace("\"", "\\\""),
            "theFile"
        );
        
        Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| e.to_string())?;
        
        Ok(())
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err("Copy as file is only supported on macOS".to_string())
    }
}

#[tauri::command]
async fn write_blob_to_clipboard(blob: Vec<u8>, filename: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        
        // Save PNG to temp file
        let temp_dir = std::env::temp_dir();
        let png_path = temp_dir.join(filename);
        fs::write(&png_path, &blob).map_err(|e| format!("Failed to write temp file: {}", e))?;
        
        let path_str = png_path.to_string_lossy().to_string();
        
        // Use simple file reference copy first (works in many apps)
        let script1 = format!(
            r#"set theFile to POSIX file "{}"
set the clipboard to theFile"#,
            path_str.replace("\"", "\\\"")
        );
        
        let _ = Command::new("osascript")
            .args(["-e", &script1])
            .output();
        
        // Also try to set PNG data directly for apps that support it
        let script2 = format!(
            r#"try
    set pngData to read file "{}" as «class PNGf»
    set the clipboard to pngData
end try"#,
            path_str.replace("\"", "\\\"")
        );
        
        let output2 = Command::new("osascript")
            .args(["-e", &script2])
            .output();
        
        // Return success if at least one method worked
        match output2 {
            Ok(out) if out.status.success() => Ok(()),
            _ => {
                // Try file reference method
                let output1 = Command::new("osascript")
                    .args(["-e", &script1])
                    .output();
                match output1 {
                    Ok(out) if out.status.success() => Ok(()),
                    _ => Err("Failed to copy PNG to clipboard".to_string()),
                }
            }
        }
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err("Copy PNG to clipboard is only supported on macOS".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .menu(|app| {
            use tauri::menu::{Menu, MenuItem, Submenu};
            let settings_item =
                MenuItem::with_id(app, "open-settings", "Settings", true, None::<&str>)?;
            let menu = Menu::default(app)?;
            let ai_menu = Submenu::with_items(app, "AI", true, &[&settings_item])?;
            menu.append(&ai_menu)?;
            Ok(menu)
        })
        .on_menu_event(|app, event| {
            if event.id() == "open-settings" {
                let _ = app.emit("open-settings", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            load_settings,
            save_settings,
            read_chat,
            append_chat,
            clear_chat,
            clear_chat_only,
            delete_attachments,
            list_attachments,
            save_attachment,
            read_attachment,
            start_gemini_oauth,
            refresh_gemini_token,
            copy_svg_to_clipboard,
            write_blob_to_clipboard
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
