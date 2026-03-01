import classNames from "classnames";
import { useEffect, useRef, useState } from "react";
import { useSeaSketchStore } from "../store";
import "./Sidebar.css";

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
  const editingInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingInputRef.current) {
      editingInputRef.current.focus();
      editingInputRef.current.select();
    }
  }, [editingFileId]);

  const handleStartEditing = (fileId: string) => {
    setEditingFileId(fileId);
  };

  const handleStopEditing = () => {
    setEditingFileId(null);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Folders</h2>
        <button onClick={() => createFolder()}>+</button>
      </div>
      <div className="folder-list">
        {folders.map((folder) => (
          <div key={folder.id} className="folder-section">
            <div className="folder-header">
              <input
                className="folder-name"
                value={folder.name}
                onChange={(e) => renameFolder(folder.id, e.target.value)}
              />
              <div className="folder-actions">
                <button onClick={() => createFile(folder.id)} title="New file">
                  +
                </button>
                <button onClick={() => deleteFolder(folder.id)} title="Delete folder">
                  🗑
                </button>
              </div>
            </div>
            <ul className="file-list">
              {folder.files.map((file) => {
                const isActive = currentFolderId === folder.id && currentFileId === file.id;
                const isEditing = editingFileId === file.id;

                return (
                  <li
                    key={file.id}
                    className={classNames("file-item", { active: isActive })}
                    onClick={() => selectFile(folder.id, file.id)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleStartEditing(file.id);
                    }}
                  >
                    {isEditing ? (
                      <input
                        ref={(el) => {
                          if (isEditing) {
                            editingInputRef.current = el;
                          }
                        }}
                        className="file-name-input"
                        value={file.name}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => renameFile(folder.id, file.id, e.target.value)}
                        onBlur={handleStopEditing}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleStopEditing();
                          }
                        }}
                      />
                    ) : (
                      <span className="file-name-display">{file.name}</span>
                    )}
                    <button
                      className="delete-file"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFile(folder.id, file.id);
                      }}
                    >
                      ×
                    </button>
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
