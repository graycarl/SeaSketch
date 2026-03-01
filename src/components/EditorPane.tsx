import { useSeaSketchStore } from "../store";
import "./EditorPane.css";

export function EditorPane() {
  const { folders, currentFolderId, currentFileId, updateFileContent } = useSeaSketchStore();
  const currentFolder = folders.find((folder) => folder.id === currentFolderId);
  const currentFile = currentFolder?.files.find((file) => file.id === currentFileId);

  if (!currentFile) {
    return (
      <div className="editor-pane empty">
        <p>Select or create a diagram to begin.</p>
      </div>
    );
  }

  return (
    <div className="editor-pane">
      <textarea
        value={currentFile.content}
        onChange={(e) => updateFileContent(currentFolder!.id, currentFile.id, e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}
