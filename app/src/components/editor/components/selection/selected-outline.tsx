import React, { useCallback, useMemo, useRef } from "react";
import { useCurrentScale } from "remotion";
import { ResizeHandle } from "./resize-handle";
import { Overlay, OverlayType, ClipOverlay, CropEffect } from "../../types";
import { RotateHandle } from "./rotate-handle";
import { MAX_ROWS } from "../../constants";
import { computeSnap, SnapLine, Rect } from "./snap-utils";
import { usePathEditContext } from "../../contexts/path-edit-context";

const calculateCroppedDimensions = (overlay: Overlay, cropEffect?: CropEffect) => {
  if (!cropEffect || (overlay.type !== OverlayType.VIDEO && overlay.type !== OverlayType.IMAGE)) {
    return {
      width: overlay.width,
      height: overlay.height,
      left: overlay.left,
      top: overlay.top,
    };
  }

  const croppedWidth = (cropEffect.width / 100) * overlay.width;
  const croppedHeight = (cropEffect.height / 100) * overlay.height;
  const cropOffsetX = (cropEffect.x / 100) * overlay.width;
  const cropOffsetY = (cropEffect.y / 100) * overlay.height;

  return {
    width: croppedWidth,
    height: croppedHeight,
    left: overlay.left + cropOffsetX,
    top: overlay.top + cropOffsetY,
  };
};

export const SelectionOutline: React.FC<{
  overlay: Overlay;
  changeOverlay: (
    overlayId: number,
    updater: (overlay: Overlay) => Overlay
  ) => void;
  setSelectedOverlayId: React.Dispatch<React.SetStateAction<number | null>>;
  selectedOverlayId: number | null;
  selectedOverlayIds: number[];
  setSelectedOverlayIds: React.Dispatch<React.SetStateAction<number[]>>;
  isDragging: boolean;
  allOverlays: Overlay[];
  canvasWidth: number;
  canvasHeight: number;
  onSnapGuidesChange: (guides: SnapLine[]) => void;
}> = ({
  overlay,
  changeOverlay,
  setSelectedOverlayId,
  selectedOverlayId,
  selectedOverlayIds,
  setSelectedOverlayIds,
  isDragging,
  allOverlays,
  canvasWidth,
  canvasHeight,
  onSnapGuidesChange,
}) => {
  const scale = useCurrentScale();
  const scaledBorder = Math.ceil(1 / scale);
  const { pathEditingId, enterPathEdit, exitPathEdit, cropEditingId, enterCropEdit, exitCropEdit } = usePathEditContext();
  const isPathEditing = pathEditingId === overlay.id;
  const isCropEditing = cropEditingId === overlay.id;

  const [hovered, setHovered] = React.useState(false);
  const pendingDeselectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(() => {
    setHovered(true);
  }, []);

  const onMouseLeave = useCallback(() => {
    setHovered(false);
  }, []);

  const isSelected = selectedOverlayIds.includes(overlay.id);
  const isMultiSelect = selectedOverlayIds.length > 1;

  const style: React.CSSProperties = useMemo(() => {
    const baseZIndex = (MAX_ROWS - (overlay.row || 0)) * 10;
    const selectionBoost = isSelected ? 10000 : 1000;
    const zIndex = baseZIndex + selectionBoost;

    const cropEffect = overlay.type === OverlayType.VIDEO
      ? (overlay as ClipOverlay).styles?.cropEffect
      : overlay.type === OverlayType.IMAGE
      ? (overlay as any).styles?.cropEffect
      : undefined;

    const dimensions = calculateCroppedDimensions(overlay, cropEffect);

    return {
      width: dimensions.width,
      height: dimensions.height,
      left: dimensions.left,
      top: dimensions.top,
      position: "absolute",
      outline:
        (hovered && !isDragging) || isSelected
          ? `${scaledBorder}px solid #3B8BF2`
          : undefined,
      transform: `rotate(${overlay.rotation || 0}deg)`,
      transformOrigin: "center center",
      userSelect: "none",
      touchAction: "none",
      zIndex,
      pointerEvents: "all",
    };
  }, [overlay, hovered, isDragging, isSelected, scaledBorder, overlay.row]);

  const startDragging = useCallback(
    (e: PointerEvent | React.MouseEvent) => {
      const initialX = e.clientX;
      const initialY = e.clientY;
      let didDrag = false;
      const DRAG_THRESHOLD = 3; // px before we consider it a drag
      const isShift = e.shiftKey;
      const wasSelected = selectedOverlayIds.includes(overlay.id);

      // Snapshot values for drag at the point of pointerDown
      const idsToMove = wasSelected && selectedOverlayIds.length > 1
        ? selectedOverlayIds
        : [overlay.id];

      const initialPositions = new Map<number, { left: number; top: number }>();
      for (const id of idsToMove) {
        const o = allOverlays.find((ov) => ov.id === id);
        if (o) initialPositions.set(id, { left: o.left, top: o.top });
      }

      const otherRects: Rect[] = allOverlays
        .filter((o) => !idsToMove.includes(o.id) && o.type !== OverlayType.SOUND)
        .map((o) => ({ left: o.left, top: o.top, width: o.width, height: o.height }));

      const onPointerMove = (pointerMoveEvent: PointerEvent) => {
        if (!didDrag) {
          if (Math.abs(pointerMoveEvent.clientX - initialX) > DRAG_THRESHOLD ||
              Math.abs(pointerMoveEvent.clientY - initialY) > DRAG_THRESHOLD) {
            didDrag = true;
            // On drag start, ensure overlay is selected (don't deselect on drag)
            if (!wasSelected) {
              setSelectedOverlayIds([overlay.id]);
            }
          } else {
            return; // below threshold, ignore
          }
        }

        const offsetX = (pointerMoveEvent.clientX - initialX) / scale;
        const offsetY = (pointerMoveEvent.clientY - initialY) / scale;

        // For single drag, use snapping on the dragged overlay
        if (idsToMove.length === 1) {
          let newLeft = overlay.left + offsetX;
          let newTop = overlay.top + offsetY;

          const rawRect: Rect = {
            left: newLeft,
            top: newTop,
            width: overlay.width,
            height: overlay.height,
          };
          const snap = computeSnap(rawRect, otherRects, { w: canvasWidth, h: canvasHeight });
          newLeft = snap.x;
          newTop = snap.y;
          onSnapGuidesChange(snap.guides);

          changeOverlay(overlay.id, (o) => ({
            ...o,
            left: Math.round(newLeft),
            top: Math.round(newTop),
            isDragging: true,
          }));
        } else {
          // Multi-drag: move all selected overlays by the same delta
          onSnapGuidesChange([]);
          for (const id of idsToMove) {
            const init = initialPositions.get(id);
            if (!init) continue;
            changeOverlay(id, (o) => ({
              ...o,
              left: Math.round(init.left + offsetX),
              top: Math.round(init.top + offsetY),
              isDragging: true,
            }));
          }
        }
      };

      const onPointerUp = () => {
        onSnapGuidesChange([]);
        if (didDrag) {
          // Was a drag — clear isDragging flags
          for (const id of idsToMove) {
            changeOverlay(id, (o) => ({
              ...o,
              isDragging: false,
            }));
          }
        } else {
          // Was a click (no drag) — handle selection toggle
          if (isShift) {
            // Shift+click: toggle in multi-select
            setSelectedOverlayIds((prev) => {
              if (prev.includes(overlay.id)) {
                return prev.filter((id) => id !== overlay.id);
              }
              return [...prev, overlay.id];
            });
          } else if (wasSelected && selectedOverlayIds.length === 1) {
            // Click on sole selected overlay: deselect after a short delay.
            // This allows double-click to cancel the deselect and enter crop/edit mode.
            if (pendingDeselectTimer.current) clearTimeout(pendingDeselectTimer.current);
            pendingDeselectTimer.current = setTimeout(() => {
              setSelectedOverlayIds([]);
              pendingDeselectTimer.current = null;
            }, 250);
          } else {
            // Click on unselected, or click on one in multi-select without shift: single select
            setSelectedOverlayIds([overlay.id]);
          }
        }
        window.removeEventListener("pointermove", onPointerMove);
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerup", onPointerUp, { once: true });
    },
    [overlay, scale, changeOverlay, allOverlays, canvasWidth, canvasHeight, onSnapGuidesChange, selectedOverlayIds, setSelectedOverlayIds]
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // Cancel any pending deselect from the first click
      if (pendingDeselectTimer.current) {
        clearTimeout(pendingDeselectTimer.current);
        pendingDeselectTimer.current = null;
      }
      // Ensure the overlay is selected (in case of edge cases)
      if (!selectedOverlayIds.includes(overlay.id)) {
        setSelectedOverlayIds([overlay.id]);
      }
      if (overlay.type === OverlayType.SHAPE) {
        if (isPathEditing) {
          exitPathEdit();
        } else {
          enterPathEdit(overlay.id);
        }
      } else if (overlay.type === OverlayType.IMAGE || overlay.type === OverlayType.VIDEO) {
        if (isCropEditing) {
          exitCropEdit();
        } else {
          enterCropEdit(overlay.id);
        }
      }
    },
    [overlay.id, overlay.type, isPathEditing, isCropEditing, selectedOverlayIds, setSelectedOverlayIds, enterPathEdit, exitPathEdit, enterCropEdit, exitCropEdit]
  );

  const onPointerDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.button !== 0) {
        return;
      }

      // If we're path-editing a different shape, exit path edit
      if (pathEditingId !== null && pathEditingId !== overlay.id) {
        exitPathEdit();
      }
      // If we're crop-editing a different overlay, exit crop edit
      if (cropEditingId !== null && cropEditingId !== overlay.id) {
        exitCropEdit();
      }

      // Selection is deferred to pointerUp (click) or drag threshold (drag).
      // This prevents deselect-then-drag conflicts.
      startDragging(e);
    },
    [overlay.id, startDragging, pathEditingId, exitPathEdit, cropEditingId, exitCropEdit]
  );

  if (overlay.type === OverlayType.SOUND) {
    return null;
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onPointerEnter={onMouseEnter}
      onPointerLeave={onMouseLeave}
      style={style}
    >
      {isSelected && !isPathEditing && !isCropEditing ? (
        <>
          {/* Show all 8 handles for single select, only corners for multi-select */}
          {(isMultiSelect
            ? (["top-left", "top-right", "bottom-left", "bottom-right"] as const)
            : (["top-left", "top-right", "bottom-left", "bottom-right", "top", "bottom", "left", "right"] as const)
          ).map((handleType) => (
            <ResizeHandle
              key={handleType}
              overlay={overlay}
              setOverlay={changeOverlay}
              type={handleType}
              allOverlays={allOverlays}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              onSnapGuidesChange={onSnapGuidesChange}
            />
          ))}
          {!isMultiSelect && (
            <RotateHandle
              overlay={overlay}
              setOverlay={changeOverlay}
              scale={scale}
            />
          )}
        </>
      ) : null}
    </div>
  );
};
