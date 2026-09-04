import { useState, useEffect } from "react";
import { WaveformData } from "../types";

interface WaveformOptions {
  numPoints?: number;
  fps?: number;
}

/**
 * Processes an audio file and returns peak + RMS amplitude data for waveform rendering.
 *
 * Generates 1500 sample points by default (up from 400) so that zoomed-in views
 * retain detail. The visualizer downsamples on the fly based on actual canvas width.
 *
 * Normalization uses the 80th percentile (not 95th) so that loud-but-uniform
 * audio (e.g. TTS speech) still shows visible amplitude variation rather than
 * collapsing into a solid bar.
 */
export function useWaveformProcessor(
  src: string | undefined,
  startFromSound: number = 0,
  durationInFrames: number,
  options: WaveformOptions = {}
) {
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const { numPoints = 1500, fps = 30 } = options;

  useEffect(() => {
    if (!src) return;

    let isActive = true;

    const processAudio = async () => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (!isActive) return;

        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);
        const startTime = startFromSound / fps;
        const duration = durationInFrames / fps;

        const startSample = Math.floor(startTime * sampleRate);
        const samplesForDuration = Math.floor(duration * sampleRate);
        const samplesPerPeak = Math.max(1, Math.floor(samplesForDuration / numPoints));

        const rawPeaks: number[] = new Array(numPoints);
        const rawRms: number[] = new Array(numPoints);

        for (let i = 0; i < numPoints; i++) {
          const start = startSample + i * samplesPerPeak;
          const end = Math.min(start + samplesPerPeak, channelData.length);

          let peakMax = 0;
          let sumSquares = 0;
          let validSamples = 0;

          for (let j = start; j < end; j++) {
            if (j >= channelData.length) break;
            const v = Math.abs(channelData[j]);
            if (v > peakMax) peakMax = v;
            sumSquares += v * v;
            validSamples++;
          }

          rawPeaks[i] = peakMax;
          rawRms[i] = validSamples > 0 ? Math.sqrt(sumSquares / validSamples) : 0;
        }

        // Normalize using 80th percentile so uniform audio (TTS) still shows shape.
        const sortedPeaks = [...rawPeaks].sort((a, b) => a - b);
        const norm = sortedPeaks[Math.floor(numPoints * 0.80)] || sortedPeaks[numPoints - 1] || 1;

        setWaveformData({
          peaks: rawPeaks.map((p) => Math.min(p / norm, 1)),
          rms:   rawRms.map((r)  => Math.min(r / norm, 1)),
          length: samplesForDuration,
        });
      } catch (error) {
        console.error("Error processing audio waveform:", error);
      }
    };

    processAudio();
    return () => { isActive = false; };
  }, [src, startFromSound, durationInFrames, fps, numPoints]);

  return waveformData;
}
