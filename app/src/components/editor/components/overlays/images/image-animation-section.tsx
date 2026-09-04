import React from "react";
import { ImageOverlay } from "../../../types";
import { AnimationTabs } from "../../shared/animation-tabs";

interface Props {
  localOverlay: ImageOverlay;
  handleStyleChange: (updates: Partial<ImageOverlay["styles"]>) => void;
}

export const ImageAnimationSection: React.FC<Props> = ({
  localOverlay,
  handleStyleChange,
}) => {
  const setEnter = (key: string) => {
    handleStyleChange({
      animation: { ...localOverlay?.styles?.animation, enter: key },
    });
  };

  const setExit = (key: string) => {
    handleStyleChange({
      animation: { ...localOverlay?.styles?.animation, exit: key },
    });
  };

  return (
    <AnimationTabs
      enterValue={localOverlay?.styles?.animation?.enter}
      exitValue={localOverlay?.styles?.animation?.exit}
      onEnterChange={setEnter}
      onExitChange={setExit}
    />
  );
};
