import React from "react";
import { Minus, Plus, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface CanvasZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onZoomChange: (zoom: number) => void;
}

const tooltipClass =
  "bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md z-[9999] border border-border";
const kbdClass =
  "px-1 py-0.5 text-[10px] font-mono bg-foreground text-background rounded-md border border-border";

export const CanvasZoomControls: React.FC<CanvasZoomControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}) => {
  return (
    <div
      className="absolute top-2 right-2 z-50 flex items-center gap-0.5 rounded-md border border-border bg-background/95 backdrop-blur-sm px-1 py-0.5 shadow-sm"
      style={{ pointerEvents: "all" }}
    >
      <TooltipProvider delayDuration={50}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onZoomOut}
              size="icon"
              variant="ghost"
              className="h-6 w-6"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={5} className={tooltipClass}>
            <div className="flex items-center gap-1">
              Zoom out
              <kbd className={kbdClass}>Ctrl</kbd>
              <kbd className={kbdClass}>−</kbd>
            </div>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onReset}
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 min-w-[3rem] font-mono text-xs text-muted-foreground"
            >
              {Math.round(zoom * 100)}%
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={5} className={tooltipClass}>
            <div className="flex items-center gap-1">
              Reset zoom
              <kbd className={kbdClass}>Ctrl</kbd>
              <kbd className={kbdClass}>0</kbd>
            </div>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onZoomIn}
              size="icon"
              variant="ghost"
              className="h-6 w-6"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={5} className={tooltipClass}>
            <div className="flex items-center gap-1">
              Zoom in
              <kbd className={kbdClass}>Ctrl</kbd>
              <kbd className={kbdClass}>+</kbd>
            </div>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-4 mx-0.5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onReset}
              size="icon"
              variant="ghost"
              className="h-6 w-6"
            >
              <Maximize className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={5} className={tooltipClass}>
            <div className="flex items-center gap-1">
              Fit to view
              <kbd className={kbdClass}>Ctrl</kbd>
              <kbd className={kbdClass}>0</kbd>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
