import { create } from "zustand";
import { nanoid } from "nanoid";
import { AppStateData, FolderNode, FileNode, ChatMessage, AttachmentMeta, AISettings } from "./types";
import { invoke } from "@tauri-apps/api/core";
import { SAMPLES_FOLDER_ID } from "./samples";

const DEFAULT_SIDEBAR_WIDTH = 217;
const DEFAULT_EDITOR_WIDTH = 416;
const DEFAULT_PREVIEW_BACKGROUND: "dark" | "light" = "dark";

const isPreviewBackground = (value: unknown): value is "dark" | "light" =>
  value === "dark" || value === "light";

const normalizeFolders = (folders: FolderNode[]): FolderNode[] =>
  (folders.map((folder) => {
    const files: FileNode[] = folder.files.map((file) => {
      const previewBackground: "dark" | "light" = isPreviewBackground(file.previewBackground)
        ? file.previewBackground
        : DEFAULT_PREVIEW_BACKGROUND;
      return {
        ...file,
        previewBackground,
      };
    });
    return {
      ...folder,
      files,
    };
  }) as FolderNode[]);

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const getStateSnapshot = (
  folders: FolderNode[],
  currentFolderId: string | null,
  currentFileId: string | null,
  layout?: AppStateData["layout"],
): AppStateData => ({
  folders,
  currentFolderId,
  currentFileId,
  layout,
});

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
  visible: boolean;
}

interface SeaSketchStore extends AppStateData {
  isLoading: boolean;
  hasLoaded: boolean;
  // Volatile in-memory overrides for sample file content (not persisted)
  sampleContents: Record<string, string>;
  sampleBackgrounds: Record<string, "dark" | "light">;
  previewSnapshot: { svg: string; error: string | null };
  chatByFileId: Record<string, ChatMessage[]>;
  attachmentsByFileId: Record<string, AttachmentMeta[]>;
  isChatLoadingByFileId: Record<string, boolean>;
  settings: AISettings;
  isSettingsOpen: boolean;
  toast: ToastState;
  showToast: (message: string, type?: ToastState["type"]) => void;
  hideToast: () => void;
  selectFile: (folderId: string, fileId: string) => void;
  setChatLoading: (fileId: string, isLoading: boolean) => void;
  createFolder: () => void;
  renameFolder: (folderId: string, name: string) => void;
  deleteFolder: (folderId: string) => void;
  createFile: (folderId: string) => void;
  renameFile: (folderId: string, fileId: string, name: string) => void;
  deleteFile: (folderId: string, fileId: string) => void;
  updateFileContent: (folderId: string, fileId: string, content: string) => void;
  updateSampleContent: (fileId: string, content: string) => void;
  updateLayout: (layout: AppStateData["layout"]) => void;
  togglePreviewBackground: () => Promise<void>;
  setPreviewSnapshot: (snapshot: { svg: string; error: string | null }) => void;
  loadChatForFile: (folderId: string, fileId: string) => Promise<void>;
  appendChatMessage: (folderId: string, fileId: string, message: ChatMessage) => Promise<void>;
  clearChatForFile: (folderId: string, fileId: string) => Promise<void>;
  deleteAttachmentsForFile: (folderId: string, fileId: string) => Promise<void>;
  loadAttachmentsForFile: (folderId: string, fileId: string) => Promise<void>;
  saveAttachment: (folderId: string, fileId: string, filename: string, content: string) => Promise<AttachmentMeta>;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: AISettings) => Promise<void>;
  updateAIProvider: (provider: AISettings["aiProvider"]) => Promise<void>;
  openSettings: () => void;
  closeSettings: () => void;
  loadState: () => Promise<void>;
  saveState: () => Promise<void>;
  saveStateImmediateWithRetry: () => Promise<void>;
}

const debouncedSave = (() => {
  let timer: number | undefined;
  return (state: AppStateData) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      invoke("save_state", { state });
    }, 300);
  };
})();

const createDefaultState = (): AppStateData => {
  const folderId = nanoid();
  const fileId = nanoid();
  return {
    folders: [
      {
        id: folderId,
        name: "Default Folder",
        files: [
          {
            id: fileId,
            name: "New Diagram",
            content: "graph TD\n    A[SeaSketch] --> B[Diagram];",
            previewBackground: DEFAULT_PREVIEW_BACKGROUND,
          },
        ],
      },
    ],
    currentFolderId: folderId,
    currentFileId: fileId,
    layout: {
      sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      editorWidth: DEFAULT_EDITOR_WIDTH,
    },
  };
};

export const useSeaSketchStore = create<SeaSketchStore>((set, get) => ({
  ...createDefaultState(),
  isLoading: true,
  hasLoaded: false,
  sampleContents: {},
  sampleBackgrounds: {},
  previewSnapshot: { svg: "", error: null },
  chatByFileId: {},
  attachmentsByFileId: {},
  isChatLoadingByFileId: {},
  settings: {
    aiProvider: "openai",
    openaiApiKey: "",
    openaiApiHost: "https://api.openai.com",
    openaiModel: "gpt-4o",
    geminiApiKey: "",
    geminiOAuth: undefined,
    geminiModel: "gemini-3-flash-preview",
  },
  isSettingsOpen: false,
  toast: { message: "", type: "success", visible: false },
  showToast: (message, type = "success") => {
    set({ toast: { message, type, visible: true } });
    setTimeout(() => {
      set((state) => ({ toast: { ...state.toast, visible: false } }));
    }, 2000);
  },
  hideToast: () => {
    set((state) => ({ toast: { ...state.toast, visible: false } }));
  },
  selectFile: (folderId, fileId) => {
    set({ currentFolderId: folderId, currentFileId: fileId });
    if (folderId && fileId && folderId !== SAMPLES_FOLDER_ID) {
      get().loadChatForFile(folderId, fileId);
      get().loadAttachmentsForFile(folderId, fileId);
    }
  },
  setChatLoading: (fileId, isLoading) => {
    set((state) => ({
      isChatLoadingByFileId: { ...state.isChatLoadingByFileId, [fileId]: isLoading },
    }));
  },
  createFolder: () => {
    const folderId = nanoid();
    const fileId = nanoid();
    const newFile: FileNode = {
      id: fileId,
      name: "New Diagram",
      content: "graph TD\n    A[SeaSketch] --> B[Diagram];",
      previewBackground: DEFAULT_PREVIEW_BACKGROUND,
    };
    const newFolder: FolderNode = {
      id: folderId,
      name: "New Folder",
      files: [newFile],
    };
    const folders = [...get().folders, newFolder];
    set({ folders, currentFolderId: folderId, currentFileId: fileId });
    debouncedSave(getStateSnapshot(folders, folderId, fileId, get().layout));
  },
  renameFolder: (folderId, name) => {
    const folders = get().folders.map((folder) =>
      folder.id === folderId ? { ...folder, name } : folder,
    );
    set({ folders });
    debouncedSave(
      getStateSnapshot(folders, get().currentFolderId, get().currentFileId, get().layout),
    );
  },
  deleteFolder: (folderId) => {
    const folders = get().folders.filter((folder) => folder.id !== folderId);
    let { currentFolderId, currentFileId } = get();
    if (currentFolderId === folderId) {
      if (folders.length > 0) {
        currentFolderId = folders[0].id;
        currentFileId = folders[0].files[0]?.id ?? null;
      } else {
        currentFolderId = null;
        currentFileId = null;
      }
    }
    set({ folders, currentFolderId, currentFileId });
    debouncedSave(getStateSnapshot(folders, currentFolderId, currentFileId, get().layout));
  },
  createFile: (folderId) => {
    const fileId = nanoid();
    const newFile: FileNode = {
      id: fileId,
      name: "New Diagram",
      content: "graph TD\n    A --> B;",
      previewBackground: DEFAULT_PREVIEW_BACKGROUND,
    };
    const folders = get().folders.map((folder) =>
      folder.id === folderId ? { ...folder, files: [...folder.files, newFile] } : folder,
    );
    set({ folders, currentFolderId: folderId, currentFileId: fileId });
    debouncedSave(getStateSnapshot(folders, folderId, fileId, get().layout));
  },
  renameFile: (folderId, fileId, name) => {
    const folders = get().folders.map((folder) =>
      folder.id === folderId
        ? {
            ...folder,
            files: folder.files.map((file) => (file.id === fileId ? { ...file, name } : file)),
          }
        : folder,
    );
    set({ folders });
    debouncedSave(
      getStateSnapshot(folders, get().currentFolderId, get().currentFileId, get().layout),
    );
  },
  deleteFile: (folderId, fileId) => {
    const folders = get().folders.map((folder) =>
      folder.id === folderId
        ? { ...folder, files: folder.files.filter((file) => file.id !== fileId) }
        : folder,
    );
    let { currentFolderId, currentFileId } = get();
    if (currentFileId === fileId) {
      const folder = folders.find((g) => g.id === folderId);
      if (folder && folder.files.length > 0) {
        currentFileId = folder.files[0].id;
        currentFolderId = folder.id;
      } else {
        currentFileId = null;
      }
    }
    set({ folders, currentFolderId, currentFileId });
    debouncedSave(getStateSnapshot(folders, currentFolderId, currentFileId, get().layout));
  },
  updateFileContent: (folderId, fileId, content) => {
    const folders = get().folders.map((folder) =>
      folder.id === folderId
        ? {
            ...folder,
            files: folder.files.map((file) => (file.id === fileId ? { ...file, content } : file)),
          }
        : folder,
    );
    set({ folders });
    debouncedSave(
      getStateSnapshot(folders, get().currentFolderId, get().currentFileId, get().layout),
    );
  },
  updateSampleContent: (fileId, content) => {
    set((state) => ({
      sampleContents: { ...state.sampleContents, [fileId]: content },
    }));
    // Not persisted — intentionally no debouncedSave call
  },
  updateLayout: (layout) => {
    const currentLayout = get().layout ?? {};
    const nextLayout = { ...currentLayout, ...layout };
    const sidebarWidth = nextLayout.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH;
    const editorWidth = nextLayout.editorWidth ?? DEFAULT_EDITOR_WIDTH;

    const normalizedLayout = {
      sidebarWidth,
      editorWidth,
    };

    set({ layout: normalizedLayout });
    debouncedSave(
      getStateSnapshot(
        get().folders,
        get().currentFolderId,
        get().currentFileId,
        normalizedLayout,
      ),
    );
  },
  togglePreviewBackground: async () => {
    const { currentFolderId, currentFileId } = get();
    if (!currentFileId) return;

    const getNextMode = (mode: "dark" | "light"): "dark" | "light" => (mode === "dark" ? "light" : "dark");

    if (currentFolderId === SAMPLES_FOLDER_ID) {
      set((state) => {
        const currentMode = state.sampleBackgrounds[currentFileId] ?? DEFAULT_PREVIEW_BACKGROUND;
        return {
          sampleBackgrounds: {
            ...state.sampleBackgrounds,
            [currentFileId]: getNextMode(currentMode),
          },
        };
      });
      return;
    }

    if (!currentFolderId) return;

    const currentFolder = get().folders.find((folder) => folder.id === currentFolderId);
    const currentFile = currentFolder?.files.find((file) => file.id === currentFileId);
    const currentMode: "dark" | "light" = currentFile?.previewBackground ?? DEFAULT_PREVIEW_BACKGROUND;
    const nextMode: "dark" | "light" = getNextMode(currentMode);

    const folders: FolderNode[] = get().folders.map((folder) => {
      if (folder.id !== currentFolderId) return folder;
      return {
        ...folder,
        files: folder.files.map((file) =>
          file.id === currentFileId ? { ...file, previewBackground: nextMode } : file,
        ),
      };
    });
    set({ folders });
    await get().saveStateImmediateWithRetry();
  },
  setPreviewSnapshot: (snapshot) => set({ previewSnapshot: snapshot }),
  loadChatForFile: async (folderId, fileId) => {
    if (!folderId || !fileId) return;
    const messages = await invoke<ChatMessage[]>("read_chat", { folderId, fileId }).catch(() => []);
    set((state) => ({
      chatByFileId: { ...state.chatByFileId, [fileId]: messages },
    }));
  },
  appendChatMessage: async (folderId, fileId, message) => {
    await invoke("append_chat", { folderId, fileId, message });
    set((state) => ({
      chatByFileId: {
        ...state.chatByFileId,
        [fileId]: [...(state.chatByFileId[fileId] ?? []), message],
      },
    }));
  },
  clearChatForFile: async (folderId, fileId) => {
    await invoke("clear_chat_only", { folderId, fileId });
    set((state) => ({
      chatByFileId: { ...state.chatByFileId, [fileId]: [] },
    }));
  },
  deleteAttachmentsForFile: async (folderId, fileId) => {
    await invoke("delete_attachments", { folderId, fileId });
    set((state) => ({
      attachmentsByFileId: { ...state.attachmentsByFileId, [fileId]: [] },
    }));
  },
  loadAttachmentsForFile: async (folderId, fileId) => {
    if (!folderId || !fileId) return;
    const attachments = await invoke<AttachmentMeta[]>("list_attachments", { folderId, fileId }).catch(() => []);
    set((state) => ({
      attachmentsByFileId: { ...state.attachmentsByFileId, [fileId]: attachments },
    }));
  },
  saveAttachment: async (folderId, fileId, filename, content) => {
    const attachment = await invoke<AttachmentMeta>("save_attachment", { folderId, fileId, filename, content });
    set((state) => ({
      attachmentsByFileId: {
        ...state.attachmentsByFileId,
        [fileId]: [...(state.attachmentsByFileId[fileId] ?? []), attachment],
      },
    }));
    return attachment;
  },
  loadSettings: async () => {
    const settings = await invoke<AISettings>("load_settings").catch(() => null);
    if (settings) {
      set({ settings });
    }
  },
  saveSettings: async (settings) => {
    await invoke("save_settings", { settings });
    set({ settings });
  },
  updateAIProvider: async (provider) => {
    const currentSettings = get().settings;
    const newSettings = { ...currentSettings, aiProvider: provider };
    
    // Update settings in store immediately
    set({ settings: newSettings });
    
    // Clear all chats when switching provider
    const clearChatPromises = get().folders
      .filter(folder => folder.id !== SAMPLES_FOLDER_ID)
      .flatMap(folder => 
        folder.files.map(file => 
          invoke("clear_chat", { folderId: folder.id, fileId: file.id })
        )
      );
    
    await Promise.all(clearChatPromises).catch(() => {});
    
    // Clear in-memory chat state
    set({ chatByFileId: {}, attachmentsByFileId: {} });
    
    // Save new settings to backend
    await invoke("save_settings", { settings: newSettings });
  },
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
  loadState: async () => {
    set({ isLoading: true });
    const response = await invoke<AppStateData>("load_state").catch(() => null);
    const rawState =
      response && response.folders && response.folders.length > 0
        ? response
        : createDefaultState();
    const normalizedState: AppStateData = {
      folders: normalizeFolders(rawState.folders),
      currentFolderId: rawState.currentFolderId,
      currentFileId: rawState.currentFileId,
      layout: rawState.layout,
    };
    set({ ...normalizedState, isLoading: false, hasLoaded: true });
    if (!response || !response.folders || response.folders.length === 0) {
      debouncedSave(normalizedState);
    }
    const currentFolderId = normalizedState.currentFolderId;
    const currentFileId = normalizedState.currentFileId;
    if (currentFolderId && currentFileId && currentFolderId !== SAMPLES_FOLDER_ID) {
      get().loadChatForFile(currentFolderId, currentFileId);
      get().loadAttachmentsForFile(currentFolderId, currentFileId);
    }
    await get().loadSettings();
  },
  saveState: async () => {
    const state = getStateSnapshot(
      get().folders,
      get().currentFolderId,
      get().currentFileId,
      get().layout,
    );
    await invoke("save_state", { state });
  },
  saveStateImmediateWithRetry: async () => {
    const maxRetries = 3;
    const retryDelay = 500;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await get().saveState();
        return;
      } catch (error) {
        console.error("Failed to save state", error);
        if (attempt === maxRetries) {
          get().showToast("状态保存失败", "error");
        } else {
          await delay(retryDelay);
        }
      }
    }
  },
}));

