import React, { useState } from "react";
import { ClipOverlay, CropEffect } from "../../../types";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Crop, RotateCcw } from "lucide-react";
import { CropCanvas } from "../../shared/crop-canvas";

/**
 * Props for the VideoStylePanel component
 * @interface VideoStylePanelProps
 * @property {ClipOverlay} localOverlay - The current overlay object containing video styles
 * @property {Function} handleStyleChange - Callback function to update overlay styles
 */
interface VideoStylePanelProps {
  localOverlay: ClipOverlay;
  handleStyleChange: (updates: Partial<ClipOverlay["styles"]>) => void;
}

/**
 * VideoStylePanel Component
 *
 * A panel that provides controls for styling video overlays. It allows users to adjust:
 * - Object fit (cover, contain, fill)
 * - Border radius
 * - Brightness
 *
 * The component uses a local overlay state and propagates changes through the handleStyleChange callback.
 * All style controls maintain both light and dark theme compatibility.
 *
 * @component
 * @param {VideoStylePanelProps} props - Component props
 * @returns {JSX.Element} A styled form containing video appearance controls
 */
export const VideoStylePanel: React.FC<VideoStylePanelProps> = ({
  localOverlay,
  handleStyleChange,
}) => {
  const [showCropControls, setShowCropControls] = useState(!!localOverlay?.styles?.cropEffect);

  const handleCropToggle = () => {
    if (localOverlay?.styles?.cropEffect) {
      // Remove crop
      handleStyleChange({ cropEffect: null as any });
      setShowCropControls(false);
    } else {
      // Add default crop (full frame)
      const defaultCrop: CropEffect = {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      };
      handleStyleChange({ cropEffect: defaultCrop });
      setShowCropControls(true);
    }
  };

  const handleCropChange = (crop: CropEffect) => {
    handleStyleChange({ cropEffect: crop });
  };

  const resetCrop = () => {
    const defaultCrop: CropEffect = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    };
    handleStyleChange({ cropEffect: defaultCrop });
  };

  return (
    <div className="space-y-6">
      {/* Appearance Settings */}
      <div className="space-y-4 rounded-md bg-muted/50 p-4 border border-border">
        <h3 className="text-sm font-medium text-foreground">
          Appearance
        </h3>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">
            Fit
          </label>
          <select
            value={localOverlay?.styles?.objectFit ?? "cover"}
            onChange={(e) =>
              handleStyleChange({ objectFit: e.target.value as any })
            }
            className="w-full bg-card border border-border rounded-md text-xs p-2 hover:border-border transition-colors text-foreground"
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="fill">Fill</option>
          </select>
        </div>

        {/* Border Radius */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">
              Border Radius
            </label>
            <span className="text-xs text-muted-foreground min-w-[40px] text-right">
              {parseInt(localOverlay?.styles?.borderRadius ?? "0")}px
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Slider
              value={[parseInt(localOverlay?.styles?.borderRadius ?? "0")]}
              onValueChange={([value]) =>
                handleStyleChange({ borderRadius: `${value}px` })
              }
              max={100}
              min={0}
              step={1}
              className="flex-1"
            />
            <input
              type="number"
              value={parseInt(localOverlay?.styles?.borderRadius ?? "0")}
              onChange={(e) =>
                handleStyleChange({ borderRadius: `${e.target.value}px` })
              }
              min="0"
              max="100"
              className="w-14 bg-card border border-border rounded text-xs p-1 text-center hover:border-border transition-colors text-foreground"
            />
          </div>
        </div>

        {/* Brightness */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Brightness</label>
            <span className="text-xs text-gray-400 min-w-[40px] text-right">
              {parseInt(
                localOverlay?.styles?.filter?.match(
                  /brightness\((\d+)%\)/
                )?.[1] ?? "100"
              )}
              %
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="200"
              step="10"
              value={parseInt(
                localOverlay?.styles?.filter?.match(
                  /brightness\((\d+)%\)/
                )?.[1] ?? "100"
              )}
              onChange={(e) => {
                const currentFilter = localOverlay?.styles?.filter || "";
                const newFilter =
                  currentFilter.replace(/brightness\(\d+%\)/, "") +
                  ` brightness(${e.target.value}%)`;
                handleStyleChange({ filter: newFilter.trim() });
              }}
              className="flex-1 accent-blue-500 h-1.5 rounded-full bg-muted"
            />
          </div>
        </div>

        {/* Crop */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Crop
            </label>
            <div className="flex items-center gap-2">
              {localOverlay?.styles?.cropEffect && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetCrop}
                  className="h-7 w-7 p-0 hover:bg-accent"
                  title="Reset crop"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
              <Button
                size="sm"
                variant={localOverlay?.styles?.cropEffect ? "default" : "outline"}
                onClick={handleCropToggle}
                className={`h-7 px-3 text-sm font-medium ${
                  localOverlay?.styles?.cropEffect
                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                    : "border-2 border-blue-500 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950"
                }`}
              >
                <Crop className="w-4 h-4 mr-2" />
                {localOverlay?.styles?.cropEffect ? "Remove Crop" : "Enable Crop"}
              </Button>
            </div>
          </div>

          {showCropControls && localOverlay?.styles?.cropEffect && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-3">
                <Crop className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Crop Controls Active
                </span>
              </div>
              <CropCanvas
                cropEffect={localOverlay.styles.cropEffect}
                onCropChange={handleCropChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
