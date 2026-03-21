import { useSeaSketchStore } from "../store";
import { samplesFolder, SAMPLES_FOLDER_ID } from "../samples";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useEffect, useMemo, useRef, useState, useCallback, type WheelEvent, type MouseEvent as ReactMouseEvent } from "react";
import mermaid from "mermaid";
import { parseFrontmatter } from "../utils/frontmatter";
import { Sun, Moon } from "lucide-react";
import { ChatPane } from "./ChatPane";
import "./PreviewPane.css";

mermaid.initialize({ startOnLoad: false, theme: "dark", suppressErrorRendering: true });

export function PreviewPane() {
  const { folders, currentFolderId, currentFileId, sampleContents, previewBackground, togglePreviewBackground, setPreviewSnapshot } = useSeaSketchStore();

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
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, translateX: 0, translateY: 0 });
  const lastSuccessfulSvg = useRef<string>("");
  const svgRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const pendingTransformRef = useRef({ scale: 1, translate: { x: 0, y: 0 } });
  const rafRef = useRef<number | null>(null);

  const MIN_SCALE = 0.25;
  const MAX_SCALE = 5;
  const SCALE_STEP = 0.05;

  const clampScale = useCallback((value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value)), []);

  const applyTransform = useCallback((nextScale: number, nextTranslate: { x: number; y: number }) => {
    scaleRef.current = nextScale;
    translateRef.current = nextTranslate;
    setScale(nextScale);
    setTranslate(nextTranslate);
  }, []);

  const scheduleTransform = useCallback((nextScale: number, nextTranslate: { x: number; y: number }) => {
    scaleRef.current = nextScale;
    translateRef.current = nextTranslate;
    pendingTransformRef.current = { scale: nextScale, translate: nextTranslate };
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      setScale(pendingTransformRef.current.scale);
      setTranslate(pendingTransformRef.current.translate);
    });
  }, []);

  const fitToWidth = useCallback(() => {
    const viewport = viewportRef.current;
    const container = svgRef.current;
    if (!viewport || !container) return;
    const svgElement = container.querySelector("svg");
    if (!svgElement) return;
    const styles = window.getComputedStyle(viewport);
    const paddingX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
    const availableWidth = viewport.clientWidth - paddingX;
    if (availableWidth <= 0) return;
    const rectWidth = svgElement.getBoundingClientRect().width;
    const currentScale = scaleRef.current || 1;
    let svgWidth = rectWidth > 0 ? rectWidth / currentScale : 0;
    if (!svgWidth) {
      try {
        svgWidth = (svgElement as SVGSVGElement).getBBox().width;
      } catch {
        svgWidth = 0;
      }
    }
    if (!svgWidth) {
      const viewBox = (svgElement as SVGSVGElement).viewBox?.baseVal;
      if (viewBox?.width) {
        svgWidth = viewBox.width;
      } else {
        const widthAttr = svgElement.getAttribute("width");
        if (widthAttr && !widthAttr.trim().endsWith("%")) {
          const parsed = Number.parseFloat(widthAttr);
          if (!Number.isNaN(parsed)) svgWidth = parsed;
        }
      }
    }
    if (svgWidth <= 0) return;
    const nextScale = clampScale(Number((availableWidth / svgWidth).toFixed(2)));
    applyTransform(nextScale, { x: 0, y: 0 });
  }, [applyTransform, clampScale]);

  useEffect(() => {
    if (!currentFile) {
      setError(null);
      lastSuccessfulSvg.current = "";
      setPreviewSnapshot({ svg: "", error: null });
      if (svgRef.current) svgRef.current.innerHTML = "";
      applyTransform(1, { x: 0, y: 0 });
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
        if (svgRef.current) {
          svgRef.current.innerHTML = svg;
          const svgElement = svgRef.current.querySelector("svg");
          const viewBox = svgElement?.viewBox?.baseVal;
          if (svgElement && viewBox?.width && viewBox?.height) {
            svgElement.setAttribute("width", `${viewBox.width}`);
            svgElement.setAttribute("height", `${viewBox.height}`);
            svgElement.style.maxWidth = "none";
            svgElement.style.maxHeight = "none";
          }
        }
        setError(null);
        setPreviewSnapshot({ svg, error: null });
      } catch (err) {
        console.error("Mermaid render error", err);
        const errorMessage = (err as Error).message;
        setError(errorMessage);
        setPreviewSnapshot({ svg: lastSuccessfulSvg.current, error: errorMessage });
        if (svgRef.current) {
          svgRef.current.innerHTML = lastSuccessfulSvg.current;
          const svgElement = svgRef.current.querySelector("svg");
          const viewBox = svgElement?.viewBox?.baseVal;
          if (svgElement && viewBox?.width && viewBox?.height) {
            svgElement.setAttribute("width", `${viewBox.width}`);
            svgElement.setAttribute("height", `${viewBox.height}`);
            svgElement.style.maxWidth = "none";
            svgElement.style.maxHeight = "none";
          }
        }
      }
    };

    if (debouncedContent.trim()) {
      renderDiagram();
    } else {
      if (svgRef.current) svgRef.current.innerHTML = "";
      setError("Diagram is empty");
      setPreviewSnapshot({ svg: "", error: "Diagram is empty" });
      applyTransform(1, { x: 0, y: 0 });
    }
  }, [applyTransform, currentFile, debouncedContent, setPreviewSnapshot, fitToWidth]);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const direction = event.deltaY > 0 ? -1 : 1;
      const currentScale = scaleRef.current;
      const nextScale = clampScale(Number((currentScale + direction * SCALE_STEP).toFixed(2)));
      if (nextScale === currentScale) return;
      const currentTranslate = translateRef.current;
      const contentX = (mouseX - currentTranslate.x) / currentScale;
      const contentY = (mouseY - currentTranslate.y) / currentScale;
      const nextTranslateX = mouseX - contentX * nextScale;
      const nextTranslateY = mouseY - contentY * nextScale;
      scheduleTransform(nextScale, { x: nextTranslateX, y: nextTranslateY });
    },
    [clampScale, scheduleTransform],
  );

  const handleMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".preview-bg-toggle") || target.closest(".preview-zoom-indicator")) return;
    event.preventDefault();
    setIsDragging(true);
    const currentTranslate = translateRef.current;
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      translateX: currentTranslate.x,
      translateY: currentTranslate.y,
    };
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - dragStartRef.current.x;
      const deltaY = event.clientY - dragStartRef.current.y;
      scheduleTransform(scaleRef.current, {
        x: dragStartRef.current.translateX + deltaX,
        y: dragStartRef.current.translateY + deltaY,
      });
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, scheduleTransform]);

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
      <div
        className={`preview-content bg-${bg}${isDragging ? " dragging" : ""}`}
        ref={viewportRef}
        onWheelCapture={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <div
          className="preview-transform"
          style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})` }}
        >
          <div className="preview-svg" ref={svgRef} />
        </div>
        <div className="preview-zoom-indicator">
          <span>{Math.round(scale * 100)}%</span>
          <button className="preview-fit-button" onClick={fitToWidth} title="Fit to width">适配宽度</button>
        </div>
        <button
          className="preview-bg-toggle"
          onClick={togglePreviewBackground}
          title={bg === "dark" ? "Switch to light background" : "Switch to dark background"}
        >
          {bg === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
      <ChatPane />
    </div>
  );
}
