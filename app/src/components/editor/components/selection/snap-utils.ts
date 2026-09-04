export const SNAP_THRESHOLD = 6;

export type SnapLine = {
  axis: "x" | "y";
  position: number;
};

export type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type SnapResult = {
  x: number;
  y: number;
  guides: SnapLine[];
};

export const computeSnap = (
  dragging: Rect,
  others: Rect[],
  canvas: { w: number; h: number }
): SnapResult => {
  const guides: SnapLine[] = [];

  // Reference points for the dragging element
  const dragXPoints = [
    dragging.left,
    dragging.left + dragging.width / 2,
    dragging.left + dragging.width,
  ];
  const dragYPoints = [
    dragging.top,
    dragging.top + dragging.height / 2,
    dragging.top + dragging.height,
  ];

  // Snap targets on X axis
  const xTargets: number[] = [0, canvas.w / 2, canvas.w];
  // Snap targets on Y axis
  const yTargets: number[] = [0, canvas.h / 2, canvas.h];

  // Add other overlays' reference points
  for (const o of others) {
    xTargets.push(o.left, o.left + o.width / 2, o.left + o.width);
    yTargets.push(o.top, o.top + o.height / 2, o.top + o.height);
  }

  let bestDx: number | null = null;
  let bestDistX = SNAP_THRESHOLD + 1;
  let bestXGuide: number | null = null;

  for (const target of xTargets) {
    for (const point of dragXPoints) {
      const dist = Math.abs(point - target);
      if (dist < bestDistX) {
        bestDistX = dist;
        bestDx = target - point;
        bestXGuide = target;
      }
    }
  }

  let bestDy: number | null = null;
  let bestDistY = SNAP_THRESHOLD + 1;
  let bestYGuide: number | null = null;

  for (const target of yTargets) {
    for (const point of dragYPoints) {
      const dist = Math.abs(point - target);
      if (dist < bestDistY) {
        bestDistY = dist;
        bestDy = target - point;
        bestYGuide = target;
      }
    }
  }

  let snappedX = dragging.left;
  let snappedY = dragging.top;

  if (bestDx !== null && bestDistX <= SNAP_THRESHOLD) {
    snappedX = dragging.left + bestDx;
    guides.push({ axis: "x", position: bestXGuide! });
  }

  if (bestDy !== null && bestDistY <= SNAP_THRESHOLD) {
    snappedY = dragging.top + bestDy;
    guides.push({ axis: "y", position: bestYGuide! });
  }

  return { x: snappedX, y: snappedY, guides };
};

export const computeResizeSnap = (
  rect: Rect,
  others: Rect[],
  canvas: { w: number; h: number },
  edges: { left: boolean; top: boolean; right: boolean; bottom: boolean }
): { rect: Rect; guides: SnapLine[] } => {
  const guides: SnapLine[] = [];

  const xTargets: number[] = [0, canvas.w / 2, canvas.w];
  const yTargets: number[] = [0, canvas.h / 2, canvas.h];

  for (const o of others) {
    xTargets.push(o.left, o.left + o.width / 2, o.left + o.width);
    yTargets.push(o.top, o.top + o.height / 2, o.top + o.height);
  }

  let newRect = { ...rect };

  // Snap moving edges
  if (edges.left) {
    for (const target of xTargets) {
      if (Math.abs(rect.left - target) <= SNAP_THRESHOLD) {
        const diff = target - rect.left;
        newRect.left = target;
        newRect.width = rect.width - diff;
        guides.push({ axis: "x", position: target });
        break;
      }
    }
  }
  if (edges.right) {
    const rightEdge = rect.left + rect.width;
    for (const target of xTargets) {
      if (Math.abs(rightEdge - target) <= SNAP_THRESHOLD) {
        newRect.width = target - newRect.left;
        guides.push({ axis: "x", position: target });
        break;
      }
    }
  }
  if (edges.top) {
    for (const target of yTargets) {
      if (Math.abs(rect.top - target) <= SNAP_THRESHOLD) {
        const diff = target - rect.top;
        newRect.top = target;
        newRect.height = rect.height - diff;
        guides.push({ axis: "y", position: target });
        break;
      }
    }
  }
  if (edges.bottom) {
    const bottomEdge = rect.top + rect.height;
    for (const target of yTargets) {
      if (Math.abs(bottomEdge - target) <= SNAP_THRESHOLD) {
        newRect.height = target - newRect.top;
        guides.push({ axis: "y", position: target });
        break;
      }
    }
  }

  return { rect: newRect, guides };
};

export const ROTATION_SNAP_THRESHOLD = 4; // degrees
const ROTATION_SNAP_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315, 360];

export const snapRotation = (angle: number): { angle: number; snapped: boolean } => {
  // Normalize to 0-360
  let normalized = ((angle % 360) + 360) % 360;

  for (const target of ROTATION_SNAP_ANGLES) {
    if (Math.abs(normalized - target) <= ROTATION_SNAP_THRESHOLD) {
      // Map 360 back to 0
      const snappedNormalized = target === 360 ? 0 : target;
      // Preserve full rotations
      const fullRotations = Math.round(angle / 360) * 360;
      return { angle: fullRotations + snappedNormalized, snapped: true };
    }
  }

  return { angle, snapped: false };
};
