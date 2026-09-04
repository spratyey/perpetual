import { useCallback, useEffect } from "react";
import { useEditorContext } from "../contexts/editor-context";
import { FPS } from "../constants";

/**
 * Returns true if the event target is an input, textarea, or contenteditable element.
 */
function isTypingTarget(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if ((e.target as HTMLElement)?.isContentEditable) return true;
  return false;
}

/**
 * Global keyboard shortcuts for the editor.
 *
 * These are registered on `window` so they work regardless of focus.
 *
 * - Space          → play / pause
 * - S              → split selected overlay at playhead
 * - D              → duplicate selected overlay
 * - Delete / Backspace → delete selected overlay
 * - ArrowLeft      → previous frame
 * - ArrowRight     → next frame
 */
export function useGlobalHotkeys() {
  const {
    togglePlayPause,
    selectedOverlayId,
    splitOverlay,
    deleteOverlay,
    duplicateOverlay,
    currentFrame,
    seekTo,
    durationInFrames,
    isPlaying,
  } = useEditorContext();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Never interfere with modifier combos (Ctrl/Cmd+key) — let other
      // shortcuts (undo, redo, save, etc.) pass through.
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

      switch (e.key) {
        // ── Play / Pause ──────────────────────────────────────────────
        case " ": {
          // Allow space in text fields
          if (isTypingTarget(e)) return;
          e.preventDefault();
          togglePlayPause();
          break;
        }

        // ── Split ─────────────────────────────────────────────────────
        case "s":
        case "S": {
          if (hasModifier || isTypingTarget(e)) return;
          if (selectedOverlayId != null) {
            e.preventDefault();
            splitOverlay(selectedOverlayId, currentFrame);
          }
          break;
        }

        // ── Duplicate ─────────────────────────────────────────────────
        case "d":
        case "D": {
          if (hasModifier || isTypingTarget(e)) return;
          if (selectedOverlayId != null) {
            e.preventDefault();
            duplicateOverlay(selectedOverlayId);
          }
          break;
        }

        // ── Delete ────────────────────────────────────────────────────
        case "Delete":
        case "Backspace": {
          if (isTypingTarget(e)) return;
          if (selectedOverlayId != null) {
            e.preventDefault();
            deleteOverlay(selectedOverlayId);
          }
          break;
        }

        // ── Frame step backward ───────────────────────────────────────
        case "ArrowLeft": {
          if (hasModifier) return;
          e.preventDefault();
          seekTo(Math.max(0, currentFrame - 1));
          break;
        }

        // ── Frame step forward ────────────────────────────────────────
        case "ArrowRight": {
          if (hasModifier) return;
          e.preventDefault();
          seekTo(Math.min(durationInFrames - 1, currentFrame + 1));
          break;
        }

        default:
          break;
      }
    },
    [
      togglePlayPause,
      selectedOverlayId,
      splitOverlay,
      deleteOverlay,
      duplicateOverlay,
      currentFrame,
      seekTo,
      durationInFrames,
      isPlaying,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
