import { useMemo } from "react";
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
  } = useSeaSketchStore();

  const isSamples = currentFolderId === SAMPLES_FOLDER_ID;

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
