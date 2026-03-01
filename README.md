# SeaSketch

SeaSketch is a macOS application built with Tauri and React that lets you author Mermaid diagrams locally with real-time preview.

## Overview
- **Target platform**: macOS (Tauri desktop app)
- **UI stack**: React (frontend) + Tauri (Rust backend)
- **Core capability**: Edit Mermaid diagram text and preview it live after 1 second of idle time
- **Data model**: Folders contain files; each file stores Mermaid content
- **Persistence**: Uses the Tauri storage plugin to persist folders/files locally

## Key Features
1. **Mermaid editor with delayed live preview**
   - Users type Mermaid syntax; when typing stops for 1 second the preview re-renders
   - Errors during rendering are surfaced without clearing the last successful preview
2. **Folder and file management**
   - Create/rename/delete folders
   - Each folder manages its own list of files (create/rename/delete)
   - Files belong to exactly one folder
3. **Local persistence**
   - Entire folder/file tree, including each file's Mermaid content, is saved via the Tauri storage plugin
   - On app launch, existing data is loaded; a default folder/file is created if none exist

## High-Level Architecture
```
React UI (Folder/File tree, editor, preview)
  │
  ├─ Zustand/Context state for folders/files/current file
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
4. Build React state layer for folders/files and current selection
5. Implement Folder/File management UI
6. Implement the editor + 1s debounce preview and error handling
7. Hook persistence into every structural/content change
8. Polish UI, test flows, package for macOS

---

# Development Notes

This repo uses the official **Tauri + React + TypeScript (Vite)** template as the starting point.

## Recommended IDE Setup
- [VS Code](https://code.visualstudio.com/) with the [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Useful Scripts
- `npm run dev` – start the Vite dev server
- `npm run tauri dev` – run the Tauri desktop app in development
- `npm run build` – type-check and build the frontend
- `npm run tauri build` – produce a distributable macOS build

Package management is handled via **npm** (pnpm intentionally not installed).
