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

export interface AppStateData {
  folders: FolderNode[];
  currentFolderId: string | null;
  currentFileId: string | null;
}
