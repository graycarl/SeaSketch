import { create } from "zustand";
import { nanoid } from "nanoid";
import { AppStateData, FolderNode, FileNode } from "./types";
import { invoke } from "@tauri-apps/api/core";

const DEFAULT_SIDEBAR_WIDTH = 240;
const DEFAULT_EDITOR_WIDTH = 520;

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

interface SeaSketchStore extends AppStateData {
  isLoading: boolean;
  hasLoaded: boolean;
  selectFile: (folderId: string, fileId: string) => void;
  createFolder: () => void;
  renameFolder: (folderId: string, name: string) => void;
  deleteFolder: (folderId: string) => void;
  createFile: (folderId: string) => void;
  renameFile: (folderId: string, fileId: string, name: string) => void;
  deleteFile: (folderId: string, fileId: string) => void;
  updateFileContent: (folderId: string, fileId: string, content: string) => void;
  updateLayout: (layout: AppStateData["layout"]) => void;
  loadState: () => Promise<void>;
  saveState: () => Promise<void>;
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
  selectFile: (folderId, fileId) => set({ currentFolderId: folderId, currentFileId: fileId }),
  createFolder: () => {
    const folderId = nanoid();
    const fileId = nanoid();
    const newFile: FileNode = {
      id: fileId,
      name: "New Diagram",
      content: "graph TD\n    A[SeaSketch] --> B[Diagram];",
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
  loadState: async () => {
    set({ isLoading: true });
    const response = await invoke<AppStateData>("load_state").catch(() => null);
    const state =
      response && response.folders && response.folders.length > 0
        ? response
        : createDefaultState();
    set({ ...state, isLoading: false, hasLoaded: true });
    if (!response || !response.folders || response.folders.length === 0) {
      debouncedSave(state);
    }
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
}));

