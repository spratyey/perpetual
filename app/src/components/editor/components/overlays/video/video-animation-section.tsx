import React from "react";
import { ClipOverlay } from "../../../types";
import { AnimationTabs } from "../../shared/animation-tabs";

interface Props {
  localOverlay: ClipOverlay;
  handleStyleChange: (updates: Partial<ClipOverlay["styles"]>) => void;
}

export const VideoAnimationSection: React.FC<Props> = ({
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
