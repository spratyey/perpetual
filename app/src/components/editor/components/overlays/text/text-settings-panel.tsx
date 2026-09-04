import React from "react";
import { TextOverlay } from "../../../types";
import { AnimationTabs } from "../../shared/animation-tabs";

interface TextSettingsPanelProps {
  localOverlay: TextOverlay;
  handleStyleChange: (field: keyof TextOverlay["styles"], value: any) => void;
}

export const TextSettingsPanel: React.FC<TextSettingsPanelProps> = ({
  localOverlay,
  handleStyleChange,
}) => {
  return (
    <AnimationTabs
      enterValue={localOverlay.styles.animation?.enter}
      exitValue={localOverlay.styles.animation?.exit}
      onEnterChange={(key) =>
        handleStyleChange("animation", {
          ...localOverlay.styles.animation,
          enter: key,
        })
      }
      onExitChange={(key) =>
        handleStyleChange("animation", {
          ...localOverlay.styles.animation,
          exit: key,
        })
      }
    />
  );
};
