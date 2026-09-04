import { useState, useEffect, useRef, useCallback } from "react";
import { PlayerRef } from "@remotion/player";
import { FPS } from "../constants";

/**
 * Custom hook for managing video player functionality
 * @returns An object containing video player controls and state
 */
export const useVideoPlayer = () => {
  // State management
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const playerRef = useRef<PlayerRef>(null);

  // Frame update effect
  useEffect(() => {
    const FPS = 30;
    const updateCurrentFrame = () => {
      if (playerRef.current) {
        setCurrentFrame(playerRef.current.getCurrentFrame());
      }
    };

    const intervalId = setInterval(updateCurrentFrame, 1000 / FPS);
    return () => clearInterval(intervalId);
  }, []);

  /**
   * Starts playing the video
   */
  const play = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.play();
    }
  }, []);

  /**
   * Toggles between play and pause states
   */
  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => {
      const newIsPlaying = !prev;
      if (newIsPlaying) {
        playerRef.current?.play();
      } else {
        playerRef.current?.pause();
      }
      return newIsPlaying;
    });
  }, []);

  /**
   * Converts frame count to formatted time string
   * @param frames - Number of frames to convert
   * @returns Formatted time string in MM:SS format
   */
  const formatTime = useCallback((frames: number) => {
    const totalSeconds = frames / FPS;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const frames2Digits = Math.floor(frames % FPS)
      .toString()
      .padStart(2, "0");

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${frames2Digits}`;
  }, []);

  /**
   * Seeks to a specific frame in the video
   * @param frame - Target frame number
   */
  const seekTo = useCallback((frame: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(frame);
      setCurrentFrame(frame);
    }
  }, []);

  return {
    isPlaying,
    currentFrame,
    playerRef,
    togglePlayPause,
    formatTime,
    play,
    seekTo,
  };
};
