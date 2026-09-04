import React from "react";
import { ImageOverlay } from "../../../types";
import { AnimationTabs } from "../../shared/animation-tabs";

/**
 * Props for the ImageSettingsPanel component
 */
interface ImageSettingsPanelProps {
  /** The current state of the image overlay being edited */
  localOverlay: ImageOverlay;
  /** Callback to update the overlay's style properties */
  handleStyleChange: (updates: Partial<ImageOverlay["styles"]>) => void;
}

/**
 * ImageSettingsPanel Component
 *
 * A panel that allows users to configure animation settings for an image overlay.
 * Provides options to set both enter and exit animations from a predefined set
 * of animation templates.
 *
 * Features:
 * - Enter animation selection
 * - Exit animation selection
 * - Option to remove animations ("None" selection)
 */
export const ImageSettingsPanel: React.FC<ImageSettingsPanelProps> = ({
  localOverlay,
  handleStyleChange,
}) => {
  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-md bg-muted/50 p-4 border border-border">
        <h3 className="text-sm font-medium text-foreground">Animations</h3>
        <AnimationTabs
          enterValue={localOverlay.styles.animation?.enter}
          exitValue={localOverlay.styles.animation?.exit}
          onEnterChange={(key) =>
            handleStyleChange({
              animation: {
                ...localOverlay.styles.animation,
                enter: key === "none" ? undefined : key,
              },
            })
          }
          onExitChange={(key) =>
            handleStyleChange({
              animation: {
                ...localOverlay.styles.animation,
                exit: key === "none" ? undefined : key,
              },
            })
          }
        />
      </div>
    </div>
  );
};
