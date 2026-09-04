import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurrentScale } from "remotion";
import { Overlay, OverlayType } from "../../../types";
import { usePathEditContext } from "../../../contexts/path-edit-context";
import { useEditorContext } from "../../../contexts/editor-context";
import { useTimelinePositioning } from "../../../hooks/use-timeline-positioning";
import { Point, simplifyPath, pointsToSmoothPath, pointsBBox } from "./svg-path-utils";

interface DrawingOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
}

const STROKE_COLOR = "#a78bfa";
const STROKE_WIDTH = 3;

export const DrawingOverlay: React.FC<DrawingOverlayProps> = ({
  canvasWidth,
  canvasHeight,
}) => {
  const scale = useCurrentScale();
  const { drawingMode, setDrawingMode } = usePathEditContext();
  const { addOverlay, overlays, batchUpdate, currentFrame } = useEditorContext();
  const { findSmartPositionForType } = useTimelinePositioning();
  const svgRef = useRef<SVGSVGElement>(null);

  // Freehand state
  const [freehandPoints, setFreehandPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Pen tool state
  const [penPoints, setPenPoints] = useState<Point[]>([]);

  // Line tool state
  const [lineStart, setLineStart] = useState<Point | null>(null);
  const [lineEnd, setLineEnd] = useState<Point | null>(null);

  const toCanvas = useCallback((e: React.PointerEvent | PointerEvent): Point | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  }, [scale]);

  const createShapeOverlay = useCallback((
    pathD: string,
    points: Point[],
    shapeKey: string,
  ) => {
    const bbox = pointsBBox(points);
    const padding = 10;
    const left = bbox.minX - padding;
    const top = bbox.minY - padding;
    const width = Math.max(bbox.width + padding * 2, 20);
    const height = Math.max(bbox.height + padding * 2, 20);

    // Normalize path to local coordinates
    const normalizedPoints = points.map(p => ({ x: p.x - left, y: p.y - top }));
    const normalizedD = shapeKey === "drawn-line" || shapeKey === "arrow-line"
      ? `M ${normalizedPoints[0]?.x ?? 0},${normalizedPoints[0]?.y ?? 0} L ${normalizedPoints[normalizedPoints.length - 1]?.x ?? 0},${normalizedPoints[normalizedPoints.length - 1]?.y ?? 0}`
      : pointsToSmoothPath(normalizedPoints);

    const viewBox = `0 0 ${Math.round(width)} ${Math.round(height)}`;
    const { from, row, rowShifts } = findSmartPositionForType(overlays, 150, OverlayType.SHAPE, currentFrame);

    const arrowDefs = shapeKey === "arrow-line"
      ? ` M ${normalizedPoints[normalizedPoints.length - 1].x},${normalizedPoints[normalizedPoints.length - 1].y}`
      : "";

    let finalPath = normalizedD;
    // For arrow-line, append arrowhead geometry
    if (shapeKey === "arrow-line" && normalizedPoints.length >= 2) {
      const last = normalizedPoints[normalizedPoints.length - 1];
      const prev = normalizedPoints[normalizedPoints.length - 2];
      const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
      const headLen = 12;
      const a1x = last.x - headLen * Math.cos(angle - Math.PI / 6);
      const a1y = last.y - headLen * Math.sin(angle - Math.PI / 6);
      const a2x = last.x - headLen * Math.cos(angle + Math.PI / 6);
      const a2y = last.y - headLen * Math.sin(angle + Math.PI / 6);
      finalPath += ` M ${Math.round(a1x)},${Math.round(a1y)} L ${Math.round(last.x)},${Math.round(last.y)} L ${Math.round(a2x)},${Math.round(a2y)}`;
    }

    const newOverlay: Overlay = {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
      aspectRatioLocked: false,
      durationInFrames: 150,
      from,
      id: Date.now(),
      rotation: 0,
      row,
      isDragging: false,
      type: OverlayType.SHAPE,
      content: shapeKey,
      styles: {
        fill: "none",
        stroke: STROKE_COLOR,
        strokeWidth: STROKE_WIDTH,
        strokeLinecap: "round",
        opacity: 1,
        pathData: finalPath,
        pathViewBox: viewBox,
      },
    };
    if (rowShifts.length > 0 && batchUpdate) {
      const updates = rowShifts.map((s) => ({ id: s.id, overlay: { row: s.newRow } }));
      batchUpdate(updates, newOverlay);
    } else {
      addOverlay(newOverlay);
    }
  }, [addOverlay, overlays, findSmartPositionForType, batchUpdate, currentFrame]);

  // ── Freehand ──
  const onFreehandDown = useCallback((e: React.PointerEvent) => {
    const p = toCanvas(e);
    if (!p) return;
    setIsDrawing(true);
    setFreehandPoints([p]);
  }, [toCanvas]);

  const onFreehandMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing) return;
    const p = toCanvas(e);
    if (!p) return;
    setFreehandPoints(prev => [...prev, p]);
  }, [isDrawing, toCanvas]);

  const onFreehandUp = useCallback(() => {
    if (!isDrawing || freehandPoints.length < 2) {
      setIsDrawing(false);
      setFreehandPoints([]);
      return;
    }
    setIsDrawing(false);
    const simplified = simplifyPath(freehandPoints, 5);
    const d = pointsToSmoothPath(simplified);
    createShapeOverlay(d, simplified, "freehand");
    setFreehandPoints([]);
    setDrawingMode("none");
  }, [isDrawing, freehandPoints, createShapeOverlay, setDrawingMode]);

  // ── Line / Arrow-Line ──
  const onLineDown = useCallback((e: React.PointerEvent) => {
    const p = toCanvas(e);
    if (!p) return;
    setLineStart(p);
    setLineEnd(p);
  }, [toCanvas]);

  const onLineMove = useCallback((e: React.PointerEvent) => {
    if (!lineStart) return;
    let p = toCanvas(e);
    if (!p) return;

    // Shift for 45° snapping
    if (e.shiftKey) {
      const dx = p.x - lineStart.x;
      const dy = p.y - lineStart.y;
      const angle = Math.atan2(dy, dx);
      const snap = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.sqrt(dx * dx + dy * dy);
      p = { x: lineStart.x + len * Math.cos(snap), y: lineStart.y + len * Math.sin(snap) };
    }

    setLineEnd(p);
  }, [lineStart, toCanvas]);

  const onLineUp = useCallback(() => {
    if (!lineStart || !lineEnd) {
      setLineStart(null);
      setLineEnd(null);
      return;
    }
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    if (Math.sqrt(dx * dx + dy * dy) < 5) {
      setLineStart(null);
      setLineEnd(null);
      return;
    }
    const shapeKey = drawingMode === "arrow-line" ? "arrow-line" : "drawn-line";
    createShapeOverlay("", [lineStart, lineEnd], shapeKey);
    setLineStart(null);
    setLineEnd(null);
    setDrawingMode("none");
  }, [lineStart, lineEnd, drawingMode, createShapeOverlay, setDrawingMode]);

  // ── Pen Tool ──
  const CLOSE_THRESHOLD = 12; // pixels (in canvas space) to snap-close

  const onPenClick = useCallback((e: React.PointerEvent) => {
    if (e.detail === 2) {
      // Double-click to finish (open path)
      if (penPoints.length >= 2) {
        const d = pointsToSmoothPath(penPoints);
        createShapeOverlay(d, penPoints, "pen-path");
      }
      setPenPoints([]);
      setDrawingMode("none");
      return;
    }

    const p = toCanvas(e);
    if (!p) return;

    // If we have 3+ points and click near the first point, close the shape
    if (penPoints.length >= 3) {
      const first = penPoints[0];
      const dist = Math.sqrt((p.x - first.x) ** 2 + (p.y - first.y) ** 2);
      if (dist < CLOSE_THRESHOLD / scale) {
        const d = pointsToSmoothPath(penPoints, true);
        createShapeOverlay(d, penPoints, "pen-path");
        setPenPoints([]);
        setDrawingMode("none");
        return;
      }
    }

    setPenPoints(prev => [...prev, p]);
  }, [toCanvas, penPoints, createShapeOverlay, scale, setDrawingMode]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Finish pen if active
        if (drawingMode === "pen" && penPoints.length >= 2) {
          const d = pointsToSmoothPath(penPoints);
          createShapeOverlay(d, penPoints, "pen-path");
          setPenPoints([]);
        }
        setDrawingMode("none");
        setFreehandPoints([]);
        setLineStart(null);
        setLineEnd(null);
        setPenPoints([]);
      }
      if (e.key === "Enter" && drawingMode === "pen" && penPoints.length >= 2) {
        const d = pointsToSmoothPath(penPoints);
        createShapeOverlay(d, penPoints, "pen-path");
        setPenPoints([]);
        setDrawingMode("none");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawingMode, penPoints, setDrawingMode, createShapeOverlay]);

  // Compute event handlers based on mode
  const handlers = drawingMode === "freehand" ? {
    onPointerDown: onFreehandDown,
    onPointerMove: onFreehandMove,
    onPointerUp: onFreehandUp,
  } : drawingMode === "line" || drawingMode === "arrow-line" ? {
    onPointerDown: onLineDown,
    onPointerMove: onLineMove,
    onPointerUp: onLineUp,
  } : drawingMode === "pen" ? {
    onPointerDown: onPenClick,
  } : {};

  const cursor = drawingMode === "freehand" ? "crosshair"
    : drawingMode === "pen" ? "crosshair"
    : drawingMode === "line" || drawingMode === "arrow-line" ? "crosshair"
    : "default";

  // Render preview path for freehand (sample every 3rd point for performance)
  const freehandPreviewD = useMemo(() => {
    if (freehandPoints.length < 2) return "";
    const sampled = freehandPoints.filter((_, i) => i === 0 || i === freehandPoints.length - 1 || i % 3 === 0);
    return `M ${sampled.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(" L ")}`;
  }, [freehandPoints]);

  // Preview for line
  const linePreviewD = lineStart && lineEnd
    ? `M ${lineStart.x},${lineStart.y} L ${lineEnd.x},${lineEnd.y}`
    : "";

  // Arrow head preview for arrow-line
  let arrowHeadD = "";
  if (drawingMode === "arrow-line" && lineStart && lineEnd) {
    const angle = Math.atan2(lineEnd.y - lineStart.y, lineEnd.x - lineStart.x);
    const headLen = 12;
    const a1x = lineEnd.x - headLen * Math.cos(angle - Math.PI / 6);
    const a1y = lineEnd.y - headLen * Math.sin(angle - Math.PI / 6);
    const a2x = lineEnd.x - headLen * Math.cos(angle + Math.PI / 6);
    const a2y = lineEnd.y - headLen * Math.sin(angle + Math.PI / 6);
    arrowHeadD = `M ${a1x},${a1y} L ${lineEnd.x},${lineEnd.y} L ${a2x},${a2y}`;
  }

  // Preview for pen
  const penPreviewD = penPoints.length >= 2
    ? pointsToSmoothPath(penPoints)
    : penPoints.length === 1
    ? `M ${penPoints[0].x},${penPoints[0].y}`
    : "";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 25000,
        cursor,
        pointerEvents: "all",
      }}
      {...handlers}
    >
      <svg
        ref={svgRef}
        width={canvasWidth}
        height={canvasHeight}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        {/* Freehand preview */}
        {freehandPreviewD && (
          <path d={freehandPreviewD} fill="none" stroke={STROKE_COLOR} strokeWidth={STROKE_WIDTH / scale} strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Line preview */}
        {linePreviewD && (
          <>
            <path d={linePreviewD} fill="none" stroke={STROKE_COLOR} strokeWidth={STROKE_WIDTH / scale} strokeLinecap="round" />
            {arrowHeadD && (
              <path d={arrowHeadD} fill="none" stroke={STROKE_COLOR} strokeWidth={STROKE_WIDTH / scale} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </>
        )}

        {/* Pen preview */}
        {penPreviewD && (
          <>
            <path d={penPreviewD} fill="none" stroke={STROKE_COLOR} strokeWidth={STROKE_WIDTH / scale} strokeLinecap="round" />
            {penPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={(i === 0 && penPoints.length >= 3 ? 6 : 4) / scale}
                fill={i === 0 && penPoints.length >= 3 ? STROKE_COLOR : "white"}
                stroke={i === 0 && penPoints.length >= 3 ? "white" : STROKE_COLOR}
                strokeWidth={1.5 / scale}
              />
            ))}
          </>
        )}
      </svg>

      {/* Mode indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "4px 12px",
          borderRadius: 6,
          fontSize: 11,
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        {drawingMode === "freehand" && "Draw freely · Esc to cancel"}
        {drawingMode === "pen" && (penPoints.length === 0 ? "Click to place points · Click first point to close shape" : penPoints.length >= 3 ? `${penPoints.length} points · Click first point to close · Enter to finish open` : `${penPoints.length} points · Double-click or Enter to finish`)}
        {drawingMode === "line" && "Click and drag to draw a line · Hold Shift for 45° snap"}
        {drawingMode === "arrow-line" && "Click and drag to draw an arrow · Hold Shift for 45° snap"}
      </div>
    </div>
  );
};
