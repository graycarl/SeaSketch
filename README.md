# SeaSketch

SeaSketch is a macOS application built with Tauri and React that lets you author Mermaid diagrams locally with real-time preview.

## Overview
- **Target platform**: macOS (Tauri desktop app)
- **UI stack**: React (frontend) + Tauri (Rust backend)
- **Core capability**: Edit Mermaid diagram text and preview it live after 1 second of idle time
- **Data model**: Groups contain files; each file stores Mermaid content
- **Persistence**: Uses the Tauri storage plugin to persist groups/files locally

## Key Features
1. **Mermaid editor with delayed live preview**
   - Users type Mermaid syntax; when typing stops for 1 second the preview re-renders
   - Errors during rendering are surfaced without clearing the last successful preview
2. **Group and file management**
   - Create/rename/delete groups
   - Each group manages its own list of files (create/rename/delete)
   - Files belong to exactly one group
3. **Local persistence**
   - Entire group/file tree, including each file's Mermaid content, is saved via the Tauri storage plugin
   - On app launch, existing data is loaded; a default group/file is created if none exist

## High-Level Architecture
```
React UI (Group/File tree, editor, preview)
  │
  ├─ Zustand/Context state for groups/files/current file
  │
  ├─ Mermaid preview component with 1s debounce
  │
Tauri commands + storage plugin
  │
Local JSON data persisted under app data dir
```

## Implementation Roadmap
1. Initialize a Tauri + React project (SeaSketch)
2. Install dependencies: `@tauri-apps/plugin-store`, `mermaid`, optional editor libs
3. Configure Tauri to expose `loadState` / `saveState` commands and register the store plugin
4. Build React state layer for groups/files and current selection
5. Implement Group/File management UI
6. Implement the editor + 1s debounce preview and error handling
7. Hook persistence into every structural/content change
8. Polish UI, test flows, package for macOS
