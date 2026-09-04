import { memo, useEffect, useRef, useCallback } from "react";
import { WaveformData } from "../../../types";

interface WaveformVisualizerProps {
  waveformData: WaveformData;
  /** Pass zoomScale so the canvas redraws when zoom changes. */
  zoomScale: number;
}

/**
 * Canvas-based dual-layer waveform (peak envelope + RMS fill).
 * Samples from 1500-point data, using 1 sample per canvas pixel so every
 * zoom level shows the right amount of detail.
 * ResizeObserver + zoomScale dep together guarantee correct redraws.
 */
const WaveformVisualizer = memo(({ waveformData, zoomScale }: WaveformVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef(waveformData);
  dataRef.current = waveformData;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (w === 0 || h === 0) return;

    const physW = Math.round(w * dpr);
    const physH = Math.round(h * dpr);
    if (canvas.width !== physW || canvas.height !== physH) {
      canvas.width = physW;
      canvas.height = physH;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const { peaks, rms } = dataRef.current;
    if (!peaks.length) return;

    // 1 sample point per CSS pixel for full detail at every zoom level.
    const numPoints = Math.min(peaks.length, Math.max(64, Math.round(w)));
    const step = peaks.length / numPoints;

    // Downsample: take max-peak and max-rms per bucket.
    const sPeaks = new Float32Array(numPoints);
    const sRms   = new Float32Array(numPoints);
    for (let i = 0; i < numPoints; i++) {
      const s = Math.floor(i * step);
      const e = Math.min(peaks.length - 1, Math.ceil((i + 1) * step) - 1);
      let mp = 0, mr = 0;
      for (let j = s; j <= e; j++) {
        if (peaks[j] > mp) mp = peaks[j];
        if (rms[j]   > mr) mr = rms[j];
      }
      sPeaks[i] = mp;
      sRms[i]   = mr;
    }

    const mid    = h / 2;
    const maxAmp = mid * 0.90;

    // ── Layer 1: peak envelope (outer, semi-transparent) ──────────────────
    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let i = 0; i < numPoints; i++) {
      ctx.lineTo((i / (numPoints - 1)) * w, mid - Math.pow(sPeaks[i], 0.55) * maxAmp);
    }
    for (let i = numPoints - 1; i >= 0; i--) {
      ctx.lineTo((i / (numPoints - 1)) * w, mid + Math.pow(sPeaks[i], 0.55) * maxAmp);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(253, 224, 71, 0.38)";
    ctx.fill();

    // ── Layer 2: RMS fill (inner, opaque) ─────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let i = 0; i < numPoints; i++) {
      ctx.lineTo((i / (numPoints - 1)) * w, mid - Math.pow(sRms[i], 0.55) * maxAmp);
    }
    for (let i = numPoints - 1; i >= 0; i--) {
      ctx.lineTo((i / (numPoints - 1)) * w, mid + Math.pow(sRms[i], 0.55) * maxAmp);
    }
    ctx.closePath();

    // Vertical gradient: bright centre, softer edges.
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0,    "rgba(253, 224, 71, 0.60)");
    grad.addColorStop(0.4,  "rgba(254, 240, 138, 0.95)");
    grad.addColorStop(0.5,  "rgba(255, 250, 200, 1.00)");
    grad.addColorStop(0.6,  "rgba(254, 240, 138, 0.95)");
    grad.addColorStop(1,    "rgba(253, 224, 71, 0.60)");
    ctx.fillStyle = grad;
    ctx.fill();

    // ── Centreline ────────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.strokeStyle = "rgba(253, 224, 71, 0.15)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }, []);

  // Re-draw when data changes.
  useEffect(() => {
    dataRef.current = waveformData;
    draw();
  }, [waveformData, draw]);

  // Re-draw when zoom changes (zoomScale prop change = container got wider/narrower).
  useEffect(() => {
    // Small rAF delay so the DOM has finished reflowing the new width.
    const id = requestAnimationFrame(() => draw());
    return () => cancelAnimationFrame(id);
  }, [zoomScale, draw]);

  // ResizeObserver catches any remaining size changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    draw();
    return () => ro.disconnect();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: "block" }}
    />
  );
});

WaveformVisualizer.displayName = "WaveformVisualizer";
export default WaveformVisualizer;
