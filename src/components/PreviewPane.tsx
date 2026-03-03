import { useSeaSketchStore } from "../store";
import { samplesFolder, SAMPLES_FOLDER_ID } from "../samples";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";
import "./PreviewPane.css";

mermaid.initialize({ startOnLoad: false, theme: "dark" });

export function PreviewPane() {
  const { folders, currentFolderId, currentFileId, sampleContents } = useSeaSketchStore();

  const isSamples = currentFolderId === SAMPLES_FOLDER_ID;

  const currentFolder = useMemo(
    () =>
      isSamples
        ? samplesFolder
        : folders.find((folder) => folder.id === currentFolderId),
    [isSamples, folders, currentFolderId],
  );
  const currentFile = useMemo(
    () => currentFolder?.files.find((file) => file.id === currentFileId),
    [currentFolder, currentFileId],
  );

  // For samples, content may have been edited in-memory
  const content = isSamples && currentFile
    ? (sampleContents[currentFile.id] ?? currentFile.content)
    : (currentFile?.content ?? "");

  const debouncedContent = useDebouncedValue(content, 400);
  const [error, setError] = useState<string | null>(null);
  const lastSuccessfulSvg = useRef<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentFile) {
      setError(null);
      lastSuccessfulSvg.current = "";
      if (containerRef.current) containerRef.current.innerHTML = "";
      return;
    }

    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render(`diagram-${currentFile.id}`, debouncedContent);
        lastSuccessfulSvg.current = svg;
        if (containerRef.current) containerRef.current.innerHTML = svg;
        setError(null);
      } catch (err) {
        console.error("Mermaid render error", err);
        setError((err as Error).message);
        if (containerRef.current) containerRef.current.innerHTML = lastSuccessfulSvg.current;
      }
    };

    if (debouncedContent.trim()) {
      renderDiagram();
    } else {
      if (containerRef.current) containerRef.current.innerHTML = "";
      setError("Diagram is empty");
    }
  }, [currentFile, debouncedContent]);

  if (!currentFile) {
    return (
      <div className="preview-pane empty">
        <p>No diagram selected</p>
      </div>
    );
  }

  return (
    <div className="preview-pane">
      <div className="preview-header">
        <h2>Preview</h2>
        {error && <span className="error-text">{error}</span>}
      </div>
      <div className="preview-content" ref={containerRef} />
    </div>
  );
}
