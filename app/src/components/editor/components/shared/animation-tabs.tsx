import React, { useState } from "react";
import { AnimationPreview } from "./animation-preview";
import { animationTemplates, AnimationTemplate } from "../../templates/animation-templates";

const NONE_ANIMATION: AnimationTemplate = {
  name: "None",
  preview: "No animation",
  category: "basic",
  enter: () => ({}),
  exit: () => ({}),
};

const CATEGORIES = [
  { key: "basic", label: "Basic" },
  { key: "slide", label: "Slide" },
  { key: "advanced", label: "Advanced" },
] as const;

interface AnimationTabsProps {
  enterValue: string | undefined;
  exitValue: string | undefined;
  onEnterChange: (key: string) => void;
  onExitChange: (key: string) => void;
}

export const AnimationTabs: React.FC<AnimationTabsProps> = ({
  enterValue,
  exitValue,
  onEnterChange,
  onExitChange,
}) => {
  const [tab, setTab] = useState<"enter" | "exit">("enter");

  const selectedKey = tab === "enter" ? enterValue : exitValue;
  const onSelect = tab === "enter" ? onEnterChange : onExitChange;

  const grouped = CATEGORIES.map(({ key, label }) => ({
    label,
    isBasic: key === "basic",
    items: Object.entries(animationTemplates).filter(
      ([, anim]) => anim.category === key
    ),
  }));

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex rounded-lg bg-muted p-[3px]">
        <button
          onClick={() => setTab("enter")}
          className={`flex-1 rounded-md px-3 py-1 text-xs font-medium transition-all ${
            tab === "enter"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Enter
        </button>
        <button
          onClick={() => setTab("exit")}
          className={`flex-1 rounded-md px-3 py-1 text-xs font-medium transition-all ${
            tab === "exit"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Exit
        </button>
      </div>

      {/* Animation grid */}
      <div className="space-y-3">
        {grouped.map(({ label, items, isBasic }) => (
          <div key={label} className="space-y-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {isBasic && (
                <AnimationPreview
                  animationKey="none"
                  animation={NONE_ANIMATION}
                  isSelected={!selectedKey || selectedKey === "none"}
                  onClick={() => onSelect("none")}
                />
              )}
              {items.map(([key, anim]) => (
                <AnimationPreview
                  key={key}
                  animationKey={key}
                  animation={anim}
                  isSelected={selectedKey === key}
                  onClick={() => onSelect(key)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
