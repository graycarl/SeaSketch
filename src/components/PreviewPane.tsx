import { useSeaSketchStore } from "../store";
import { samplesFolder, SAMPLES_FOLDER_ID } from "../samples";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";
import { parseFrontmatter } from "../utils/frontmatter";
import { Sun, Moon } from "lucide-react";
import "./PreviewPane.css";

mermaid.initialize({ startOnLoad: false, theme: "dark" });

export function PreviewPane() {
  const { folders, currentFolderId, currentFileId, sampleContents, previewBackground, togglePreviewBackground } = useSeaSketchStore();

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
        // Extract frontmatter config and build the render content
        const { config, body } = parseFrontmatter(debouncedContent);
        const hasConfig = config.theme || config.look;
        const initConfig: Record<string, string> = {};
        if (config.theme) initConfig.theme = config.theme;
        if (config.look) initConfig.look = config.look;
        const initDirective = hasConfig
          ? `%%{init: ${JSON.stringify(initConfig)}}%%\n`
          : "";
        const renderContent = initDirective + body;

        const { svg } = await mermaid.render(`diagram-${currentFile.id}`, renderContent);
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

  const bg = previewBackground ?? "dark";

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
      <div className={`preview-content bg-${bg}`} ref={containerRef}>
        <button
          className="preview-bg-toggle"
          onClick={togglePreviewBackground}
          title={bg === "dark" ? "Switch to light background" : "Switch to dark background"}
        >
          {bg === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </div>
  );
}
