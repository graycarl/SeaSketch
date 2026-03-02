import classNames from "classnames";
import { useEffect, useRef, useState } from "react";
import { FilePlus, FolderOpen, FolderPlus, Trash2, FileText } from "lucide-react";
import { useSeaSketchStore } from "../store";
import "./Sidebar.css";

type PendingDelete =
  | { type: "folder"; folderId: string }
  | { type: "file"; folderId: string; fileId: string };

export function Sidebar() {
  const {
    folders,
    currentFolderId,
    currentFileId,
    selectFile,
    createFolder,
    createFile,
    renameFolder,
    renameFile,
    deleteFolder,
    deleteFile,
  } = useSeaSketchStore();

  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const fileEditingInputRef = useRef<HTMLInputElement | null>(null);
  const folderEditingInputRef = useRef<HTMLInputElement | null>(null);
  const deleteConfirmRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (fileEditingInputRef.current) {
      fileEditingInputRef.current.focus();
      fileEditingInputRef.current.select();
    }
  }, [editingFileId]);

  useEffect(() => {
    if (folderEditingInputRef.current) {
      folderEditingInputRef.current.focus();
      folderEditingInputRef.current.select();
    }
  }, [editingFolderId]);

  useEffect(() => {
    if (!pendingDelete) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (deleteConfirmRef.current && !deleteConfirmRef.current.contains(e.target as Node)) {
        setPendingDelete(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [pendingDelete]);

  const handleDeleteConfirm = () => {
    if (!pendingDelete) return;
    if (pendingDelete.type === "folder") {
      deleteFolder(pendingDelete.folderId);
    } else {
      deleteFile(pendingDelete.folderId, pendingDelete.fileId);
    }
    setPendingDelete(null);
  };

  const isFolderDeletePending = (folderId: string) =>
    pendingDelete?.type === "folder" && pendingDelete.folderId === folderId;

  const isFileDeletePending = (folderId: string, fileId: string) =>
    pendingDelete?.type === "file" &&
    pendingDelete.folderId === folderId &&
    pendingDelete.fileId === fileId;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Folders</span>
        <button
          className="sidebar-header-btn"
          onClick={() => createFolder()}
          title="New folder"
        >
          <FolderPlus size={15} />
        </button>
      </div>
      <div className="folder-list">
        {folders.map((folder) => (
          <div key={folder.id} className="folder-section">
            <div className="folder-header">
              <FolderOpen size={14} className="folder-icon" />
              {editingFolderId === folder.id ? (
                <input
                  ref={(el) => {
                    if (editingFolderId === folder.id) {
                      folderEditingInputRef.current = el;
                    }
                  }}
                  className="folder-name-input"
                  value={folder.name}
                  onChange={(e) => renameFolder(folder.id, e.target.value)}
                  onBlur={() => setEditingFolderId(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setEditingFolderId(null);
                    }
                  }}
                />
              ) : (
                <span
                  className="folder-name"
                  onDoubleClick={() => setEditingFolderId(folder.id)}
                >
                  {folder.name}
                </span>
              )}
              <div className="folder-actions">
                <button
                  className="folder-action-btn"
                  onClick={() => createFile(folder.id)}
                  title="New file"
                >
                  <FilePlus size={13} />
                </button>
                {isFolderDeletePending(folder.id) ? (
                  <div className="delete-confirm" ref={deleteConfirmRef}>
                    <button
                      className="delete-confirm-ok"
                      onClick={() => handleDeleteConfirm()}
                    >
                      <Trash2 size={11} />
                      删除
                    </button>
                  </div>
                ) : (
                  <button
                    className="folder-action-btn danger"
                    title="Delete folder"
                    onClick={() =>
                      setPendingDelete({ type: "folder", folderId: folder.id })
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            <ul className="file-list">
              {folder.files.map((file) => {
                const isActive =
                  currentFolderId === folder.id && currentFileId === file.id;
                const isEditing = editingFileId === file.id;
                const isFilePending = isFileDeletePending(folder.id, file.id);

                return (
                  <li
                    key={file.id}
                    className={classNames("file-item", { active: isActive })}
                    onClick={() => selectFile(folder.id, file.id)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingFileId(file.id);
                    }}
                  >
                    <FileText size={13} className="file-icon" />
                    {isEditing ? (
                      <input
                        ref={(el) => {
                          if (isEditing) {
                            fileEditingInputRef.current = el;
                          }
                        }}
                        className="file-name-input"
                        value={file.name}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          renameFile(folder.id, file.id, e.target.value)
                        }
                        onBlur={() => setEditingFileId(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            setEditingFileId(null);
                          }
                        }}
                      />
                    ) : (
                      <span className="file-name-display">{file.name}</span>
                    )}
                    {isFilePending ? (
                      <div className="delete-confirm" ref={deleteConfirmRef}>
                        <button
                          className="delete-confirm-ok"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConfirm();
                          }}
                        >
                          <Trash2 size={11} />
                          删除
                        </button>
                      </div>
                    ) : (
                      <button
                        className="delete-file"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDelete({
                            type: "file",
                            folderId: folder.id,
                            fileId: file.id,
                          });
                        }}
                        title="Delete file"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
