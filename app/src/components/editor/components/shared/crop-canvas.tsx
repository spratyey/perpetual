import React, { useRef, useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { CropEffect } from "../../types";

interface CropCanvasProps {
  cropEffect: CropEffect | null;
  onCropChange: (crop: CropEffect) => void;
  width?: number;
  height?: number;
  mediaSrc?: string;
  mediaType?: "image" | "video";
}

export const CropCanvas: React.FC<CropCanvasProps> = ({
  cropEffect,
  onCropChange,
  width = 240,
  height = 135,
  mediaSrc,
  mediaType = "image",
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const defaultCrop: CropEffect = { x: 0, y: 0, width: 100, height: 100 };
  const currentCrop = cropEffect || defaultCrop;

  const handlePointerDown = useCallback((
    event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
    type: 'move' | 'resize',
    handle?: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);

    const startCrop = { ...currentCrop };

    const getPos = (ev: MouseEvent | TouchEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const clientX = 'touches' in ev ? ev.touches[0]?.clientX ?? 0 : ev.clientX;
      const clientY = 'touches' in ev ? ev.touches[0]?.clientY ?? 0 : ev.clientY;
      return {
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100,
      };
    };

    const startPos = (() => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      const ev = event.nativeEvent as MouseEvent;
      return {
        x: ((ev.clientX - rect.left) / rect.width) * 100,
        y: ((ev.clientY - rect.top) / rect.height) * 100,
      };
    })();

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const pos = getPos(ev);
      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;

      if (type === 'move') {
        const newX = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + dx));
        const newY = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + dy));
        onCropChange({ ...startCrop, x: newX, y: newY });
      } else if (type === 'resize' && handle) {
        let { x, y, width: w, height: h } = startCrop;

        if (handle.includes('w')) {
          const newX = Math.max(0, Math.min(x + w - 5, x + dx));
          w = w + (x - newX);
          x = newX;
        }
        if (handle.includes('e')) {
          w = Math.max(5, Math.min(100 - x, w + dx));
        }
        if (handle.includes('n')) {
          const newY = Math.max(0, Math.min(y + h - 5, y + dy));
          h = h + (y - newY);
          y = newY;
        }
        if (handle.includes('s')) {
          h = Math.max(5, Math.min(100 - y, h + dy));
        }

        onCropChange({ x, y, width: w, height: h });
      }
    };

    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
  }, [currentCrop, onCropChange]);

  const canvasW = width - 16;
  const canvasH = height - 16;

  const MediaEl = mediaSrc ? (
    mediaType === "video" ? (
      <video src={mediaSrc} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
    ) : (
      <img src={mediaSrc} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
    )
  ) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">Crop Area</label>
        <span className="text-xs text-muted-foreground">
          {Math.round(currentCrop.width)}% × {Math.round(currentCrop.height)}%
        </span>
      </div>

      <Card className="relative bg-black border border-border p-2">
        <div
          ref={canvasRef}
          className="relative overflow-hidden rounded-sm"
          style={{ width: canvasW, height: canvasH, cursor: isDragging ? 'grabbing' : 'crosshair' }}
        >
          {/* Layer 1: Full media, dimmed */}
          <div className="absolute inset-0">
            {MediaEl}
            {!mediaSrc && (
              <div className="absolute inset-0 bg-muted" />
            )}
            <div className="absolute inset-0 bg-black/60" />
          </div>

          {/* Layer 2: Bright media clipped to crop area */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              clipPath: `inset(${currentCrop.y}% ${100 - currentCrop.x - currentCrop.width}% ${100 - currentCrop.y - currentCrop.height}% ${currentCrop.x}%)`,
            }}
          >
            {mediaSrc ? (
              mediaType === "video" ? (
                <video src={mediaSrc} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
              ) : (
                <img src={mediaSrc} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
              )
            ) : (
              <div className="absolute inset-0 bg-muted" />
            )}
          </div>

          {/* Layer 3: Crop border + handles */}
          <div
            className="absolute border-2 border-blue-500 cursor-grab"
            style={{
              left: `${currentCrop.x}%`,
              top: `${currentCrop.y}%`,
              width: `${currentCrop.width}%`,
              height: `${currentCrop.height}%`,
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            onMouseDown={(e) => handlePointerDown(e, 'move')}
            onTouchStart={(e) => handlePointerDown(e, 'move')}
          >
            {/* Rule of thirds grid */}
            <div className="absolute inset-0 pointer-events-none opacity-30">
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white" />
            </div>

            {/* Corner handles */}
            {['nw', 'ne', 'sw', 'se'].map((h) => (
              <div
                key={h}
                className="absolute w-2.5 h-2.5 bg-blue-500 border border-white shadow-sm"
                style={{
                  cursor: h === 'nw' || h === 'se' ? 'nwse-resize' : 'nesw-resize',
                  [h.includes('n') ? 'top' : 'bottom']: '-5px',
                  [h.includes('w') ? 'left' : 'right']: '-5px',
                }}
                onMouseDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'resize', h); }}
                onTouchStart={(e) => { e.stopPropagation(); handlePointerDown(e, 'resize', h); }}
              />
            ))}

            {/* Edge handles */}
            {['n', 's', 'w', 'e'].map((h) => (
              <div
                key={h}
                className="absolute bg-blue-500 border border-white shadow-sm"
                style={{
                  cursor: h === 'n' || h === 's' ? 'ns-resize' : 'ew-resize',
                  ...(h === 'n' || h === 's'
                    ? { left: '50%', width: 14, height: 3, transform: 'translateX(-50%)', [h === 'n' ? 'top' : 'bottom']: '-2px' }
                    : { top: '50%', width: 3, height: 14, transform: 'translateY(-50%)', [h === 'w' ? 'left' : 'right']: '-2px' }),
                }}
                onMouseDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'resize', h); }}
                onTouchStart={(e) => { e.stopPropagation(); handlePointerDown(e, 'resize', h); }}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Coordinate inputs */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        {[
          { label: "X", key: "x" as const, max: 100 - currentCrop.width },
          { label: "Y", key: "y" as const, max: 100 - currentCrop.height },
          { label: "W", key: "width" as const, max: 100 - currentCrop.x, min: 5 },
          { label: "H", key: "height" as const, max: 100 - currentCrop.y, min: 5 },
        ].map(({ label, key, max, min }) => (
          <div key={key} className="space-y-1">
            <label className="text-muted-foreground">{label}</label>
            <input
              type="number"
              min={min ?? 0}
              max={max}
              step="1"
              value={Math.round(currentCrop[key])}
              onChange={(e) => {
                const val = Math.max(min ?? 0, Math.min(max, Number(e.target.value)));
                onCropChange({ ...currentCrop, [key]: val });
              }}
              className="w-full px-1 py-1 text-xs border border-border rounded bg-card text-foreground"
            />
          </div>
        ))}
      </div>
    </div>
  );
};
