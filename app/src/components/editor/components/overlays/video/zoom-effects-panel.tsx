import React, { useState } from "react";
import { ClipOverlay, ZoomEffect } from "../../../types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ZoomIn, Target } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AnimationTabs } from "../../shared/animation-tabs";
import { PositionCanvas } from "../../shared/position-canvas";

/**
 * Props for the ZoomEffectsPanel component
 */
interface ZoomEffectsPanelProps {
  localOverlay: ClipOverlay;
  handleStyleChange: (updates: Partial<ClipOverlay["styles"]>) => void;
}

/**
 * ZoomEffectsPanel Component
 *
 * A responsive panel that allows users to add, edit, and manage multiple zoom effects
 * for video clips. Each zoom effect can have different timing, position, and magnitude.
 *
 * Features:
 * - Add multiple zoom effects
 * - Edit position (x, y coordinates)
 * - Set start and end frames
 * - Adjust zoom magnitude
 * - Choose easing function
 * - Delete individual effects
 *
 * @component
 */
export const ZoomEffectsPanel: React.FC<ZoomEffectsPanelProps> = ({
  localOverlay,
  handleStyleChange,
}) => {
  const [editingEffectId, setEditingEffectId] = useState<string | null>(null);

  const zoomEffects = localOverlay?.styles?.zoomEffects || [];

  /**
   * Creates a new zoom effect with default values
   */
  const createNewZoomEffect = (): ZoomEffect => ({
    id: `zoom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    startFrame: 0,
    endFrame: 60, // Default 2 seconds at 30fps
    positionX: 50, // Center
    positionY: 50, // Center
    magnitude: 1.5, // 150% zoom (values < 1 = zoom out, > 1 = zoom in)
    easing: "ease-in-out",
  });

  /**
   * Adds a new zoom effect to the video
   */
  const addZoomEffect = () => {
    const newEffect = createNewZoomEffect();
    const updatedEffects = [...zoomEffects, newEffect];
    handleStyleChange({ zoomEffects: updatedEffects });
    setEditingEffectId(newEffect.id);
  };

  /**
   * Updates a specific zoom effect
   */
  const updateZoomEffect = (effectId: string, updates: Partial<ZoomEffect>) => {
    const updatedEffects = zoomEffects.map((effect) =>
      effect.id === effectId ? { ...effect, ...updates } : effect
    );
    handleStyleChange({ zoomEffects: updatedEffects });
  };

  /**
   * Removes a zoom effect
   */
  const removeZoomEffect = (effectId: string) => {
    const updatedEffects = zoomEffects.filter(
      (effect) => effect.id !== effectId
    );
    handleStyleChange({ zoomEffects: updatedEffects });
    if (editingEffectId === effectId) {
      setEditingEffectId(null);
    }
  };

  /**
   * Formats frame number to time display
   */
  const formatFramesToTime = (frames: number): string => {
    const seconds = frames / 30; // Assuming 30fps
    return `${seconds.toFixed(1)}s`;
  };

  /**
   * Converts time to frame number
   */
  const timeToFrames = (timeStr: string): number => {
    const seconds = parseFloat(timeStr);
    return Math.round(seconds * 30); // Assuming 30fps
  };

  return (
    <div className="space-y-6">
      {/* Enter/Exit Animations Section */}
      <div className="space-y-4 rounded-md bg-muted/50 p-3 border border-border">
        <h3 className="text-sm font-medium text-foreground">
          Enter & Exit Animations
        </h3>
        <AnimationTabs
          enterValue={localOverlay?.styles?.animation?.enter}
          exitValue={localOverlay?.styles?.animation?.exit}
          onEnterChange={(key) =>
            handleStyleChange({
              animation: {
                ...localOverlay?.styles?.animation,
                enter: key,
              },
            })
          }
          onExitChange={(key) =>
            handleStyleChange({
              animation: {
                ...localOverlay?.styles?.animation,
                exit: key,
              },
            })
          }
        />
      </div>

      {/* Zoom Effects Section */}
      <div className="space-y-4 rounded-md bg-muted/50 p-3 border border-border">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ZoomIn className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-medium text-foreground">
                Zoom Effects
              </h3>
              <Badge variant="secondary" className="text-xs">
                {zoomEffects.length}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={addZoomEffect}
              className="h-7 px-2 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Zoom
            </Button>
          </div>

          {/* Add Effect Button - Show when no effects */}
          {zoomEffects.length === 0 && (
            <Card className="border-dashed border-2 border-border">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <ZoomIn className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3 text-center">
                  No zoom effects added yet
                </p>
                <Button size="sm" onClick={addZoomEffect} className="text-xs">
                  <Plus className="w-3 h-3 mr-1" />
                  Add First Zoom Effect
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Zoom Effects List */}
          <div className="space-y-3">
            {zoomEffects.map((effect, index) => (
              <Card
                key={effect.id}
                className={`transition-all duration-200 ${
                  editingEffectId === effect.id
                    ? "border-blue-300 dark:border-blue-600 shadow-sm bg-blue-50/20 dark:bg-blue-950/20"
                    : "border-border hover:border-border"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-sm bg-blue-100 bg-primary/10">
                          <ZoomIn className="w-3 h-3 text-primary" />
                        </div>
                        <span>Zoom #{index + 1}</span>
                      </div>
                      <Badge variant="outline" className="text-xs font-normal">
                        {effect.magnitude.toFixed(1)}x
                        {effect.magnitude < 1 && (
                          <span className="ml-1 text-orange-500">↓</span>
                        )}
                        {effect.magnitude > 1 && (
                          <span className="ml-1 text-green-500">↑</span>
                        )}
                      </Badge>
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setEditingEffectId(
                            editingEffectId === effect.id ? null : effect.id
                          )
                        }
                        className="h-7 w-7 p-0 hover:bg-accent"
                      >
                        <Target
                          className={`w-3 h-3 transition-transform ${
                            editingEffectId === effect.id ? "rotate-90" : ""
                          }`}
                        />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => removeZoomEffect(effect.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-3 h-3 mr-2" />
                            Delete Effect
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>{" "}
                <CardContent className="pt-0 space-y-3">
                  {/* Summary when collapsed */}
                  {editingEffectId !== effect.id && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Duration</span>
                        </div>
                        <div className="font-medium text-foreground">
                          {formatFramesToTime(effect.startFrame)} →{" "}
                          {formatFramesToTime(effect.endFrame)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span>Focus Point</span>
                        </div>
                        <div className="font-medium text-foreground">
                          ({effect.positionX}%, {effect.positionY}%)
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detailed controls when expanded */}
                  {editingEffectId === effect.id && (
                    <div className="space-y-5">
                      {/* Timing Controls - Interactive Timeline */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-foreground">
                            Timing
                          </h4>
                          <span className="text-xs text-muted-foreground">
                            {(effect.startFrame / 30).toFixed(1)}s -{" "}
                            {(effect.endFrame / 30).toFixed(1)}s
                          </span>
                        </div>
                        <div className="space-y-3">
                          {/* Visual Timeline */}
                          <div
                            className="relative h-8 bg-muted rounded-lg cursor-pointer"
                            onClick={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              const clickX = e.clientX - rect.left;
                              const percentage = clickX / rect.width;
                              const clickTime =
                                percentage *
                                (localOverlay.durationInFrames / 30);

                              // Determine if click is closer to start or end
                              const startTime = effect.startFrame / 30;
                              const endTime = effect.endFrame / 30;
                              const distToStart = Math.abs(
                                clickTime - startTime
                              );
                              const distToEnd = Math.abs(clickTime - endTime);

                              if (distToStart < distToEnd) {
                                // Move start time, but ensure it doesn't exceed end time
                                const newStartTime = Math.min(
                                  clickTime,
                                  endTime - 0.1
                                );
                                updateZoomEffect(effect.id, {
                                  startFrame: timeToFrames(
                                    newStartTime.toString()
                                  ),
                                });
                              } else {
                                // Move end time, but ensure it doesn't go before start time
                                const newEndTime = Math.max(
                                  clickTime,
                                  startTime + 0.1
                                );
                                updateZoomEffect(effect.id, {
                                  endFrame: timeToFrames(newEndTime.toString()),
                                });
                              }
                            }}
                          >
                            {/* Active range */}
                            <div
                              className="absolute h-full bg-blue-500 rounded-lg"
                              style={{
                                left: `${
                                  (effect.startFrame /
                                    30 /
                                    (localOverlay.durationInFrames / 30)) *
                                  100
                                }%`,
                                width: `${
                                  ((effect.endFrame - effect.startFrame) /
                                    30 /
                                    (localOverlay.durationInFrames / 30)) *
                                  100
                                }%`,
                              }}
                            />

                            {/* Start handle */}
                            <div
                              className="absolute top-1/2 w-4 h-6 bg-blue-600 border-2 border-white rounded-sm shadow-md transform -translate-y-1/2 -translate-x-1/2 cursor-ew-resize hover:bg-blue-700 transition-colors z-20"
                              style={{
                                left: `${
                                  (effect.startFrame /
                                    30 /
                                    (localOverlay.durationInFrames / 30)) *
                                  100
                                }%`,
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                // Capture the parent element reference before starting drag
                                const parentElement = e.currentTarget.parentElement as HTMLElement;
                                if (!parentElement) return;

                                const startDrag = (dragEvent: MouseEvent) => {
                                  const rect = parentElement.getBoundingClientRect();
                                  if (!rect) return;
                                  const percentage = Math.max(
                                    0,
                                    Math.min(
                                      1,
                                      (dragEvent.clientX - rect.left) /
                                        rect.width
                                    )
                                  );
                                  const newTime =
                                    percentage *
                                    (localOverlay.durationInFrames / 30);
                                  const maxTime = Math.min(
                                    effect.endFrame / 30 - 0.1,
                                    localOverlay.durationInFrames / 30
                                  );
                                  updateZoomEffect(effect.id, {
                                    startFrame: timeToFrames(
                                      Math.min(newTime, maxTime).toString()
                                    ),
                                  });
                                };

                                const stopDrag = () => {
                                  document.removeEventListener(
                                    "mousemove",
                                    startDrag
                                  );
                                  document.removeEventListener(
                                    "mouseup",
                                    stopDrag
                                  );
                                };

                                document.addEventListener(
                                  "mousemove",
                                  startDrag
                                );
                                document.addEventListener("mouseup", stopDrag);
                              }}
                            >
                              <div className="text-xs text-white font-bold text-center leading-5">
                                S
                              </div>
                            </div>

                            {/* End handle */}
                            <div
                              className="absolute top-1/2 w-4 h-6 bg-blue-800 border-2 border-white rounded-sm shadow-md transform -translate-y-1/2 translate-x-1/2 cursor-ew-resize hover:bg-blue-900 transition-colors z-20"
                              style={{
                                left: `${
                                  (effect.endFrame /
                                    30 /
                                    (localOverlay.durationInFrames / 30)) *
                                  100
                                }%`,
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                // Capture the parent element reference before starting drag
                                const parentElement = e.currentTarget.parentElement as HTMLElement;
                                if (!parentElement) return;

                                const startDrag = (dragEvent: MouseEvent) => {
                                  const rect = parentElement.getBoundingClientRect();
                                  if (!rect) return;
                                  const percentage = Math.max(
                                    0,
                                    Math.min(
                                      1,
                                      (dragEvent.clientX - rect.left) /
                                        rect.width
                                    )
                                  );
                                  const newTime =
                                    percentage *
                                    (localOverlay.durationInFrames / 30);
                                  const minTime = Math.max(
                                    effect.startFrame / 30 + 0.1,
                                    0
                                  );
                                  updateZoomEffect(effect.id, {
                                    endFrame: timeToFrames(
                                      Math.max(newTime, minTime).toString()
                                    ),
                                  });
                                };

                                const stopDrag = () => {
                                  document.removeEventListener(
                                    "mousemove",
                                    startDrag
                                  );
                                  document.removeEventListener(
                                    "mouseup",
                                    stopDrag
                                  );
                                };

                                document.addEventListener(
                                  "mousemove",
                                  startDrag
                                );
                                document.addEventListener("mouseup", stopDrag);
                              }}
                            >
                              <div className="text-xs text-white font-bold text-center leading-5">
                                E
                              </div>
                            </div>
                          </div>

                          {/* Fine-tune controls */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">
                                Start
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max={Math.min(
                                  effect.endFrame / 30 - 0.1,
                                  localOverlay.durationInFrames / 30
                                )}
                                value={(effect.startFrame / 30).toFixed(1)}
                                onChange={(e) =>
                                  updateZoomEffect(effect.id, {
                                    startFrame: timeToFrames(e.target.value),
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border border-border rounded bg-card text-foreground"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">
                                End
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min={Math.max(effect.startFrame / 30 + 0.1, 0)}
                                max={localOverlay.durationInFrames / 30}
                                value={(effect.endFrame / 30).toFixed(1)}
                                onChange={(e) =>
                                  updateZoomEffect(effect.id, {
                                    endFrame: timeToFrames(e.target.value),
                                  })
                                }
                                className="w-full px-2 py-1 text-xs border border-border rounded bg-card text-foreground"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Position Controls */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-foreground">
                          Focus Point
                        </h4>
                        <PositionCanvas
                          positionX={effect.positionX}
                          positionY={effect.positionY}
                          onPositionChange={(x, y) =>
                            updateZoomEffect(effect.id, {
                              positionX: x,
                              positionY: y,
                            })
                          }
                          showPixelCoordinates={false}
                        />
                      </div>

                      {/* Zoom Magnitude - Minimal */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-foreground">
                            Zoom
                          </h4>
                          <span className="text-sm font-medium text-blue-600">
                            {effect.magnitude.toFixed(1)}x
                          </span>
                        </div>
                        <Slider
                          value={[effect.magnitude]}
                          onValueChange={([value]) =>
                            updateZoomEffect(effect.id, { magnitude: value })
                          }
                          max={5}
                          min={0.1}
                          step={0.1}
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
