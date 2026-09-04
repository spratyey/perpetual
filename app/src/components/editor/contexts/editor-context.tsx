import React, { createContext, useContext, ReactNode } from "react";
import type { HistoryEntry } from "@/local/use-local-project";
import {
  Overlay,
  AspectRatio,
  CaptionStyles,
  BackgroundConfig,
} from "../types";

// Define the shape of the context
interface EditorContextProps {
  // Overlay Management
  overlays: Overlay[]; // Array of all overlays in the editor
  selectedOverlayId: number | null; // Currently selected overlay's ID (first of multi-select)
  setSelectedOverlayId: any; // Function to select an overlay
  selectedOverlayIds: number[]; // All selected overlay IDs (multi-select)
  setSelectedOverlayIds: React.Dispatch<React.SetStateAction<number[]>>; // Set multi-select
  changeOverlay: (
    // Function to update overlay properties
    id: number,
    updater: Partial<Overlay> | ((overlay: Overlay) => Overlay)
  ) => void;
  setOverlays: (overlays: Overlay[]) => void;

  // Player State
  isPlaying: boolean; // Current playback state
  currentFrame: number; // Current frame position in the video
  playerRef: React.RefObject<any>; // Reference to the video player component

  // Player Controls
  togglePlayPause: () => void; // Toggle play/pause state
  seekTo: (frame: number) => void; // Seek to a specific frame
  formatTime: (frame: number) => string; // Convert frame number to timestamp
  handleTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void; // Handle timeline scrubbing

  // Overlay Operations
  handleOverlayChange: (updatedOverlay: Overlay) => void; // Handle changes to overlay properties
  addOverlay: (overlay: Overlay) => void; // Add new overlay
  deleteOverlay: (id: number) => void; // Remove overlay
  duplicateOverlay: (id: number) => void; // Clone existing overlay
  splitOverlay: (id: number, splitPosition: number) => void; // Split overlay at given position

  // Batch update (atomic multi-overlay mutations)
  batchUpdate?: (updates: Array<{ id: number; overlay: Partial<Overlay> }>, newOverlay?: any) => void;

  // Video Dimensions and Aspect Ratio
  aspectRatio: AspectRatio; // Current aspect ratio setting
  setAspectRatio: (ratio: AspectRatio) => void; // Update aspect ratio
  playerDimensions: { width: number; height: number }; // Current player dimensions
  updatePlayerDimensions: (width: number, height: number) => void; // Update player size
  getAspectRatioDimensions: () => { width: number; height: number }; // Calculate dimensions based on ratio

  // Video Properties
  durationInFrames: number; // Total content frames (for rendering / Remotion Player)
  timelineDurationInFrames: number; // Padded timeline frames (min 1 min, +10 s buffer) — for timeline UI
  durationInSeconds: number; // Total content duration in seconds

  // Timeline
  deleteOverlaysByRow: (row: number) => void; // Delete overlays by row

  // Add these new history-related props
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // New style management prop
  updateOverlayStyles: (
    overlayId: number,
    styles: Partial<CaptionStyles>
  ) => void;

  // New resetOverlays prop
  resetOverlays: () => void;
  getDefaultOverlays: () => Overlay[];

  // Background Management
  background: BackgroundConfig;
  setBackground: (background: BackgroundConfig) => void;

  // History (the sidebar History panel)
  historyEntries?: HistoryEntry[];
  historyPointer?: number;
  jumpToHistory?: (entryId: string) => void;
  onCreateWorkflow?: () => void;

  // Project metadata
  projectId?: string;
  projectName?: string;
  setProjectName?: (name: string) => void;

}

// Create the context with undefined as default value
const EditorContext = createContext<EditorContextProps | undefined>(undefined);

// Provider component that wraps parts of the app that need access to the context
export const EditorProvider: React.FC<{
  value: EditorContextProps;
  children: ReactNode;
}> = ({ value, children }) => {
  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
};

// Custom hook that components can use to access the context
// Throws an error if used outside of EditorProvider
export const useEditorContext = (): EditorContextProps => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditorContext must be used within an EditorProvider");
  }
  return context;
};
