import { useCallback, useState, useSyncExternalStore } from "react";
import { AspectRatio } from "../types";

/**
 * The canvas shape is read by panels, the timeline and the preview, all of
 * which call this hook independently. It is therefore held in one module
 * store instead of per-hook state, so every caller sees the same value.
 */
let currentRatio: AspectRatio = "16:9";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setSharedAspectRatio(ratio: AspectRatio): void {
  if (currentRatio === ratio) return;
  currentRatio = ratio;
  listeners.forEach((listener) => listener());
}

export function getSharedAspectRatio(): AspectRatio {
  return currentRatio;
}

/**
 * Custom hook for managing aspect ratio and player dimensions.
 * @param initialRatio - Ignored once the project has set a ratio.
 * @param onRatioChange - Callback function to call when the aspect ratio changes (optional)
 * @returns An object containing aspect ratio state and related functions
 */

export const useAspectRatio = (
  _initialRatio: AspectRatio = "16:9",
  onRatioChange?: (ratio: AspectRatio) => void
) => {
  const aspectRatio = useSyncExternalStore(subscribe, getSharedAspectRatio, getSharedAspectRatio);

  const handleAspectRatioChange = useCallback(
    (newRatio: AspectRatio) => {
      setSharedAspectRatio(newRatio);
      onRatioChange?.(newRatio);
    },
    [onRatioChange]
  );

  const [playerDimensions, setPlayerDimensions] = useState({
    width: 640,
    height: 360,
  }); // Default 16:9 dimensions

  /**
   * Updates the player dimensions based on the container size and current aspect ratio.
   * @param containerWidth - The width of the container
   * @param containerHeight - The height of the container
   */
  const updatePlayerDimensions = useCallback(
    (containerWidth: number, containerHeight: number) => {
      let width, height;

      // Calculate target aspect ratio
      const targetRatio =
        aspectRatio === "16:9"
          ? 16 / 9
          : aspectRatio === "9:16"
          ? 9 / 16
          : aspectRatio === "1:1"
          ? 1
          : 4 / 5;

      // Compare container ratio with target ratio to determine fitting strategy
      const containerRatio = containerWidth / containerHeight;

      if (containerRatio > targetRatio) {
        // Container is wider than target ratio - fit to height
        height = containerHeight;
        width = height * targetRatio;
      } else {
        // Container is taller than target ratio - fit to width
        width = containerWidth;
        height = width / targetRatio;
      }

      setPlayerDimensions({ width, height });
    },
    [aspectRatio]
  );

  /**
   * Returns the standard dimensions for the current aspect ratio.
   * @returns An object containing the width and height for the current aspect ratio
   */
  const getAspectRatioDimensions = useCallback(() => {
    switch (aspectRatio) {
      case "9:16":
        return { width: 1080, height: 1920 }; // TikTok/Story
      case "4:5":
        return { width: 1080, height: 1350 }; // Instagram Post
      case "1:1":
        return { width: 1080, height: 1080 }; // Square Post
      case "16:9":
        return { width: 1920, height: 1080 }; // Full HD
      default:
        return { width: 1920, height: 1080 }; // Laptop (16:9)
    }
  }, [aspectRatio]);

  return {
    aspectRatio,
    setAspectRatio: handleAspectRatioChange,
    playerDimensions,
    updatePlayerDimensions,
    getAspectRatioDimensions,
  };
};
