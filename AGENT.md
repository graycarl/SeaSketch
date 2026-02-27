# SeaSketch Agent Notes

## Project Goals
- Build "SeaSketch", a Tauri + React macOS app for editing Mermaid diagrams with delayed live preview.
- Provide in-app management of diagram files grouped by user-defined collections.

## Key Requirements Recap
1. **Editor + Preview**
   - Text editor for Mermaid syntax
   - Preview refreshes 1 second after typing stops
   - Handle render errors gracefully
2. **Group/File Hierarchy**
   - Groups can be created, renamed, deleted
   - Files exist within groups; support create/rename/delete per file
   - Each file stores Mermaid text content
3. **Persistence**
   - Use the Tauri storage plugin to persist the entire state (groups, files, content)
   - Load persisted state on startup; bootstrap default structures when empty

## Architecture Snapshot
- **Frontend**: React + state management (Context/Zustand) for hierarchy and editor state
- **Preview**: Mermaid.js rendered inside React component with 1s debounce effect
- **Backend**: Tauri commands invoking the storage plugin for load/save

## Implementation Notes for Agents
- Ensure `@tauri-apps/plugin-store` is configured and available from both Rust and JS sides
- Centralize state persistence through a `saveState` helper to avoid duplicated calls
- Provide UX cues (e.g., loading indicators, error toasts) when state is loading or render fails
