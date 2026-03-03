use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Runtime};
use tauri_plugin_store::{Store, StoreExt};
use uuid::Uuid;

const STORE_PATH: &str = "seasketch-state.json";
const STORE_KEY: &str = "state";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub id: String,
    pub name: String,
    pub content: String,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![load_state, save_state])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
