import classNames from "classnames";
import { useEffect, useRef, useState } from "react";
import { FilePlus, Folder, FolderOpen, FolderPlus, Trash2, FileText, BookOpen, ChevronRight, ChevronDown } from "lucide-react";
import { useSeaSketchStore } from "../store";
import { samplesFolder, SAMPLES_FOLDER_ID } from "../samples";
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
    restoreSnapshot,
    deleteSnapshot,
  } = useSeaSketchStore();

  const allFolders = [samplesFolder, ...folders];

  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedSnapshots, setExpandedSnapshots] = useState<Set<string>>(new Set());
  const [pendingSnapshotDeleteId, setPendingSnapshotDeleteId] = useState<string | null>(null);

  const fileEditingInputRef = useRef<HTMLInputElement | null>(null);
  const folderEditingInputRef = useRef<HTMLInputElement | null>(null);
  const deleteConfirmRef = useRef<HTMLDivElement | null>(null);

  // 当 currentFolderId 变化时，自动展开该文件夹
  useEffect(() => {
    if (currentFolderId) {
      setExpandedFolders((prev) => {
        if (!prev.has(currentFolderId)) {
          const newSet = new Set(prev);
          newSet.add(currentFolderId);
          return newSet;
        }
        return prev;
      });
    }
  }, [currentFolderId]);

  useEffect(() => {
    setPendingSnapshotDeleteId(null);
  }, [currentFileId]);

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

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const toggleSnapshots = (fileId: string) => {
    setExpandedSnapshots((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const isFolderDeletePending = (folderId: string) =>
    pendingDelete?.type === "folder" && pendingDelete.folderId === folderId;

  const isFileDeletePending = (folderId: string, fileId: string) =>
    pendingDelete?.type === "file" &&
    pendingDelete.folderId === folderId &&
    pendingDelete.fileId === fileId;

  const formatSnapshotLabel = (createdAt: string, note?: string) => {
    const label = new Date(createdAt).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return note?.trim() ? `${label} · ${note}` : label;
  };

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
        {allFolders.map((folder) => {
          const isSamples = folder.id === SAMPLES_FOLDER_ID;
          const isExpanded = expandedFolders.has(folder.id);
          return (
            <div key={folder.id} className={classNames("folder-section", { "samples-folder": isSamples })}>
              <div className="folder-header" onClick={() => toggleFolder(folder.id)}>
                {isSamples ? (
                  <BookOpen size={14} className="folder-icon samples-icon" />
                ) : isExpanded ? (
                  <FolderOpen size={14} className="folder-icon" />
                ) : (
                  <Folder size={14} className="folder-icon" />
                )}
                {!isSamples && editingFolderId === folder.id ? (
                  <input
                    ref={(el) => {
                      if (editingFolderId === folder.id) {
                        folderEditingInputRef.current = el;
                      }
                    }}
                    className="folder-name-input"
                    value={folder.name}
                    onClick={(e) => e.stopPropagation()}
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
                    onDoubleClick={
                      isSamples
                        ? undefined
                        : (e) => {
                            e.stopPropagation();
                            setEditingFolderId(folder.id);
                          }
                    }
                  >
                    {folder.name}
                  </span>
                )}
                {!isSamples && (
                  <div className="folder-actions" onClick={(e) => e.stopPropagation()}>
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
                )}
              </div>
              {isExpanded && (
                <ul className="file-list">
                  {folder.files.map((file) => {
                    const isActive =
                      currentFolderId === folder.id && currentFileId === file.id;
                    const isEditing = !isSamples && editingFileId === file.id;
                    const isFilePending = !isSamples && isFileDeletePending(folder.id, file.id);
                    const snapshots = file.snapshots ?? [];
                    const isSnapshotsExpanded = expandedSnapshots.has(file.id);

                    return (
                      <li
                        key={file.id}
                        className={classNames("file-item", { active: isActive })}
                      >
                        <div
                          className="file-row"
                          onClick={() => selectFile(folder.id, file.id)}
                          onDoubleClick={
                            isSamples
                              ? undefined
                              : (e) => {
                                  e.stopPropagation();
                                  setEditingFileId(file.id);
                                }
                          }
                        >
                          {!isSamples && isActive && snapshots.length > 0 && (
                            <button
                              className="snapshot-toggle"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSnapshots(file.id);
                              }}
                              title={isSnapshotsExpanded ? "收起快照" : "展开快照"}
                            >
                              {isSnapshotsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                          )}
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
                            <div className="delete-confirm" ref={deleteConfirmRef} onClick={(e) => e.stopPropagation()}>
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
                            !isSamples && (
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
                            )
                          )}
                        </div>
                        {isActive && !isSamples && snapshots.length > 0 && isSnapshotsExpanded && (
                          <ul className="snapshot-list">
                            {snapshots.map((snapshot) => (
                              <li key={snapshot.id} className="snapshot-item">
                                <button
                                  className="snapshot-button"
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    restoreSnapshot(folder.id, file.id, snapshot.id);
                                  }}
                                >
                                  {formatSnapshotLabel(snapshot.createdAt, snapshot.note)}
                                </button>
                                {pendingSnapshotDeleteId === snapshot.id ? (
                                  <button
                                    className="snapshot-delete-confirm"
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteSnapshot(folder.id, file.id, snapshot.id);
                                      setPendingSnapshotDeleteId(null);
                                    }}
                                  >
                                    确认删除
                                  </button>
                                ) : (
                                  <button
                                    className="snapshot-delete"
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPendingSnapshotDeleteId(snapshot.id);
                                    }}
                                  >
                                    删除
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
