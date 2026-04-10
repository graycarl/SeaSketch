import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { Sidebar } from "./components/Sidebar";
import { EditorPane } from "./components/EditorPane";
import { PreviewPane } from "./components/PreviewPane";
import { SettingsModal } from "./components/SettingsModal";
import { useSeaSketchStore } from "./store";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

const MIN_SIDEBAR_WIDTH = 200;
const MIN_EDITOR_WIDTH = 320;
const MIN_PREVIEW_WIDTH = 280;
const DEFAULT_SIDEBAR_WIDTH = 217;
const DEFAULT_EDITOR_WIDTH = 416;

function App() {
  const { loadState, isLoading, layout, updateLayout, openSettings } = useSeaSketchStore();
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    type: "sidebar" | "preview" | null;
    startX: number;
    startSidebarWidth: number;
    startEditorWidth: number;
  }>({
    type: null,
    startX: 0,
    startSidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    startEditorWidth: DEFAULT_EDITOR_WIDTH,
  });

  useEffect(() => {
    loadState();
  }, [loadState]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("open-settings", () => {
      openSettings();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [openSettings]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStateRef.current.type || !shellRef.current) {
        return;
      }
      const { type, startX, startSidebarWidth, startEditorWidth } = dragStateRef.current;
      const containerWidth = shellRef.current.getBoundingClientRect().width;
      const deltaX = event.clientX - startX;

      if (type === "sidebar") {
        const rawWidth = startSidebarWidth + deltaX;
        const maxWidth = Math.max(
          MIN_SIDEBAR_WIDTH,
          containerWidth - startEditorWidth - MIN_PREVIEW_WIDTH,
        );
        const nextSidebarWidth = Math.min(Math.max(rawWidth, MIN_SIDEBAR_WIDTH), maxWidth);
        updateLayout({ sidebarWidth: nextSidebarWidth });
      }

      if (type === "preview") {
        const rawWidth = startEditorWidth + deltaX;
        const maxWidth = Math.max(
          MIN_EDITOR_WIDTH,
          containerWidth - startSidebarWidth - MIN_PREVIEW_WIDTH,
        );
        const nextEditorWidth = Math.min(Math.max(rawWidth, MIN_EDITOR_WIDTH), maxWidth);
        updateLayout({ editorWidth: nextEditorWidth });
      }
    };

    const handleMouseUp = () => {
      if (dragStateRef.current.type) {
        dragStateRef.current.type = null;
        document.body.classList.remove("is-resizing");
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [updateLayout]);

  const handleStartResize = (type: "sidebar" | "preview", event: ReactMouseEvent) => {
    if (!shellRef.current) return;
    event.preventDefault();
    const sidebarWidth = layout?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH;
    const editorWidth = layout?.editorWidth ?? DEFAULT_EDITOR_WIDTH;

    dragStateRef.current = {
      type,
      startX: event.clientX,
      startSidebarWidth: sidebarWidth,
      startEditorWidth: editorWidth,
    };
    document.body.classList.add("is-resizing");
  };

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>Loading SeaSketch...</p>
      </div>
    );
  }

  const sidebarWidth = layout?.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH;
  const editorWidth = layout?.editorWidth ?? DEFAULT_EDITOR_WIDTH;
  const shellStyle = {
    "--sidebar-width": `${sidebarWidth}px`,
    "--editor-width": `${editorWidth}px`,
  } as CSSProperties;

  return (
    <div className="app-shell" ref={shellRef} style={shellStyle}>
      {isPreviewFullscreen ? (
        <div className="preview-fullscreen-layer layout-fade-transition">
          <PreviewPane
            isFullscreen
            onToggleFullscreen={() => setIsPreviewFullscreen(false)}
          />
        </div>
      ) : (
        <div className="app-layout layout-fade-transition">
          <Sidebar />
          <div
            className="pane-resizer"
            role="separator"
            aria-orientation="vertical"
            onMouseDown={(event) => handleStartResize("sidebar", event)}
          />
          <EditorPane />
          <div
            className="pane-resizer"
            role="separator"
            aria-orientation="vertical"
            onMouseDown={(event) => handleStartResize("preview", event)}
          />
          <PreviewPane
            onToggleFullscreen={() => setIsPreviewFullscreen(true)}
          />
        </div>
      )}
      <SettingsModal />
    </div>
  );
}

export default App;
