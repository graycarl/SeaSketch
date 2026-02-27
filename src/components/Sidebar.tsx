import classNames from "classnames";
import { useEffect, useRef, useState } from "react";
import { useSeaSketchStore } from "../store";
import "./Sidebar.css";

export function Sidebar() {
  const {
    groups,
    currentGroupId,
    currentFileId,
    selectFile,
    createGroup,
    createFile,
    renameGroup,
    renameFile,
    deleteGroup,
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
        <h2>Groups</h2>
        <button onClick={() => createGroup()}>+</button>
      </div>
      <div className="group-list">
        {groups.map((group) => (
          <div key={group.id} className="group-section">
            <div className="group-header">
              <input
                className="group-name"
                value={group.name}
                onChange={(e) => renameGroup(group.id, e.target.value)}
              />
              <div className="group-actions">
                <button onClick={() => createFile(group.id)} title="New file">
                  +
                </button>
                <button onClick={() => deleteGroup(group.id)} title="Delete group">
                  🗑
                </button>
              </div>
            </div>
            <ul className="file-list">
              {group.files.map((file) => {
                const isActive = currentGroupId === group.id && currentFileId === file.id;
                const isEditing = editingFileId === file.id;

                return (
                  <li
                    key={file.id}
                    className={classNames("file-item", { active: isActive })}
                    onClick={() => selectFile(group.id, file.id)}
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
                        onChange={(e) => renameFile(group.id, file.id, e.target.value)}
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
                        deleteFile(group.id, file.id);
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
