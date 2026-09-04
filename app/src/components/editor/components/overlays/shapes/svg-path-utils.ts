// ── Anchor Point Types ──

export interface Point {
  x: number;
  y: number;
}

export interface AnchorPoint {
  x: number;
  y: number;
  handleIn?: Point;   // cubic bezier control point coming into this anchor
  handleOut?: Point;  // cubic bezier control point going out of this anchor
}

export interface ParsedPath {
  anchors: AnchorPoint[];
  closed: boolean;
}

// ── Shape-to-Path Conversion ──

/**
 * Convert a preset shape key into an SVG path "d" string.
 * Returns { d, viewBox } or null if shape not found.
 */
export function shapeToPathData(shapeKey: string): { d: string; viewBox: string } | null {
  const mapping: Record<string, { d: string; viewBox: string }> = {
    // Basic
    "rectangle": {
      d: "M 0,0 L 100,0 L 100,100 L 0,100 Z",
      viewBox: "0 0 100 100",
    },
    "rounded-rect": {
      d: "M 15,0 L 85,0 Q 100,0 100,15 L 100,85 Q 100,100 85,100 L 15,100 Q 0,100 0,85 L 0,15 Q 0,0 15,0 Z",
      viewBox: "0 0 100 100",
    },
    "circle": {
      d: "M 50,0 C 77.6,0 100,22.4 100,50 C 100,77.6 77.6,100 50,100 C 22.4,100 0,77.6 0,50 C 0,22.4 22.4,0 50,0 Z",
      viewBox: "0 0 100 100",
    },
    "ellipse": {
      d: "M 50,15 C 76.5,15 98,29.3 98,50 C 98,70.7 76.5,85 50,85 C 23.5,85 2,70.7 2,50 C 2,29.3 23.5,15 50,15 Z",
      viewBox: "0 0 100 100",
    },
    "triangle": {
      d: "M 50,5 L 95,95 L 5,95 Z",
      viewBox: "0 0 100 100",
    },
    "diamond": {
      d: "M 50,2 L 98,50 L 50,98 L 2,50 Z",
      viewBox: "0 0 100 100",
    },
    "pentagon": {
      d: "M 50,3 L 97,36 L 79,97 L 21,97 L 3,36 Z",
      viewBox: "0 0 100 100",
    },
    "hexagon": {
      d: "M 50,3 L 93,25 L 93,75 L 50,97 L 7,75 L 7,25 Z",
      viewBox: "0 0 100 100",
    },
    // Arrows (must match polygon points in shape-definitions.ts)
    "arrow-right": {
      d: "M 0,25 L 60,25 L 60,0 L 100,50 L 60,100 L 60,75 L 0,75 Z",
      viewBox: "0 0 100 100",
    },
    "arrow-left": {
      d: "M 100,25 L 40,25 L 40,0 L 0,50 L 40,100 L 40,75 L 100,75 Z",
      viewBox: "0 0 100 100",
    },
    "arrow-up": {
      d: "M 25,100 L 25,40 L 0,40 L 50,0 L 100,40 L 75,40 L 75,100 Z",
      viewBox: "0 0 100 100",
    },
    "arrow-down": {
      d: "M 25,0 L 25,60 L 0,60 L 50,100 L 100,60 L 75,60 L 75,0 Z",
      viewBox: "0 0 100 100",
    },
    "double-arrow": {
      d: "M 0,50 L 20,0 L 20,35 L 80,35 L 80,0 L 100,50 L 80,100 L 80,65 L 20,65 L 20,100 Z",
      viewBox: "0 0 100 100",
    },
    // Lines (viewBox must match shape-definitions.ts)
    "line-horizontal": {
      d: "M 2,10 L 98,10",
      viewBox: "0 0 100 20",
    },
    "line-vertical": {
      d: "M 10,2 L 10,98",
      viewBox: "0 0 20 100",
    },
    "line-diagonal": {
      d: "M 5,95 L 95,5",
      viewBox: "0 0 100 100",
    },
    // Stars
    "star-4": {
      d: "M 50,0 L 62,38 L 100,50 L 62,62 L 50,100 L 38,62 L 0,50 L 38,38 Z",
      viewBox: "0 0 100 100",
    },
    "star-5": {
      d: "M 50,3 L 61,38 L 98,38 L 68,60 L 79,95 L 50,73 L 21,95 L 32,60 L 2,38 L 39,38 Z",
      viewBox: "0 0 100 100",
    },
    "star-6": {
      d: "M 50,0 L 62,30 L 95,15 L 80,50 L 95,85 L 62,70 L 50,100 L 38,70 L 5,85 L 20,50 L 5,15 L 38,30 Z",
      viewBox: "0 0 100 100",
    },
    // Callouts
    "speech-bubble": {
      d: "M10,10 h80 a5,5 0 0 1 5,5 v45 a5,5 0 0 1 -5,5 h-50 l-15,25 5,-25 h-20 a5,5 0 0 1 -5,-5 v-45 a5,5 0 0 1 5,-5 z",
      viewBox: "0 0 100 100",
    },
    "thought-bubble": {
      // Main ellipse (cx=50, cy=40, rx=40, ry=30) + two small thought-dots as circles
      d: "M 50,10 C 72.1,10 90,23.4 90,40 C 90,56.6 72.1,70 50,70 C 27.9,70 10,56.6 10,40 C 10,23.4 27.9,10 50,10 Z M 25,71 C 28.9,71 32,74.1 32,78 C 32,81.9 28.9,85 25,85 C 21.1,85 18,81.9 18,78 C 18,74.1 21.1,71 25,71 Z M 18,88 C 20.2,88 22,89.8 22,92 C 22,94.2 20.2,96 18,96 C 15.8,96 14,94.2 14,92 C 14,89.8 15.8,88 18,88 Z",
      viewBox: "0 0 100 100",
    },
    // Other
    "heart": {
      d: "M50,88 C25,65 2,50 2,30 A22,22 0,0,1,50,20 A22,22 0,0,1,98,30 C98,50 75,65 50,88Z",
      viewBox: "0 0 100 100",
    },
    "cross": {
      d: "M 35,0 L 65,0 L 65,35 L 100,35 L 100,65 L 65,65 L 65,100 L 35,100 L 35,65 L 0,65 L 0,35 L 35,35 Z",
      viewBox: "0 0 100 100",
    },
    "chevron-right": {
      d: "M 25,5 L 75,50 L 25,95 L 40,50 Z",
      viewBox: "0 0 100 100",
    },
    "chevron-left": {
      d: "M 75,5 L 25,50 L 75,95 L 60,50 Z",
      viewBox: "0 0 100 100",
    },
    "ring": {
      d: "M50,2 A48,48 0 1,1 49.99,2 Z M50,20 A30,30 0 1,0 50.01,20 Z",
      viewBox: "0 0 100 100",
    },
  };

  return mapping[shapeKey] || null;
}

// ── SVG Path Parsing ──

interface PathCommand {
  type: string;
  values: number[];
}

function tokenizePath(d: string): PathCommand[] {
  const commands: PathCommand[] = [];
  // Match command letter followed by optional whitespace and numbers
  const regex = /([MmLlHhVvCcSsQqTtAaZz])\s*([-\d.,eE\s]*)/g;
  let match;

  while ((match = regex.exec(d)) !== null) {
    const type = match[1];
    const valueStr = match[2].trim();
    const values = valueStr
      ? valueStr.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n))
      : [];
    commands.push({ type, values });
  }

  return commands;
}

// ── Arc to Cubic Bezier Conversion ──

interface CubicCurve {
  cp1x: number; cp1y: number;
  cp2x: number; cp2y: number;
  x: number; y: number;
}

/**
 * Convert an SVG arc segment to one or more cubic bezier curves.
 * Uses the standard endpoint-to-center parameterization algorithm.
 */
function arcToCubicBeziers(
  x1: number, y1: number,
  rxIn: number, ryIn: number,
  xRotDeg: number,
  largeArcFlag: number,
  sweepFlag: number,
  x2: number, y2: number,
): CubicCurve[] {
  // Handle degenerate cases
  if (x1 === x2 && y1 === y2) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) {
    // Treat as straight line
    return [{ cp1x: x1, cp1y: y1, cp2x: x2, cp2y: y2, x: x2, y: y2 }];
  }

  const phi = (xRotDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: Compute (x1', y1') — transformed midpoint
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Step 2: Correct radii if too small
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  let rxSq = rx * rx;
  let rySq = ry * ry;
  const radiiCheck = x1pSq / rxSq + y1pSq / rySq;
  if (radiiCheck > 1) {
    const s = Math.sqrt(radiiCheck);
    rx *= s;
    ry *= s;
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  // Step 3: Compute center point (cx', cy')
  let sq = Math.max(0,
    (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) /
    (rxSq * y1pSq + rySq * x1pSq)
  );
  sq = Math.sqrt(sq);
  if (largeArcFlag === sweepFlag) sq = -sq;

  const cxp = sq * (rx * y1p / ry);
  const cyp = sq * -(ry * x1p / rx);

  // Step 4: Compute center (cx, cy) in original coords
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const cxo = cosPhi * cxp - sinPhi * cyp + mx;
  const cyo = sinPhi * cxp + cosPhi * cyp + my;

  // Step 5: Compute start and sweep angles
  const vAngle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    let ang = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) ang = -ang;
    return ang;
  };

  const theta1 = vAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = vAngle(
    (x1p - cxp) / rx, (y1p - cyp) / ry,
    (-x1p - cxp) / rx, (-y1p - cyp) / ry,
  );

  if (sweepFlag === 0 && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweepFlag === 1 && dTheta < 0) dTheta += 2 * Math.PI;

  // Step 6: Split into segments of at most 90 degrees
  const segments = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const segAngle = dTheta / segments;

  const curves: CubicCurve[] = [];
  const alpha = (4 / 3) * Math.tan(segAngle / 4);

  let curAngle = theta1;

  for (let s = 0; s < segments; s++) {
    const nextAngle = curAngle + segAngle;
    const cosA = Math.cos(curAngle);
    const sinA = Math.sin(curAngle);
    const cosB = Math.cos(nextAngle);
    const sinB = Math.sin(nextAngle);

    // Control points on unit circle
    const ep1x = cosA - alpha * sinA;
    const ep1y = sinA + alpha * cosA;
    const ep2x = cosB + alpha * sinB;
    const ep2y = sinB - alpha * cosB;

    // Scale and rotate back to original coordinate space
    const transform = (px: number, py: number) => {
      const x = rx * px;
      const y = ry * py;
      return {
        x: cosPhi * x - sinPhi * y + cxo,
        y: sinPhi * x + cosPhi * y + cyo,
      };
    };

    const cp1 = transform(ep1x, ep1y);
    const cp2 = transform(ep2x, ep2y);
    const end = transform(cosB, sinB);

    // Use exact endpoint for last segment to avoid rounding drift
    const endX = s === segments - 1 ? x2 : end.x;
    const endY = s === segments - 1 ? y2 : end.y;

    curves.push({
      cp1x: cp1.x, cp1y: cp1.y,
      cp2x: cp2.x, cp2y: cp2.y,
      x: endX, y: endY,
    });

    curAngle = nextAngle;
  }

  return curves;
}

/**
 * Parse an SVG path "d" string into structured anchor points.
 * Supports M, L, H, V, C, S, Q, T, A, Z commands (absolute only for now).
 */
export function parsePath(d: string): ParsedPath {
  const commands = tokenizePath(d);
  const anchors: AnchorPoint[] = [];
  let closed = false;
  let cx = 0, cy = 0; // current position
  let lastControlX = 0, lastControlY = 0; // for S/T smooth curves

  for (const cmd of commands) {
    const { type, values } = cmd;
    const isRelative = type === type.toLowerCase();
    const T = type.toUpperCase();

    if (T === "Z") {
      closed = true;
      continue;
    }

    if (T === "M") {
      // MoveTo - can have multiple coordinate pairs (implicit LineTo)
      for (let i = 0; i < values.length; i += 2) {
        const x = isRelative ? cx + values[i] : values[i];
        const y = isRelative ? cy + values[i + 1] : values[i + 1];
        anchors.push({ x, y });
        cx = x;
        cy = y;
      }
    } else if (T === "L") {
      for (let i = 0; i < values.length; i += 2) {
        const x = isRelative ? cx + values[i] : values[i];
        const y = isRelative ? cy + values[i + 1] : values[i + 1];
        anchors.push({ x, y });
        cx = x;
        cy = y;
      }
    } else if (T === "H") {
      for (let i = 0; i < values.length; i++) {
        const x = isRelative ? cx + values[i] : values[i];
        anchors.push({ x, y: cy });
        cx = x;
      }
    } else if (T === "V") {
      for (let i = 0; i < values.length; i++) {
        const y = isRelative ? cy + values[i] : values[i];
        anchors.push({ x: cx, y });
        cy = y;
      }
    } else if (T === "C") {
      // Cubic bezier: C cx1,cy1 cx2,cy2 x,y
      for (let i = 0; i < values.length; i += 6) {
        const cx1 = isRelative ? cx + values[i] : values[i];
        const cy1 = isRelative ? cy + values[i + 1] : values[i + 1];
        const cx2 = isRelative ? cx + values[i + 2] : values[i + 2];
        const cy2 = isRelative ? cy + values[i + 3] : values[i + 3];
        const x = isRelative ? cx + values[i + 4] : values[i + 4];
        const y = isRelative ? cy + values[i + 5] : values[i + 5];

        // Assign handleOut to previous anchor
        if (anchors.length > 0) {
          anchors[anchors.length - 1].handleOut = { x: cx1, y: cy1 };
        }

        anchors.push({ x, y, handleIn: { x: cx2, y: cy2 } });
        cx = x;
        cy = y;
        lastControlX = cx2;
        lastControlY = cy2;
      }
    } else if (T === "S") {
      // Smooth cubic: S cx2,cy2 x,y
      for (let i = 0; i < values.length; i += 4) {
        // Reflected control point
        const cx1 = 2 * cx - lastControlX;
        const cy1 = 2 * cy - lastControlY;
        const cx2 = isRelative ? cx + values[i] : values[i];
        const cy2 = isRelative ? cy + values[i + 1] : values[i + 1];
        const x = isRelative ? cx + values[i + 2] : values[i + 2];
        const y = isRelative ? cy + values[i + 3] : values[i + 3];

        if (anchors.length > 0) {
          anchors[anchors.length - 1].handleOut = { x: cx1, y: cy1 };
        }

        anchors.push({ x, y, handleIn: { x: cx2, y: cy2 } });
        cx = x;
        cy = y;
        lastControlX = cx2;
        lastControlY = cy2;
      }
    } else if (T === "Q") {
      // Quadratic bezier: Q cx1,cy1 x,y → approximate as cubic
      for (let i = 0; i < values.length; i += 4) {
        const qx = isRelative ? cx + values[i] : values[i];
        const qy = isRelative ? cy + values[i + 1] : values[i + 1];
        const x = isRelative ? cx + values[i + 2] : values[i + 2];
        const y = isRelative ? cy + values[i + 3] : values[i + 3];

        // Convert Q to C: CP1 = P0 + 2/3*(Q-P0), CP2 = P1 + 2/3*(Q-P1)
        const cp1x = cx + (2 / 3) * (qx - cx);
        const cp1y = cy + (2 / 3) * (qy - cy);
        const cp2x = x + (2 / 3) * (qx - x);
        const cp2y = y + (2 / 3) * (qy - y);

        if (anchors.length > 0) {
          anchors[anchors.length - 1].handleOut = { x: cp1x, y: cp1y };
        }
        anchors.push({ x, y, handleIn: { x: cp2x, y: cp2y } });
        cx = x;
        cy = y;
        lastControlX = qx;
        lastControlY = qy;
      }
    } else if (T === "A") {
      // Arc: A rx,ry xRotation largeArcFlag sweepFlag x,y
      // Convert each arc segment to cubic bezier curves for proper editing
      for (let i = 0; i < values.length; i += 7) {
        const rx = values[i];
        const ry = values[i + 1];
        const xRot = values[i + 2];
        const largeArc = values[i + 3];
        const sweep = values[i + 4];
        const x = isRelative ? cx + values[i + 5] : values[i + 5];
        const y = isRelative ? cy + values[i + 6] : values[i + 6];

        const curves = arcToCubicBeziers(cx, cy, rx, ry, xRot, largeArc, sweep, x, y);

        if (curves.length === 0) {
          // Degenerate arc — treat as line
          anchors.push({ x, y });
        } else {
          for (const curve of curves) {
            if (anchors.length > 0) {
              anchors[anchors.length - 1].handleOut = { x: curve.cp1x, y: curve.cp1y };
            }
            anchors.push({
              x: curve.x,
              y: curve.y,
              handleIn: { x: curve.cp2x, y: curve.cp2y },
            });
          }
        }

        cx = x;
        cy = y;
        lastControlX = cx;
        lastControlY = cy;
      }
    }
  }

  return { anchors, closed };
}

// ── Anchor Points to Path ──

/**
 * Convert structured anchor points back to an SVG path "d" string.
 */
export function anchorPointsToPath(anchors: AnchorPoint[], closed: boolean): string {
  if (anchors.length === 0) return "";

  const parts: string[] = [];
  const first = anchors[0];
  parts.push(`M ${r(first.x)},${r(first.y)}`);

  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1];
    const curr = anchors[i];
    const hasHandleOut = prev.handleOut;
    const hasHandleIn = curr.handleIn;

    if (hasHandleOut || hasHandleIn) {
      // Cubic bezier
      const hOut = hasHandleOut || { x: prev.x, y: prev.y };
      const hIn = hasHandleIn || { x: curr.x, y: curr.y };
      parts.push(`C ${r(hOut.x)},${r(hOut.y)} ${r(hIn.x)},${r(hIn.y)} ${r(curr.x)},${r(curr.y)}`);
    } else {
      // Straight line
      parts.push(`L ${r(curr.x)},${r(curr.y)}`);
    }
  }

  // Handle closing segment
  if (closed && anchors.length > 1) {
    const last = anchors[anchors.length - 1];
    const hasHandleOut = last.handleOut;
    const hasHandleIn = first.handleIn;

    if (hasHandleOut || hasHandleIn) {
      const hOut = hasHandleOut || { x: last.x, y: last.y };
      const hIn = hasHandleIn || { x: first.x, y: first.y };
      parts.push(`C ${r(hOut.x)},${r(hOut.y)} ${r(hIn.x)},${r(hIn.y)} ${r(first.x)},${r(first.y)}`);
    }
    parts.push("Z");
  }

  return parts.join(" ");
}

function r(n: number): string {
  return Math.round(n * 100) / 100 + "";
}

// ── Point Manipulation ──

/**
 * Add a new anchor point on a segment between anchors[index] and anchors[index+1]
 * at parametric position t (0..1).
 */
export function addPointOnSegment(
  anchors: AnchorPoint[],
  index: number,
  t: number = 0.5
): AnchorPoint[] {
  const result = [...anchors];
  const a = anchors[index];
  const nextIdx = (index + 1) % anchors.length;
  const b = anchors[nextIdx];

  const hOut = a.handleOut;
  const hIn = b.handleIn;

  if (hOut || hIn) {
    // De Casteljau subdivision of cubic bezier at t
    const p0 = { x: a.x, y: a.y };
    const p1 = hOut || p0;
    const p2 = hIn || { x: b.x, y: b.y };
    const p3 = { x: b.x, y: b.y };

    const q0 = lerp(p0, p1, t);
    const q1 = lerp(p1, p2, t);
    const q2 = lerp(p2, p3, t);
    const r0 = lerp(q0, q1, t);
    const r1 = lerp(q1, q2, t);
    const s = lerp(r0, r1, t);

    // Update existing anchors' handles
    result[index] = { ...a, handleOut: q0 };
    result[nextIdx] = { ...b, handleIn: r1 };

    // Insert new point
    const newPoint: AnchorPoint = {
      x: s.x,
      y: s.y,
      handleIn: r0,
      handleOut: r1,
    };
    // Wait - r0 is handleIn and r1 is handleOut? Let me recalculate.
    // Actually: the new point splits the curve into two cubics:
    // First half:  p0 -> q0 -> r0 -> s
    // Second half: s -> r1 -> q2 -> p3
    // So: result[index].handleOut = q0, newPoint.handleIn = r0, newPoint.handleOut = r1, result[nextIdx].handleIn = q2

    result[index] = { ...a, handleOut: q0 };
    const insertedPoint: AnchorPoint = {
      x: s.x,
      y: s.y,
      handleIn: r0,
      handleOut: r1,
    };
    result[nextIdx] = { ...b, handleIn: q2 };

    result.splice(index + 1, 0, insertedPoint);
  } else {
    // Straight line - just lerp
    const newPoint: AnchorPoint = {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
    result.splice(index + 1, 0, newPoint);
  }

  return result;
}

/**
 * Remove an anchor point at the given index.
 */
export function removePoint(anchors: AnchorPoint[], index: number): AnchorPoint[] {
  if (anchors.length <= 2) return anchors; // need at least 2 points
  const result = [...anchors];
  result.splice(index, 1);
  return result;
}

function lerp(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

// ── Bounding Box ──

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Compute the bounding box of a set of anchor points, including bezier control points.
 * For bezier segments, samples the curve to get an accurate bbox.
 */
export function computePathBBox(anchors: AnchorPoint[], closed: boolean): BBox {
  if (anchors.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const expand = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  // Include all anchor points
  for (const a of anchors) {
    expand(a.x, a.y);
  }

  // Sample bezier segments for accurate bounds
  const segCount = closed ? anchors.length : anchors.length - 1;
  for (let i = 0; i < segCount; i++) {
    const a = anchors[i];
    const b = anchors[(i + 1) % anchors.length];
    if (a.handleOut || b.handleIn) {
      const p0 = { x: a.x, y: a.y };
      const p1 = a.handleOut || p0;
      const p2 = b.handleIn || { x: b.x, y: b.y };
      const p3 = { x: b.x, y: b.y };
      for (let t = 0; t <= 1; t += 0.05) {
        const mt = 1 - t;
        expand(
          mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
          mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y
        );
      }
    }
  }

  return {
    minX, minY, maxX, maxY,
    width: maxX - minX || 1,
    height: maxY - minY || 1,
  };
}

/**
 * Normalize anchors so the path fits within a 0,0-based viewBox.
 * Returns the new anchors, viewBox string, and the scale/offset needed
 * to map back to overlay coordinates.
 */
export function normalizeAnchors(
  anchors: AnchorPoint[],
  closed: boolean,
  padding: number = 2
): {
  anchors: AnchorPoint[];
  viewBox: string;
  bbox: BBox;
} {
  const bbox = computePathBBox(anchors, closed);
  const offsetX = bbox.minX - padding;
  const offsetY = bbox.minY - padding;

  const shifted = anchors.map((a) => {
    const na: AnchorPoint = {
      x: a.x - offsetX,
      y: a.y - offsetY,
    };
    if (a.handleIn) {
      na.handleIn = { x: a.handleIn.x - offsetX, y: a.handleIn.y - offsetY };
    }
    if (a.handleOut) {
      na.handleOut = { x: a.handleOut.x - offsetX, y: a.handleOut.y - offsetY };
    }
    return na;
  });

  const vbW = bbox.width + padding * 2;
  const vbH = bbox.height + padding * 2;

  return {
    anchors: shifted,
    viewBox: `0 0 ${Math.round(vbW * 100) / 100} ${Math.round(vbH * 100) / 100}`,
    bbox,
  };
}

// ── Path Simplification (Ramer-Douglas-Peucker) ──

/**
 * Simplify a polyline by removing points that are within `tolerance` of the line
 * between their neighbors. Used for freehand drawing.
 */
export function simplifyPath(points: Point[], tolerance: number = 1.5): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPath(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

/**
 * Convert an array of points to a smooth SVG path using Catmull-Rom to cubic bezier conversion.
 */
export function pointsToSmoothPath(points: Point[], closed: boolean = false): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${r(points[0].x)},${r(points[0].y)}`;
  if (points.length === 2) {
    return `M ${r(points[0].x)},${r(points[0].y)} L ${r(points[1].x)},${r(points[1].y)}`;
  }

  const parts: string[] = [`M ${r(points[0].x)},${r(points[0].y)}`];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Catmull-Rom to cubic bezier
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    parts.push(`C ${r(cp1x)},${r(cp1y)} ${r(cp2x)},${r(cp2y)} ${r(p2.x)},${r(p2.y)}`);
  }

  if (closed) parts.push("Z");
  return parts.join(" ");
}

/**
 * Compute bounding box of a simple point array.
 */
export function pointsBBox(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, width: (maxX - minX) || 1, height: (maxY - minY) || 1 };
}

// ── Hit Testing ──

/**
 * Find the closest point on a segment to a test point.
 * Returns { segmentIndex, t, distance }.
 */
export function findClosestSegment(
  anchors: AnchorPoint[],
  closed: boolean,
  testPoint: Point
): { segmentIndex: number; t: number; distance: number; point: Point } | null {
  let best: { segmentIndex: number; t: number; distance: number; point: Point } | null = null;

  const segCount = closed ? anchors.length : anchors.length - 1;

  for (let i = 0; i < segCount; i++) {
    const a = anchors[i];
    const b = anchors[(i + 1) % anchors.length];
    const hOut = a.handleOut;
    const hIn = b.handleIn;

    if (hOut || hIn) {
      // Sample bezier curve
      const p0 = { x: a.x, y: a.y };
      const p1 = hOut || p0;
      const p2 = hIn || { x: b.x, y: b.y };
      const p3 = { x: b.x, y: b.y };

      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        const pt = cubicBezier(p0, p1, p2, p3, t);
        const dist = distance(pt, testPoint);
        if (!best || dist < best.distance) {
          best = { segmentIndex: i, t, distance: dist, point: pt };
        }
      }
    } else {
      // Straight line - closest point on segment
      const result = closestPointOnLine(a, b, testPoint);
      if (!best || result.distance < best.distance) {
        best = { segmentIndex: i, t: result.t, distance: result.distance, point: result.point };
      }
    }
  }

  return best;
}

function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function closestPointOnLine(a: Point, b: Point, p: Point): { t: number; distance: number; point: Point } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return { t: 0, distance: distance(a, p), point: a };

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { t, distance: distance(point, p), point };
}
