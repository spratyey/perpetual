// Maximum number of rows to display in the editor
export const MAX_ROWS = 8;
// Minimum rows to always display in the timeline
export const MIN_DISPLAY_ROWS = 3;
// Frames per second for video rendering
export const FPS = 30;

// Video configuration
export const DURATION_IN_FRAMES = 500;
export const VIDEO_WIDTH = 1920; // 1080p Full HD video dimensions
export const VIDEO_HEIGHT = 1080;

// UI configuration
export const ROW_HEIGHT = 44; // Slightly increased from 48
export const SHOW_LOADING_PROJECT_ALERT = true; // Controls visibility of asset loading indicator

// Timeline padding — extra buffer so users can drag clips past the end
export const MIN_TIMELINE_DURATION_FRAMES = FPS * 60; // 1 minute minimum timeline
export const TIMELINE_END_PADDING_FRAMES = FPS * 10; // 10 seconds of blank space after last clip

// Snap-to-edges: clips within this many frames of a neighbour edge
// will magnetically snap end-to-end (≈ 0.17s at 30 FPS).
export const SNAP_THRESHOLD_FRAMES = 8;

// Zoom control configuration
export const ZOOM_CONSTRAINTS = {
  min: 1, // Minimum zoom level
  max: 10, // Maximum zoom level
  step: 0.1, // Smallest increment for manual zoom controls
  default: 1, // Default zoom level
  zoomStep: 0.15, // Zoom increment for zoom in/out buttons
  wheelStep: 0.3, // Zoom increment for mouse wheel (used by timeline shortcuts)
};

