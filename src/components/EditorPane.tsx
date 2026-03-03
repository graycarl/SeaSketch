import { useSeaSketchStore } from "../store";
import { samplesFolder, SAMPLES_FOLDER_ID } from "../samples";
import { CodeEditor } from "./CodeEditor";
import "./EditorPane.css";

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

  // For samples folder, look up file from the static samplesFolder definition
  const currentFolder = isSamples
    ? samplesFolder
    : folders.find((folder) => folder.id === currentFolderId);

  const currentFile = currentFolder?.files.find((file) => file.id === currentFileId);

  // For samples, the displayed content may be overridden in memory
  const editorValue = isSamples && currentFile
    ? (sampleContents[currentFile.id] ?? currentFile.content)
    : currentFile?.content ?? "";

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

  return (
    <div className="editor-pane">
      <div className="editor-header">
        <h2>Editor</h2>
      </div>
      <CodeEditor
        key={currentFile.id}
        value={editorValue}
        onChange={handleChange}
      />
    </div>
  );
}
