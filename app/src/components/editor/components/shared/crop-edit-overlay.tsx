import React, { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentScale } from "remotion";
import { Overlay, OverlayType, ImageOverlay, ClipOverlay, CropEffect } from "../../types";
import { usePathEditContext } from "../../contexts/path-edit-context";

interface CropEditOverlayProps {
  overlay: Overlay;
  changeOverlay: (overlayId: number, updater: (overlay: Overlay) => Overlay) => void;
}

const DEFAULT_CROP: CropEffect = { x: 0, y: 0, width: 100, height: 100 };

export const CropEditOverlay: React.FC<CropEditOverlayProps> = ({ overlay, changeOverlay }) => {
  const scale = useCurrentScale();
  const { exitCropEdit } = usePathEditContext();

  const existingCrop = (overlay as any).styles?.cropEffect as CropEffect | undefined;
  const [crop, setCrop] = useState<CropEffect>(existingCrop || { ...DEFAULT_CROP });
  const cropRef = useRef(crop);
  cropRef.current = crop;

  const mediaSrc = overlay.type === OverlayType.IMAGE
    ? (overlay as ImageOverlay).src
    : overlay.type === OverlayType.VIDEO
    ? (overlay as ClipOverlay).src || (overlay as ClipOverlay).content
    : "";

  const isVideo = overlay.type === OverlayType.VIDEO;

  // Save crop to the overlay (called on every change for live preview)
  const saveCrop = useCallback((cropVal: CropEffect) => {
    const isFullCrop = cropVal.x <= 0.5 && cropVal.y <= 0.5 && cropVal.width >= 99.5 && cropVal.height >= 99.5;
    changeOverlay(overlay.id, (prev) => ({
      ...prev,
      styles: {
        ...(prev as any).styles,
        cropEffect: isFullCrop ? undefined : cropVal,
      },
    }));
  }, [overlay.id, changeOverlay]);

  // Update crop state AND save to overlay
  const updateCrop = useCallback((newCrop: CropEffect) => {
    setCrop(newCrop);
    saveCrop(newCrop);
  }, [saveCrop]);

  // Keyboard: Escape/Enter to exit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        exitCropEdit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitCropEdit]);

  // Handle drag for moving and resizing crop
  const startDrag = useCallback((
    e: React.PointerEvent,
    type: "move" | "resize",
    handle?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const startCrop = { ...cropRef.current };
    const startX = e.clientX;
    const startY = e.clientY;

    const pxToPercX = 100 / (overlay.width * scale);
    const pxToPercY = 100 / (overlay.height * scale);

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) * pxToPercX;
      const dy = (ev.clientY - startY) * pxToPercY;

      let newCrop: CropEffect;

      if (type === "move") {
        const newX = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + dx));
        const newY = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + dy));
        newCrop = { ...startCrop, x: newX, y: newY };
      } else {
        let { x, y, width: w, height: h } = startCrop;

        if (handle?.includes("w")) {
          const newX = Math.max(0, Math.min(x + w - 5, x + dx));
          w = w + (x - newX);
          x = newX;
        }
        if (handle?.includes("e")) {
          w = Math.max(5, Math.min(100 - x, w + dx));
        }
        if (handle?.includes("n")) {
          const newY = Math.max(0, Math.min(y + h - 5, y + dy));
          h = h + (y - newY);
          y = newY;
        }
        if (handle?.includes("s")) {
          h = Math.max(5, Math.min(100 - y, h + dy));
        }

        newCrop = { x, y, width: w, height: h };
      }

      setCrop(newCrop);
    };

    const onUp = () => {
      // Save on pointer up
      saveCrop(cropRef.current);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [overlay.width, overlay.height, scale, saveCrop]);

  // Compute pixel positions for the crop rect within the overlay
  const cropPx = {
    left: (crop.x / 100) * overlay.width,
    top: (crop.y / 100) * overlay.height,
    width: (crop.width / 100) * overlay.width,
    height: (crop.height / 100) * overlay.height,
  };

  const handleSize = 8 / scale;
  const halfHandle = handleSize / 2;
  const borderWidth = 2 / scale;

  return (
    <>
      {/* Click-outside catcher — full canvas overlay behind everything */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 29999,
          cursor: "default",
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          exitCropEdit();
        }}
      />

      {/* Crop edit container — positioned at the overlay location */}
      <div
        style={{
          position: "absolute",
          left: overlay.left,
          top: overlay.top,
          width: overlay.width,
          height: overlay.height,
          transform: `rotate(${overlay.rotation || 0}deg)`,
          transformOrigin: "center center",
          zIndex: 30000,
          pointerEvents: "none",
        }}
      >
        {/* Full uncropped media at low opacity */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.3, overflow: "hidden" }}>
          {isVideo ? (
            <video src={mediaSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
          ) : (
            <img src={mediaSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} draggable={false} />
          )}
        </div>

        {/* Bright crop region */}
        <div
          style={{
            position: "absolute",
            left: cropPx.left,
            top: cropPx.top,
            width: cropPx.width,
            height: cropPx.height,
            overflow: "hidden",
          }}
        >
          {isVideo ? (
            <video
              src={mediaSrc}
              muted
              playsInline
              style={{
                position: "absolute",
                width: overlay.width,
                height: overlay.height,
                left: -cropPx.left,
                top: -cropPx.top,
                objectFit: "cover",
              }}
            />
          ) : (
            <img
              src={mediaSrc}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                width: overlay.width,
                height: overlay.height,
                left: -cropPx.left,
                top: -cropPx.top,
                objectFit: "cover",
              }}
            />
          )}
        </div>

        {/* Crop border — draggable to move */}
        <div
          style={{
            position: "absolute",
            left: cropPx.left,
            top: cropPx.top,
            width: cropPx.width,
            height: cropPx.height,
            border: `${borderWidth}px solid #3b82f6`,
            boxSizing: "border-box",
            cursor: "grab",
            pointerEvents: "all",
          }}
          onPointerDown={(e) => startDrag(e, "move")}
          onDoubleClick={(e) => {
            e.stopPropagation();
            exitCropEdit();
          }}
        >
          {/* Rule of thirds grid */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.4 }}>
            <div style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: Math.max(1, 1 / scale), background: "white" }} />
            <div style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: Math.max(1, 1 / scale), background: "white" }} />
            <div style={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: Math.max(1, 1 / scale), background: "white" }} />
            <div style={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: Math.max(1, 1 / scale), background: "white" }} />
          </div>
        </div>

        {/* Corner handles */}
        {(["nw", "ne", "sw", "se"] as const).map((h) => {
          const isTop = h.includes("n");
          const isLeft = h.includes("w");
          return (
            <div
              key={h}
              style={{
                position: "absolute",
                left: (isLeft ? cropPx.left : cropPx.left + cropPx.width) - halfHandle,
                top: (isTop ? cropPx.top : cropPx.top + cropPx.height) - halfHandle,
                width: handleSize,
                height: handleSize,
                background: "#3b82f6",
                border: `${Math.max(1, 1 / scale)}px solid white`,
                cursor: h === "nw" || h === "se" ? "nwse-resize" : "nesw-resize",
                pointerEvents: "all",
                zIndex: 1,
              }}
              onPointerDown={(e) => startDrag(e, "resize", h)}
            />
          );
        })}

        {/* Edge handles */}
        {(["n", "s", "w", "e"] as const).map((h) => {
          const isHoriz = h === "n" || h === "s";
          const edgeW = isHoriz ? Math.min(cropPx.width * 0.3, 20 / scale) : 3 / scale;
          const edgeH = isHoriz ? 3 / scale : Math.min(cropPx.height * 0.3, 20 / scale);
          let left: number, top: number;

          if (h === "n") { left = cropPx.left + cropPx.width / 2 - edgeW / 2; top = cropPx.top - edgeH / 2; }
          else if (h === "s") { left = cropPx.left + cropPx.width / 2 - edgeW / 2; top = cropPx.top + cropPx.height - edgeH / 2; }
          else if (h === "w") { left = cropPx.left - edgeW / 2; top = cropPx.top + cropPx.height / 2 - edgeH / 2; }
          else { left = cropPx.left + cropPx.width - edgeW / 2; top = cropPx.top + cropPx.height / 2 - edgeH / 2; }

          return (
            <div
              key={h}
              style={{
                position: "absolute",
                left,
                top,
                width: edgeW,
                height: edgeH,
                background: "#3b82f6",
                border: `${Math.max(1, 1 / scale)}px solid white`,
                cursor: isHoriz ? "ns-resize" : "ew-resize",
                pointerEvents: "all",
                zIndex: 1,
              }}
              onPointerDown={(e) => startDrag(e, "resize", h)}
            />
          );
        })}
      </div>
    </>
  );
};
