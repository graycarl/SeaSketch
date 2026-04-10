import { useSeaSketchStore } from "../store";
import { samplesFolder, SAMPLES_FOLDER_ID } from "../samples";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useEffect, useMemo, useRef, useState, useCallback, type WheelEvent, type MouseEvent as ReactMouseEvent } from "react";
import mermaid from "mermaid";
import { parseFrontmatter } from "../utils/frontmatter";
import { Sun, Moon, Copy, Image as ImageIcon, Maximize2, Minimize2 } from "lucide-react";
import { ChatPane } from "./ChatPane";
import { invoke } from "@tauri-apps/api/core";
import "./PreviewPane.css";

mermaid.initialize({ startOnLoad: false, theme: "dark", suppressErrorRendering: true });

interface PreviewPaneProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function PreviewPane({ isFullscreen = false, onToggleFullscreen }: PreviewPaneProps) {
  const { folders, currentFolderId, currentFileId, sampleContents, sampleBackgrounds, togglePreviewBackground, setPreviewSnapshot, showToast, toast } = useSeaSketchStore();

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
  const renderRequestIdRef = useRef(0);

  const MIN_SCALE = 0.25;
  const MAX_SCALE = 5;
  const SCALE_STEP = 0.01;

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
    let isCancelled = false;

    if (!currentFile) {
      setError(null);
      lastSuccessfulSvg.current = "";
      setPreviewSnapshot({ svg: "", error: null });
      if (svgRef.current) svgRef.current.innerHTML = "";
      applyTransform(1, { x: 0, y: 0 });
      return () => {
        isCancelled = true;
      };
    }

    const renderDiagram = async () => {
      const requestId = ++renderRequestIdRef.current;

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

        const renderId = `diagram-${currentFile.id}-${requestId}`;
        const { svg } = await mermaid.render(renderId, renderContent);

        if (isCancelled || requestId !== renderRequestIdRef.current) {
          return;
        }

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
        if (isCancelled || requestId !== renderRequestIdRef.current) {
          return;
        }

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
      setError(null);
      setPreviewSnapshot({ svg: "", error: null });
      applyTransform(1, { x: 0, y: 0 });
    }

    return () => {
      isCancelled = true;
    };
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

  const bg = useMemo(() => {
    if (!currentFile) return "dark";
    if (isSamples) {
      return sampleBackgrounds[currentFile.id] ?? "dark";
    }
    return currentFile.previewBackground ?? "dark";
  }, [currentFile, isSamples, sampleBackgrounds]);

  const handleCopySvg = useCallback(async () => {
    const svg = lastSuccessfulSvg.current;
    if (!svg) {
      showToast("没有可复制的 SVG", "error");
      return;
    }
    try {
      // Add XML declaration to make it a valid SVG file
      const svgWithDeclaration = `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
      // Generate filename from current file name
      const filename = `${currentFile?.name.replace(/\.md$/, "") || "diagram"}.svg`;
      await invoke("copy_svg_to_clipboard", { svgContent: svgWithDeclaration, filename });
      showToast("SVG 已复制到剪贴板");
    } catch (err) {
      console.error("Copy failed", err);
      showToast("复制失败", "error");
    }
  }, [showToast, currentFile]);

  const handleCopyPng = useCallback(async () => {
    const svg = lastSuccessfulSvg.current;
    if (!svg) {
      showToast("没有可复制的 PNG", "error");
      return;
    }
    try {
      // Parse SVG to get dimensions
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svg, "image/svg+xml");
      const svgElement = svgDoc.querySelector("svg");
      if (!svgElement) {
        showToast("无法解析 SVG", "error");
        return;
      }

      // Get SVG dimensions
      let width = parseFloat(svgElement.getAttribute("width") || "0");
      let height = parseFloat(svgElement.getAttribute("height") || "0");
      
      // If no width/height, try viewBox
      if (!width || !height) {
        const viewBox = svgElement.viewBox.baseVal;
        if (viewBox && viewBox.width && viewBox.height) {
          width = viewBox.width;
          height = viewBox.height;
        }
      }
      
      if (!width || !height) {
        showToast("无法获取 SVG 尺寸", "error");
        return;
      }

      // Ensure integer dimensions for canvas
      const canvasWidth = Math.ceil(width);
      const canvasHeight = Math.ceil(height);

      // Create canvas
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        showToast("无法创建 Canvas", "error");
        return;
      }

      // Fill background based on current preview background
      const bgColor = bg === "dark" ? "#1e1e1e" : "#ffffff";
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // Clone the SVG element to modify it
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
      
      // Ensure xmlns is set
      if (!clonedSvg.getAttribute('xmlns')) {
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      }
      
      // Set explicit width and height
      clonedSvg.setAttribute('width', String(width));
      clonedSvg.setAttribute('height', String(height));
      
      // Serialize to string
      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(clonedSvg);
      
      // Add XML declaration
      svgString = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgString;

      // Create image from SVG using base64 data URL (more reliable than blob URL)
      const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
      const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
      
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
          resolve();
        };
        img.onerror = (e) => {
          console.error("Image load error:", e);
          reject(new Error("Failed to load SVG image"));
        };
        img.src = dataUrl;
      });

      // Convert to PNG blob
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create PNG blob"));
          }
        }, "image/png");
      });

      // Convert blob to array buffer for Tauri
      const arrayBuffer = await pngBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Send to Rust to write to clipboard
      await invoke("write_blob_to_clipboard", { blob: Array.from(uint8Array) });
      showToast("PNG 已复制到剪贴板");
    } catch (err) {
      console.error("Copy PNG failed", err);
      showToast("复制 PNG 失败", "error");
    }
  }, [showToast, bg]);

  const hasSelectedFile = Boolean(currentFile);
  const isContentEmpty = !debouncedContent.trim();
  const showEmptyState = !hasSelectedFile || isContentEmpty;

  return (
    <div className={`preview-pane${isFullscreen ? " fullscreen" : ""}`}>
      <div className={`preview-header${isFullscreen ? " slim" : ""}`}>
        <h2>{isFullscreen ? "Preview 全窗口" : "Preview"}</h2>
        {error && !isFullscreen && <span className="error-text">渲染失败</span>}
        <div className="preview-copy-buttons">
          {onToggleFullscreen && (
            <button
              className="preview-copy-button preview-mode-toggle"
              onClick={onToggleFullscreen}
              title={isFullscreen ? "退出全窗口" : "全窗口预览"}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
          <button className="preview-copy-button" onClick={handleCopySvg} title="Copy SVG">
            <Copy size={14} />
          </button>
          <button className="preview-copy-button" onClick={handleCopyPng} title="Copy PNG">
            <ImageIcon size={14} />
          </button>
        </div>
      </div>
      <div
        className={`preview-content bg-${bg}${isDragging ? " dragging" : ""}`}
        ref={viewportRef}
        onWheelCapture={showEmptyState ? undefined : handleWheel}
        onMouseDown={showEmptyState ? undefined : handleMouseDown}
      >
        <div
          className="preview-transform"
          style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})` }}
        >
          <div className="preview-svg" ref={svgRef} />
        </div>

        {showEmptyState && (
          <div className="preview-empty-state">
            <p>暂无可预览内容</p>
          </div>
        )}

        {error && (
          <div className="preview-error-overlay">
            <p>渲染失败：{error}</p>
          </div>
        )}

        {!showEmptyState && (
          <>
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
          </>
        )}
      </div>
      {!isFullscreen && <ChatPane />}
      {toast.visible && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
