import React, { useState, useEffect, useRef } from "react";
import { AnimationTemplate } from "../../templates/animation-templates";

interface AnimationPreviewProps {
  animationKey: string;
  animation: AnimationTemplate;
  isSelected: boolean;
  onClick: () => void;
}

export const AnimationPreview: React.FC<AnimationPreviewProps> = ({
  animation,
  isSelected,
  onClick,
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const [frame, setFrame] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const isNone = animation.name === "None";
  const totalFrames = 40;
  const durationMs = 800;

  useEffect(() => {
    if (!isHovering || isNone) {
      setFrame(0);
      return;
    }

    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / durationMs, 1);
      setFrame(Math.round(progress * totalFrames));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isHovering, isNone]);

  const getStyle = (): React.CSSProperties => {
    if (isNone || !isHovering) return {};
    const styles = animation.enter?.(frame, totalFrames) || {};
    return styles as React.CSSProperties;
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`relative flex flex-col items-center gap-1.5 rounded-md border p-2 transition-all duration-150 ${
        isSelected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card hover:border-muted-foreground/40 hover:bg-muted/50 text-muted-foreground hover:text-foreground"
      }`}
    >
      {/* Preview area */}
      <div className="relative w-full aspect-[4/3] rounded-sm bg-muted/30 overflow-hidden flex items-center justify-center">
        {isNone ? (
          <div className="w-8 h-5 rounded-[3px] border-2 border-dashed border-muted-foreground/25" />
        ) : (
          <div
            className={`w-8 h-5 rounded-[3px] shadow-sm ${
              isSelected
                ? "bg-primary"
                : isHovering
                  ? "bg-primary/80"
                  : "bg-muted-foreground/30"
            }`}
            style={getStyle()}
          />
        )}
      </div>
      <span className="text-[10px] font-medium leading-none truncate w-full text-center">
        {animation.name}
      </span>
    </button>
  );
};
