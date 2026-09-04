import React from "react";
import { ClipOverlay } from "../../../types";

/**
 * Props for the VideoSettingsPanel component
 * @interface VideoSettingsPanelProps
 * @property {ClipOverlay} localOverlay - The current overlay object containing video settings and styles
 * @property {Function} handleStyleChange - Callback function to update overlay styles
 */
interface VideoSettingsPanelProps {
  localOverlay: ClipOverlay;
  handleStyleChange: (updates: Partial<ClipOverlay["styles"]>) => void;
}

/**
 * VideoSettingsPanel Component
 *
 * A panel that provides controls for configuring video overlay settings including:
 * - Volume control with mute/unmute functionality
 * - Enter/Exit animation selection
 *
 * The component uses a local overlay state and provides a UI for users to modify
 * video-specific settings. Changes are propagated through the handleStyleChange callback.
 *
 * @component
 * @param {VideoSettingsPanelProps} props - Component props
 * @returns {JSX.Element} The rendered settings panel
 */
export const VideoSettingsPanel: React.FC<VideoSettingsPanelProps> = ({
  localOverlay,
  handleStyleChange,
}) => {
  return (
    <div className="space-y-6">
      {/* Video Preview */}
      {localOverlay?.src && (
        <div className="space-y-4 rounded-md bg-muted/50 p-4 border border-border">
          <h3 className="text-sm font-medium text-foreground">
            Video Preview
          </h3>
          <div className="relative aspect-video bg-black rounded-md overflow-hidden">
            <video
              src={localOverlay.src}
              className="w-full h-full object-contain"
              muted
              playsInline
              preload="metadata"
              style={{
                objectFit: localOverlay?.styles?.objectFit || "contain",
                objectPosition:
                  localOverlay?.styles?.objectPosition || "center",
                filter: localOverlay?.styles?.filter || "none",
                borderRadius: localOverlay?.styles?.borderRadius || "0",
                boxShadow: localOverlay?.styles?.boxShadow || "none",
                border: localOverlay?.styles?.border || "none",
              }}
            />
            {/* <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/30 rounded-full p-2">
                <svg
                  className="w-8 h-8 text-white/70"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div> */}
          </div>
        </div>
      )}

      {/* Volume Settings */}
      <div className="space-y-4 rounded-md bg-muted/50 p-4 border border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">
            Volume
          </h3>
          <button
            onClick={() =>
              handleStyleChange({
                volume: localOverlay?.styles?.volume === 0 ? 1 : 0,
              })
            }
            className={`text-xs px-2.5 py-1.5 rounded-md transition-colors ${
              (localOverlay?.styles?.volume ?? 1) === 0
                ? "bg-blue-500/20 text-primary hover:bg-blue-500/30"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {(localOverlay?.styles?.volume ?? 1) === 0 ? "Unmute" : "Mute"}
          </button>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={localOverlay?.styles?.volume ?? 1}
            onChange={(e) =>
              handleStyleChange({ volume: parseFloat(e.target.value) })
            }
            className="flex-1 accent-blue-500 h-1.5 rounded-full bg-muted"
          />
          <span className="text-xs text-muted-foreground min-w-[40px] text-right">
            {Math.round((localOverlay?.styles?.volume ?? 1) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};
