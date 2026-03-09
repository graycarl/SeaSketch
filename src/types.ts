export interface FileNode {
  id: string;
  name: string;
  content: string;
}

export interface FolderNode {
  id: string;
  name: string;
  files: FileNode[];
}

export interface LayoutState {
  sidebarWidth?: number;
  editorWidth?: number;
}

export interface AppStateData {
  folders: FolderNode[];
  currentFolderId: string | null;
  currentFileId: string | null;
  layout?: LayoutState;
  previewBackground?: "dark" | "light";
}

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  attachments?: string[];
  appliedMermaid?: boolean;
}

export interface AttachmentMeta {
  id: string;
  name: string;
  filename: string;
  size: number;
}

export interface AISettings {
  apiKey: string;
  apiHost: string;
  model: string;
}
