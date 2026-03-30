# SeaSketch Agent Notes

必须使用中文和用户对话。

## Project Goals
- Build "SeaSketch", a Tauri + React macOS app for editing Mermaid diagrams with delayed live preview.
- Provide in-app management of diagram files organized by user-defined folders.

## Key Requirements Recap
1. **Editor + Preview**
   - Text editor for Mermaid syntax
   - Preview refreshes 1 second after typing stops
   - Handle render errors gracefully
2. **Folder/File Hierarchy**
   - Folders can be created, renamed, deleted
   - Files exist within folders; support create/rename/delete per file
   - Each file stores Mermaid text content
3. **Persistence**
   - Use the Tauri storage plugin to persist the entire state (folders, files, content)
   - Load persisted state on startup; bootstrap default structures when empty

## Architecture Snapshot
- **Frontend**: React + state management (Context/Zustand) for hierarchy and editor state
- **Preview**: Mermaid.js rendered inside React component with 1s debounce effect
- **Backend**: Tauri commands invoking the storage plugin for load/save

## Implementation Notes for Agents
- Ensure `@tauri-apps/plugin-store` is configured and available from both Rust and JS sides
- Centralize state persistence through a `saveState` helper to avoid duplicated calls
- Provide UX cues (e.g., loading indicators, error toasts) when state is loading or render fails

## Build Verification
在修改完代码后，按顺序执行以下命令确认编译通过：
1. **运行完整测试套件**：`npm run test:all`（推荐，验证前后端所有测试）
2. 前端测试：`npm run test`
3. Rust 后端测试：`npm run test:rust`
4. 前端构建：`npm run build`
5. Rust 后端检查：`cd src-tauri && cargo check`

### 测试规范
- **工具函数**：所有新添加的纯函数必须在 `src/utils/*.test.ts` 中编写对应测试
- **Store 逻辑**：核心状态变更逻辑必须在 `src/store.test.ts` 中覆盖
- **Rust 命令**：文件系统操作等可测试逻辑必须在 `src-tauri/src/lib_test.rs` 中覆盖
- **测试失败修复**：如果测试失败，优先修复代码而非跳过或删除测试
