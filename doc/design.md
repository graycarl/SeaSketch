# SeaSketch Design Document

## 1. Requirement Summary
- macOS desktop app named **SeaSketch** built with **Tauri + React**
- Users author Mermaid diagrams locally with delayed live preview (1 second after typing stops)
- App maintains an internal hierarchy: **Groups** contain **Files**; files store Mermaid text
- Support create/rename/delete for both groups and files
- Persist entire structure and contents via **Tauri storage plugin** so state survives restarts

## 2. System Architecture
```
┌───────────────────────────────────────────────────┐
│ React Frontend                                    │
│  - Group/File tree component                      │
│  - Editor component (textarea or Monaco)          │
│  - Preview component (mermaid.js)                 │
│  - Global state (Context/Zustand)                 │
└────────────┬──────────────────────────────────────┘
             │ Tauri commands (loadState/saveState)
┌────────────▼──────────────────────────────────────┐
│ Tauri Backend (Rust)                              │
│  - Registers storage plugin                       │
│  - Exposes commands for loading/saving state      │
└────────────┬──────────────────────────────────────┘
             │ Storage plugin API                   
┌────────────▼──────────────────────────────────────┐
│ Persistent Store (JSON in app data directory)     │
└───────────────────────────────────────────────────┘
```

### Data Model
```ts
interface FileNode {
  id: string;
  name: string;
  content: string; // Mermaid text
}

interface GroupNode {
  id: string;
  name: string;
  files: FileNode[];
}

interface AppState {
  groups: GroupNode[];
  currentGroupId: string | null;
  currentFileId: string | null;
}
```

## 3. Frontend Design
### Layout
- **Sidebar (left)**: tree of groups and their files with CRUD actions
- **Editor (center)**: Mermaid text editor; inline rename for file name
- **Preview (right)**: renders SVG/HTML output via `mermaid.render`

### State Management
- Use React Context or Zustand to hold `AppState`
- Provide actions: `createGroup`, `renameGroup`, `deleteGroup`, `createFile`, `renameFile`, `deleteFile`, `selectFile`, `updateContent`
- Hook `useEffect` on state changes to call `saveState` (debounced to avoid thrashing)

### Debounced Preview
- `useEffect` watching `currentFile.content`
- On change, start `setTimeout` (1s) before invoking `renderMermaid`
- Cancel timeout on unmount or further edits
- On render success: update preview HTML
- On error: log and show error message while preserving last good render

## 4. Backend (Tauri) Design
- Enable `@tauri-apps/plugin-store` in `tauri.conf.json`
- Rust commands:
  - `#[tauri::command] async fn load_state(store: State<'_, Store>) -> Result<AppState, String>`
  - `#[tauri::command] async fn save_state(store: State<'_, Store>, state: AppState) -> Result<(), String>`
- `Store` file path (e.g., `seasketch-state.json`) lives in app data directory
- On load, if file missing/empty → create default state with one group & file

## 5. Persistence Strategy
- Frontend invokes `load_state` on startup → populate context
- All mutations funnel through dispatcher that updates context and triggers `save_state`
- Consider debouncing persistence (e.g., 300ms) to reduce I/O

## 6. Error Handling & UX
- Show spinner/placeholders while loading initial state
- Surface Mermaid parse errors in preview pane with friendly message
- Confirm destructive operations (delete group/file)
- If persistence fails, show toast and retry option

## 7. Task Breakdown
1. **Project Setup**
   - `pnpm create tauri-app seasketch` (React + TS)
   - Configure app metadata (name, identifiers)
2. **Dependencies**
   - Add `@tauri-apps/plugin-store`, `mermaid`, optional `zustand` and `react-monaco-editor`
3. **Tauri Backend**
   - Register store plugin, implement `load_state` / `save_state`
4. **State Layer**
   - Define TypeScript interfaces and Zustand/Context store with actions
5. **UI Components**
   - Sidebar for group/file tree with CRUD controls
   - Editor component with content binding
   - Preview component using Mermaid render + debounce
6. **Persistence Wiring**
   - On startup load data, on changes persist
7. **UX Polish**
   - Loading/error states, confirmation dialogs, keyboard shortcuts
8. **Testing & Packaging**
   - Validate creation/deletion flows, persistence, preview accuracy
   - Build macOS bundle via `tauri build`
