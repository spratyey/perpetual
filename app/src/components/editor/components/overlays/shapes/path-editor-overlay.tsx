import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentScale } from "remotion";
import { ShapeOverlay, OverlayType, Overlay } from "../../../types";
import { usePathEditContext } from "../../../contexts/path-edit-context";
import {
  AnchorPoint,
  parsePath,
  anchorPointsToPath,
  shapeToPathData,
  addPointOnSegment,
  removePoint,
  findClosestSegment,
  computePathBBox,
  Point,
} from "./svg-path-utils";

interface PathEditorOverlayProps {
  overlay: ShapeOverlay;
  changeOverlay: (
    overlayId: number,
    updater: (overlay: Overlay) => Overlay
  ) => void;
}

export const PathEditorOverlay: React.FC<PathEditorOverlayProps> = ({
  overlay,
  changeOverlay,
}) => {
  const scale = useCurrentScale();
  const { selectedAnchorIndices, setSelectedAnchorIndices, exitPathEdit } =
    usePathEditContext();
  const svgRef = useRef<SVGSVGElement>(null);

  // Get the current path data (from custom pathData or from preset)
  const { pathD, viewBox, parsed } = useMemo(() => {
    let d = overlay.styles.pathData;
    let vb = overlay.styles.pathViewBox || "0 0 100 100";

    if (!d) {
      const preset = shapeToPathData(overlay.content);
      if (preset) {
        d = preset.d;
        vb = preset.viewBox;
      }
    }

    const parsed = d ? parsePath(d) : { anchors: [], closed: false };
    return { pathD: d || "", viewBox: vb, parsed };
  }, [overlay.content, overlay.styles.pathData, overlay.styles.pathViewBox]);

  // Auto-commit pathData when entering path edit for shape without custom path.
  // This switches rendering from native SVG elements to <path d=...> so the
  // visual shape and the path editor are always in sync.
  const needsCommit = !overlay.styles.pathData && !!pathD;
  useLayoutEffect(() => {
    if (!needsCommit) return;
    changeOverlay(overlay.id, (o) => {
      const shape = o as ShapeOverlay;
      // Don't overwrite if pathData was set by another source in the meantime
      if (shape.styles.pathData) return shape;
      return {
        ...shape,
        styles: {
          ...shape.styles,
          pathData: pathD,
          pathViewBox: viewBox,
        },
      };
    });
  }, [needsCommit, overlay.id, pathD, viewBox, changeOverlay]);

  const anchors = parsed.anchors;
  const closed = parsed.closed;

  // Parse viewBox dimensions
  const vbParts = viewBox.split(" ").map(Number);
  const vbX = vbParts[0] || 0;
  const vbY = vbParts[1] || 0;
  const vbW = vbParts[2] || 100;
  const vbH = vbParts[3] || 100;

  // Update the overlay's pathData and resize overlay to fit new path bounds
  const updatePath = useCallback(
    (newAnchors: AnchorPoint[], newClosed: boolean) => {
      // Compute new bounding box of the path in current viewBox coords
      const bbox = computePathBBox(newAnchors, newClosed);
      const padding = 2;

      // Scale factors: how viewBox coords map to overlay pixel coords
      const scaleX = overlay.width / vbW;
      const scaleY = overlay.height / vbH;

      // New overlay position and size based on path bounds
      const newLeft = overlay.left + (bbox.minX - vbX - padding) * scaleX;
      const newTop = overlay.top + (bbox.minY - vbY - padding) * scaleY;
      const newWidth = (bbox.width + padding * 2) * scaleX;
      const newHeight = (bbox.height + padding * 2) * scaleY;

      // Normalize anchors so path starts near 0,0 with padding
      const offsetX = bbox.minX - padding;
      const offsetY = bbox.minY - padding;
      const normalizedAnchors = newAnchors.map((a) => {
        const na: AnchorPoint = { x: a.x - offsetX, y: a.y - offsetY };
        if (a.handleIn) na.handleIn = { x: a.handleIn.x - offsetX, y: a.handleIn.y - offsetY };
        if (a.handleOut) na.handleOut = { x: a.handleOut.x - offsetX, y: a.handleOut.y - offsetY };
        return na;
      });

      const newVbW = bbox.width + padding * 2;
      const newVbH = bbox.height + padding * 2;
      const newViewBox = `0 0 ${Math.round(newVbW * 100) / 100} ${Math.round(newVbH * 100) / 100}`;
      const newD = anchorPointsToPath(normalizedAnchors, newClosed);

      changeOverlay(overlay.id, (o) => {
        const shape = o as ShapeOverlay;
        return {
          ...shape,
          left: Math.round(newLeft),
          top: Math.round(newTop),
          width: Math.round(Math.max(newWidth, 10)),
          height: Math.round(Math.max(newHeight, 10)),
          styles: {
            ...shape.styles,
            pathData: newD,
            pathViewBox: newViewBox,
          },
        };
      });
    },
    [overlay.id, overlay.left, overlay.top, overlay.width, overlay.height, changeOverlay, vbX, vbY, vbW, vbH]
  );

  // Convert screen coordinates to viewBox coordinates
  const screenToViewBox = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!svgRef.current) return null;
      const rect = svgRef.current.getBoundingClientRect();
      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;
      return {
        x: vbX + relX * vbW,
        y: vbY + relY * vbH,
      };
    },
    [vbX, vbY, vbW, vbH]
  );

  // Drag anchor point
  const startDragAnchor = useCallback(
    (e: React.PointerEvent, anchorIndex: number) => {
      e.stopPropagation();
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const anchor = anchors[anchorIndex];
      const startAnchorX = anchor.x;
      const startAnchorY = anchor.y;

      // Select this anchor
      if (e.shiftKey) {
        setSelectedAnchorIndices((prev) =>
          prev.includes(anchorIndex)
            ? prev.filter((i) => i !== anchorIndex)
            : [...prev, anchorIndex]
        );
      } else {
        setSelectedAnchorIndices([anchorIndex]);
      }

      const onMove = (moveE: PointerEvent) => {
        const vbPoint = screenToViewBox(moveE.clientX, moveE.clientY);
        const startVb = screenToViewBox(startX, startY);
        if (!vbPoint || !startVb) return;

        const dx = vbPoint.x - startVb.x;
        const dy = vbPoint.y - startVb.y;

        const newAnchors = [...anchors];
        const a = { ...newAnchors[anchorIndex] };
        a.x = startAnchorX + dx;
        a.y = startAnchorY + dy;

        // Move handles with the point
        if (anchor.handleIn) {
          a.handleIn = {
            x: anchor.handleIn.x + dx,
            y: anchor.handleIn.y + dy,
          };
        }
        if (anchor.handleOut) {
          a.handleOut = {
            x: anchor.handleOut.x + dx,
            y: anchor.handleOut.y + dy,
          };
        }

        newAnchors[anchorIndex] = a;
        updatePath(newAnchors, closed);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [anchors, closed, updatePath, screenToViewBox, setSelectedAnchorIndices]
  );

  // Drag bezier handle
  const startDragHandle = useCallback(
    (
      e: React.PointerEvent,
      anchorIndex: number,
      handleType: "handleIn" | "handleOut"
    ) => {
      e.stopPropagation();
      e.preventDefault();

      const onMove = (moveE: PointerEvent) => {
        const vbPoint = screenToViewBox(moveE.clientX, moveE.clientY);
        if (!vbPoint) return;

        const newAnchors = [...anchors];
        const a = { ...newAnchors[anchorIndex] };
        a[handleType] = { x: vbPoint.x, y: vbPoint.y };

        // Mirror the opposite handle for smooth curves (unless Alt key held)
        if (!moveE.altKey) {
          const oppositeType =
            handleType === "handleIn" ? "handleOut" : "handleIn";
          const oppositeHandle = a[oppositeType];
          if (oppositeHandle) {
            const dx = vbPoint.x - a.x;
            const dy = vbPoint.y - a.y;
            const oppDist = Math.sqrt(
              (oppositeHandle.x - a.x) ** 2 + (oppositeHandle.y - a.y) ** 2
            );
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
              a[oppositeType] = {
                x: a.x - (dx / dist) * oppDist,
                y: a.y - (dy / dist) * oppDist,
              };
            }
          }
        }

        newAnchors[anchorIndex] = a;
        updatePath(newAnchors, closed);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [anchors, closed, updatePath, screenToViewBox]
  );

  // Click on path to add point
  const handlePathClick = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      const vbPoint = screenToViewBox(e.clientX, e.clientY);
      if (!vbPoint) return;

      const result = findClosestSegment(anchors, closed, vbPoint);
      if (result && result.distance < 8) {
        const newAnchors = addPointOnSegment(anchors, result.segmentIndex, result.t);
        updatePath(newAnchors, closed);
        setSelectedAnchorIndices([result.segmentIndex + 1]);
      }
    },
    [anchors, closed, updatePath, screenToViewBox, setSelectedAnchorIndices]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        exitPathEdit();
        return;
      }

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedAnchorIndices.length > 0
      ) {
        e.preventDefault();
        let newAnchors = [...anchors];
        // Remove selected indices in reverse order
        const sorted = [...selectedAnchorIndices].sort((a, b) => b - a);
        for (const idx of sorted) {
          newAnchors = removePoint(newAnchors, idx);
        }
        updatePath(newAnchors, closed);
        setSelectedAnchorIndices([]);
        return;
      }

      if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSelectedAnchorIndices(anchors.map((_, i) => i));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    exitPathEdit,
    selectedAnchorIndices,
    anchors,
    closed,
    updatePath,
    setSelectedAnchorIndices,
  ]);

  // Zoom-invariant sizes in screen pixels (constant on screen at any zoom).
  const ANCHOR_SCREEN_PX = 2;   // anchor point half-size on screen
  const HANDLE_SCREEN_PX = 1.5; // bezier handle radius on screen
  const STROKE_SCREEN_PX = 1;   // path outline width on screen
  const LINE_SCREEN_PX = 0.5;   // handle connector line width on screen

  // For SVG strokes we still need viewBox conversion (separate per axis since preserveAspectRatio="none")
  const screenToVBx = vbW / (overlay.width * scale);
  const screenToVBy = vbH / (overlay.height * scale);
  // Use the smaller factor for stroke widths so they look reasonable on both axes
  const screenToVBmin = Math.min(screenToVBx, screenToVBy);

  const pathStrokeWidth = STROKE_SCREEN_PX * screenToVBmin;

  // Convert a viewBox point to overlay-local pixel percentage (0-100%)
  const vbToPercent = useCallback(
    (vx: number, vy: number) => ({
      xPct: ((vx - vbX) / vbW) * 100,
      yPct: ((vy - vbY) / vbH) * 100,
    }),
    [vbX, vbY, vbW, vbH]
  );

  // Handle sizes in overlay-local pixels (divided by scale to stay constant on screen)
  const anchorSizeLocal = ANCHOR_SCREEN_PX / scale;
  const handleRadiusLocal = HANDLE_SCREEN_PX / scale;
  const lineWidthLocal = LINE_SCREEN_PX / scale;

  return (
    <div
      style={{
        position: "absolute",
        left: overlay.left,
        top: overlay.top,
        width: overlay.width,
        height: overlay.height,
        transform: `rotate(${overlay.rotation || 0}deg)`,
        transformOrigin: "center center",
        zIndex: 20000,
        pointerEvents: "none",
      }}
    >
      {/* SVG layer: only the path outline + hit area (no handles) */}
      <svg
        ref={svgRef}
        viewBox={viewBox}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        {/* Clickable path area for adding points */}
        <path
          d={pathD}
          fill="none"
          stroke="transparent"
          strokeWidth={pathStrokeWidth * 8}
          style={{ pointerEvents: "stroke", cursor: "crosshair" }}
          onPointerDown={handlePathClick}
        />

        {/* Visible path outline */}
        <path
          d={pathD}
          fill="none"
          stroke="#3B8BF2"
          strokeWidth={pathStrokeWidth}
          strokeDasharray={`${pathStrokeWidth * 3} ${pathStrokeWidth * 2}`}
          style={{ pointerEvents: "none" }}
        />
      </svg>

      {/* HTML handle layer: positioned as percentages so they match the SVG path */}
      <div style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
        {/* Handle lines and bezier handle circles */}
        {anchors.map((anchor, i) => {
          const anchorPos = vbToPercent(anchor.x, anchor.y);
          return (
            <React.Fragment key={`handles-${i}`}>
              {anchor.handleIn && (() => {
                const hPos = vbToPercent(anchor.handleIn.x, anchor.handleIn.y);
                return (
                  <>
                    {/* Connector line — rendered as a stretched div */}
                    <svg
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        overflow: "visible",
                        pointerEvents: "none",
                      }}
                    >
                      <line
                        x1={`${anchorPos.xPct}%`}
                        y1={`${anchorPos.yPct}%`}
                        x2={`${hPos.xPct}%`}
                        y2={`${hPos.yPct}%`}
                        stroke="#3B8BF2"
                        strokeWidth={lineWidthLocal}
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    {/* Bezier handle circle */}
                    <div
                      style={{
                        position: "absolute",
                        left: `${hPos.xPct}%`,
                        top: `${hPos.yPct}%`,
                        width: handleRadiusLocal * 2,
                        height: handleRadiusLocal * 2,
                        marginLeft: -handleRadiusLocal,
                        marginTop: -handleRadiusLocal,
                        borderRadius: "50%",
                        background: "white",
                        border: `${lineWidthLocal}px solid #3B8BF2`,
                        pointerEvents: "all",
                        cursor: "grab",
                        boxSizing: "border-box",
                      }}
                      onPointerDown={(e) => startDragHandle(e, i, "handleIn")}
                    />
                  </>
                );
              })()}
              {anchor.handleOut && (() => {
                const hPos = vbToPercent(anchor.handleOut.x, anchor.handleOut.y);
                return (
                  <>
                    <svg
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        overflow: "visible",
                        pointerEvents: "none",
                      }}
                    >
                      <line
                        x1={`${anchorPos.xPct}%`}
                        y1={`${anchorPos.yPct}%`}
                        x2={`${hPos.xPct}%`}
                        y2={`${hPos.yPct}%`}
                        stroke="#3B8BF2"
                        strokeWidth={lineWidthLocal}
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    <div
                      style={{
                        position: "absolute",
                        left: `${hPos.xPct}%`,
                        top: `${hPos.yPct}%`,
                        width: handleRadiusLocal * 2,
                        height: handleRadiusLocal * 2,
                        marginLeft: -handleRadiusLocal,
                        marginTop: -handleRadiusLocal,
                        borderRadius: "50%",
                        background: "white",
                        border: `${lineWidthLocal}px solid #3B8BF2`,
                        pointerEvents: "all",
                        cursor: "grab",
                        boxSizing: "border-box",
                      }}
                      onPointerDown={(e) => startDragHandle(e, i, "handleOut")}
                    />
                  </>
                );
              })()}
            </React.Fragment>
          );
        })}

        {/* Anchor points (rendered on top) */}
        {anchors.map((anchor, i) => {
          const isSelected = selectedAnchorIndices.includes(i);
          const pos = vbToPercent(anchor.x, anchor.y);
          return (
            <div
              key={`anchor-${i}`}
              style={{
                position: "absolute",
                left: `${pos.xPct}%`,
                top: `${pos.yPct}%`,
                width: anchorSizeLocal * 2,
                height: anchorSizeLocal * 2,
                marginLeft: -anchorSizeLocal,
                marginTop: -anchorSizeLocal,
                background: isSelected ? "#3B8BF2" : "white",
                border: `${lineWidthLocal}px solid #3B8BF2`,
                pointerEvents: "all",
                cursor: "move",
                boxSizing: "border-box",
              }}
              onPointerDown={(e) => startDragAnchor(e, i)}
            />
          );
        })}
      </div>
    </div>
  );
};
