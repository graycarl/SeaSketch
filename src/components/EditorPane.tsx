import { useEffect, useMemo, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useSeaSketchStore } from "../store";
import { samplesFolder, SAMPLES_FOLDER_ID } from "../samples";
import { CodeEditor } from "./CodeEditor";
import { Dropdown, type DropdownOption } from "./Dropdown";
import {
  parseFrontmatter,
  writeFrontmatter,
  getEffectiveTheme,
  getEffectiveLook,
  type MermaidTheme,
  type MermaidLook,
} from "../utils/frontmatter";
import "./EditorPane.css";

const THEME_OPTIONS: DropdownOption[] = [
  { value: "default", label: "Default" },
  { value: "base", label: "Base" },
  { value: "dark", label: "Dark" },
  { value: "forest", label: "Forest" },
  { value: "neutral", label: "Neutral" },
  { value: "null", label: "Null" },
];

const LOOK_OPTIONS: DropdownOption[] = [
  { value: "classic", label: "Classic" },
  { value: "handDrawn", label: "Hand Drawn" },
];

export function EditorPane() {
  const {
    folders,
    currentFolderId,
    currentFileId,
    updateFileContent,
    sampleContents,
    updateSampleContent,
    createSnapshot,
  } = useSeaSketchStore();

  const isSamples = currentFolderId === SAMPLES_FOLDER_ID;

  const [isSnapshotInputOpen, setIsSnapshotInputOpen] = useState(false);
  const [snapshotNote, setSnapshotNote] = useState("");
  const snapshotInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isSnapshotInputOpen && snapshotInputRef.current) {
      snapshotInputRef.current.focus();
      snapshotInputRef.current.select();
    }
  }, [isSnapshotInputOpen]);

  const currentFolder = isSamples
    ? samplesFolder
    : folders.find((folder) => folder.id === currentFolderId);

  const currentFile = currentFolder?.files.find((file) => file.id === currentFileId);

  const editorValue = isSamples && currentFile
    ? (sampleContents[currentFile.id] ?? currentFile.content)
    : currentFile?.content ?? "";

  // Parse frontmatter from current content to derive dropdown values
  const { config } = useMemo(() => parseFrontmatter(editorValue), [editorValue]);
  const currentTheme = getEffectiveTheme(config);
  const currentLook = getEffectiveLook(config);

  if (!currentFile) {
    return (
      <div className="editor-pane empty">
        <p>Select or create a diagram to begin.</p>
      </div>
    );
  }

  const handleChange = (value: string) => {
    if (isSamples) {
      updateSampleContent(currentFile.id, value);
    } else {
      updateFileContent(currentFolder!.id, currentFile.id, value);
    }
  };

  const handleCreateSnapshot = () => {
    if (!currentFolder || !currentFile || isSamples) return;
    setIsSnapshotInputOpen(true);
  };

  const handleSnapshotSave = () => {
    if (!currentFolder || !currentFile || isSamples) return;
    createSnapshot(currentFolder.id, currentFile.id, snapshotNote);
    setSnapshotNote("");
    setIsSnapshotInputOpen(false);
  };

  const handleSnapshotCancel = () => {
    setSnapshotNote("");
    setIsSnapshotInputOpen(false);
  };

  const handleThemeChange = (theme: string) => {
    const { config: currentConfig } = parseFrontmatter(editorValue);
    const newContent = writeFrontmatter(editorValue, {
      ...currentConfig,
      theme: theme as MermaidTheme,
    });
    handleChange(newContent);
  };

  const handleLookChange = (look: string) => {
    const { config: currentConfig } = parseFrontmatter(editorValue);
    const newContent = writeFrontmatter(editorValue, {
      ...currentConfig,
      look: look as MermaidLook,
    });
    handleChange(newContent);
  };

  return (
    <div className="editor-pane">
      <div className="editor-header">
        <h2>Editor</h2>
        <div className="editor-header-controls">
          {!isSamples && isSnapshotInputOpen && (
            <div className="editor-snapshot-input">
              <input
                ref={snapshotInputRef}
                type="text"
                placeholder="快照备注（可选）"
                value={snapshotNote}
                onChange={(e) => setSnapshotNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSnapshotSave();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    handleSnapshotCancel();
                  }
                }}
              />
              <button type="button" className="snapshot-action" onClick={handleSnapshotSave}>
                保存
              </button>
              <button type="button" className="snapshot-action ghost" onClick={handleSnapshotCancel}>
                取消
              </button>
            </div>
          )}
          {!isSamples && !isSnapshotInputOpen && (
            <button
              className="editor-snapshot-btn"
              type="button"
              onClick={handleCreateSnapshot}
              title="创建快照"
            >
              <Camera size={14} />
            </button>
          )}
          {!isSnapshotInputOpen && (
            <>
              <Dropdown
                label="Theme"
                value={currentTheme}
                options={THEME_OPTIONS}
                onChange={handleThemeChange}
              />
              <Dropdown
                label="Look"
                value={currentLook}
                options={LOOK_OPTIONS}
                onChange={handleLookChange}
              />
            </>
          )}
        </div>
      </div>
      <CodeEditor
        key={currentFile.id}
        value={editorValue}
        onChange={handleChange}
      />
    </div>
  );
}
