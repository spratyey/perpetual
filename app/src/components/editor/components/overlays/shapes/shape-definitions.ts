import React from "react";

export interface ShapeDefinition {
  key: string;
  label: string;
  category: "basic" | "arrows" | "lines" | "stars" | "callouts" | "other" | "drawn";
  viewBox: string;
  path: (fill: string, stroke: string, strokeWidth: number) => React.ReactNode;
  defaultW: number;
  defaultH: number;
  isLine?: boolean; // true for stroke-only shapes (lines, freehand, pen paths)
  /**
   * Smart resize: returns parametric SVG path data that adapts to the overlay's
   * pixel dimensions so that fixed regions (e.g. arrowheads, bubble tails) stay
   * the same size while extensible parts (stems, body) stretch.
   *   w  – overlay pixel width
   *   h  – overlay pixel height
   * Returns { d, viewBox, preserveAspectRatio? } or null to fall back to default stretch.
   */
  resizePath?: (w: number, h: number) => { d: string; viewBox: string } | null;
}

const h = React.createElement;

export const shapeDefinitions: ShapeDefinition[] = [
  // ── Basic ──
  {
    key: "rectangle",
    label: "Rectangle",
    category: "basic",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("rect", { x: sw / 2, y: sw / 2, width: 100 - sw, height: 100 - sw, fill, stroke, strokeWidth: sw }),
    defaultW: 200,
    defaultH: 150,
  },
  {
    key: "rounded-rect",
    label: "Rounded Rect",
    category: "basic",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("rect", { x: sw / 2, y: sw / 2, width: 100 - sw, height: 100 - sw, rx: 15, ry: 15, fill, stroke, strokeWidth: sw }),
    defaultW: 200,
    defaultH: 150,
  },
  {
    key: "circle",
    label: "Circle",
    category: "basic",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("circle", { cx: 50, cy: 50, r: 50 - sw / 2, fill, stroke, strokeWidth: sw }),
    defaultW: 200,
    defaultH: 200,
  },
  {
    key: "ellipse",
    label: "Ellipse",
    category: "basic",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("ellipse", { cx: 50, cy: 50, rx: 48 - sw / 2, ry: 35 - sw / 2, fill, stroke, strokeWidth: sw }),
    defaultW: 250,
    defaultH: 180,
  },
  {
    key: "triangle",
    label: "Triangle",
    category: "basic",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "50,5 95,95 5,95", fill, stroke, strokeWidth: sw }),
    defaultW: 200,
    defaultH: 200,
  },
  {
    key: "diamond",
    label: "Diamond",
    category: "basic",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "50,2 98,50 50,98 2,50", fill, stroke, strokeWidth: sw }),
    defaultW: 200,
    defaultH: 200,
  },
  {
    key: "pentagon",
    label: "Pentagon",
    category: "basic",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "50,3 97,36 79,97 21,97 3,36", fill, stroke, strokeWidth: sw }),
    defaultW: 200,
    defaultH: 200,
  },
  {
    key: "hexagon",
    label: "Hexagon",
    category: "basic",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "50,3 93,25 93,75 50,97 7,75 7,25", fill, stroke, strokeWidth: sw }),
    defaultW: 200,
    defaultH: 200,
  },

  // ── Arrows ──
  {
    key: "arrow-right",
    label: "Arrow Right",
    category: "arrows",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "0,25 60,25 60,0 100,50 60,100 60,75 0,75", fill, stroke, strokeWidth: sw }),
    defaultW: 200,
    defaultH: 150,
    resizePath: (w, h) => {
      // Arrowhead stays fixed size (50px wide), stem stretches
      const headW = Math.min(50, w * 0.4); // cap at 40% of total
      const vw = w;
      const vh = h;
      const stemTop = vh * 0.25;
      const stemBot = vh * 0.75;
      const stemEnd = vw - headW;
      return {
        d: `M 0,${stemTop} L ${stemEnd},${stemTop} L ${stemEnd},0 L ${vw},${vh/2} L ${stemEnd},${vh} L ${stemEnd},${stemBot} L 0,${stemBot} Z`,
        viewBox: `0 0 ${vw} ${vh}`,
      };
    },
  },
  {
    key: "arrow-left",
    label: "Arrow Left",
    category: "arrows",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "100,25 40,25 40,0 0,50 40,100 40,75 100,75", fill, stroke, strokeWidth: sw }),
    defaultW: 200,
    defaultH: 150,
    resizePath: (w, h) => {
      const headW = Math.min(50, w * 0.4);
      const vw = w;
      const vh = h;
      const stemTop = vh * 0.25;
      const stemBot = vh * 0.75;
      const stemStart = headW;
      return {
        d: `M ${vw},${stemTop} L ${stemStart},${stemTop} L ${stemStart},0 L 0,${vh/2} L ${stemStart},${vh} L ${stemStart},${stemBot} L ${vw},${stemBot} Z`,
        viewBox: `0 0 ${vw} ${vh}`,
      };
    },
  },
  {
    key: "arrow-up",
    label: "Arrow Up",
    category: "arrows",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "25,100 25,40 0,40 50,0 100,40 75,40 75,100", fill, stroke, strokeWidth: sw }),
    defaultW: 150,
    defaultH: 200,
    resizePath: (w, h) => {
      const headH = Math.min(50, h * 0.4);
      const vw = w;
      const vh = h;
      const stemLeft = vw * 0.25;
      const stemRight = vw * 0.75;
      const stemStart = headH;
      return {
        d: `M ${stemLeft},${vh} L ${stemLeft},${stemStart} L 0,${stemStart} L ${vw/2},0 L ${vw},${stemStart} L ${stemRight},${stemStart} L ${stemRight},${vh} Z`,
        viewBox: `0 0 ${vw} ${vh}`,
      };
    },
  },
  {
    key: "arrow-down",
    label: "Arrow Down",
    category: "arrows",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "25,0 25,60 0,60 50,100 100,60 75,60 75,0", fill, stroke, strokeWidth: sw }),
    defaultW: 150,
    defaultH: 200,
    resizePath: (w, h) => {
      const headH = Math.min(50, h * 0.4);
      const vw = w;
      const vh = h;
      const stemLeft = vw * 0.25;
      const stemRight = vw * 0.75;
      const stemEnd = vh - headH;
      return {
        d: `M ${stemLeft},0 L ${stemLeft},${stemEnd} L 0,${stemEnd} L ${vw/2},${vh} L ${vw},${stemEnd} L ${stemRight},${stemEnd} L ${stemRight},0 Z`,
        viewBox: `0 0 ${vw} ${vh}`,
      };
    },
  },
  {
    key: "double-arrow",
    label: "Double Arrow",
    category: "arrows",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "0,50 20,0 20,35 80,35 80,0 100,50 80,100 80,65 20,65 20,100", fill, stroke, strokeWidth: sw }),
    defaultW: 250,
    defaultH: 150,
    resizePath: (w, h) => {
      const headW = Math.min(50, w * 0.25);
      const vw = w;
      const vh = h;
      const stemTop = vh * 0.35;
      const stemBot = vh * 0.65;
      return {
        d: `M 0,${vh/2} L ${headW},0 L ${headW},${stemTop} L ${vw-headW},${stemTop} L ${vw-headW},0 L ${vw},${vh/2} L ${vw-headW},${vh} L ${vw-headW},${stemBot} L ${headW},${stemBot} L ${headW},${vh} Z`,
        viewBox: `0 0 ${vw} ${vh}`,
      };
    },
  },

  // ── Lines ──
  {
    key: "line-horizontal",
    label: "Horizontal",
    category: "lines",
    viewBox: "0 0 100 20",
    path: (_fill, stroke, sw) =>
      h("line", { x1: 2, y1: 10, x2: 98, y2: 10, stroke, strokeWidth: Math.max(sw, 4), strokeLinecap: "round", fill: "none" }),
    defaultW: 250,
    defaultH: 20,
    isLine: true,
  },
  {
    key: "line-vertical",
    label: "Vertical",
    category: "lines",
    viewBox: "0 0 20 100",
    path: (_fill, stroke, sw) =>
      h("line", { x1: 10, y1: 2, x2: 10, y2: 98, stroke, strokeWidth: Math.max(sw, 4), strokeLinecap: "round", fill: "none" }),
    defaultW: 20,
    defaultH: 250,
    isLine: true,
  },
  {
    key: "line-diagonal",
    label: "Diagonal",
    category: "lines",
    viewBox: "0 0 100 100",
    path: (_fill, stroke, sw) =>
      h("line", { x1: 5, y1: 95, x2: 95, y2: 5, stroke, strokeWidth: Math.max(sw, 4), strokeLinecap: "round", fill: "none" }),
    defaultW: 200,
    defaultH: 200,
    isLine: true,
  },

  // ── Stars ──
  {
    key: "star-4",
    label: "4-Point Star",
    category: "stars",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "50,0 62,38 100,50 62,62 50,100 38,62 0,50 38,38", fill, stroke, strokeWidth: sw }),
    defaultW: 200,
    defaultH: 200,
  },
  {
    key: "star-5",
    label: "5-Point Star",
    category: "stars",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "50,3 61,38 98,38 68,60 79,95 50,73 21,95 32,60 2,38 39,38", fill, stroke, strokeWidth: sw }),
    defaultW: 200,
    defaultH: 200,
  },
  {
    key: "star-6",
    label: "6-Point Star",
    category: "stars",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "50,0 62,30 95,15 80,50 95,85 62,70 50,100 38,70 5,85 20,50 5,15 38,30", fill, stroke, strokeWidth: sw }),
    defaultW: 200,
    defaultH: 200,
  },

  // ── Callouts ──
  {
    key: "speech-bubble",
    label: "Speech Bubble",
    category: "callouts",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("path", {
        d: "M10,10 h80 a5,5 0 0 1 5,5 v45 a5,5 0 0 1 -5,5 h-50 l-15,25 5,-25 h-20 a5,5 0 0 1 -5,-5 v-45 a5,5 0 0 1 5,-5 z",
        fill, stroke, strokeWidth: sw,
      }),
    defaultW: 250,
    defaultH: 200,
    resizePath: (w, h) => {
      // Tail stays fixed size at bottom-left, body stretches
      const r = 5; // corner radius
      const tailW = 15; // tail horizontal span
      const tailH = Math.min(25, h * 0.15); // tail height, fixed but capped
      const pad = Math.min(10, w * 0.05, h * 0.05); // edge padding
      const bodyH = h - tailH - pad;
      const bodyW = w - pad * 2;
      const x0 = pad;
      const y0 = pad;
      // Tail attaches at ~25% from left of body bottom
      const tailX = x0 + bodyW * 0.25;
      return {
        d: `M ${x0+r},${y0} L ${x0+bodyW-r},${y0} Q ${x0+bodyW},${y0} ${x0+bodyW},${y0+r} L ${x0+bodyW},${y0+bodyH-r} Q ${x0+bodyW},${y0+bodyH} ${x0+bodyW-r},${y0+bodyH} L ${tailX+tailW},${y0+bodyH} L ${tailX},${y0+bodyH+tailH} L ${tailX+5},${y0+bodyH} L ${x0+r},${y0+bodyH} Q ${x0},${y0+bodyH} ${x0},${y0+bodyH-r} L ${x0},${y0+r} Q ${x0},${y0} ${x0+r},${y0} Z`,
        viewBox: `0 0 ${w} ${h}`,
      };
    },
  },
  {
    key: "thought-bubble",
    label: "Thought Bubble",
    category: "callouts",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h(React.Fragment, null,
        h("ellipse", { cx: 50, cy: 40, rx: 40, ry: 30, fill, stroke, strokeWidth: sw }),
        h("circle", { cx: 25, cy: 78, r: 7, fill, stroke, strokeWidth: sw }),
        h("circle", { cx: 18, cy: 92, r: 4, fill, stroke, strokeWidth: sw }),
      ),
    defaultW: 250,
    defaultH: 200,
    resizePath: (w, h) => {
      // Ellipse body stretches, thought dots stay fixed at bottom-left
      const dotBig = 7;
      const dotSmall = 4;
      const dotPadding = dotSmall * 2 + dotBig * 2 + 10; // space for dots below
      const bodyH = h - dotPadding;
      const cx = w / 2;
      const cy = bodyH / 2;
      const rx = (w - 20) / 2;
      const ry = (bodyH - 10) / 2;
      // Bezier approximation of ellipse
      const kx = rx * 0.5523;
      const ky = ry * 0.5523;
      const d1 = `M ${cx},${cy-ry} C ${cx+kx},${cy-ry} ${cx+rx},${cy-ky} ${cx+rx},${cy} C ${cx+rx},${cy+ky} ${cx+kx},${cy+ry} ${cx},${cy+ry} C ${cx-kx},${cy+ry} ${cx-rx},${cy+ky} ${cx-rx},${cy} C ${cx-rx},${cy-ky} ${cx-kx},${cy-ry} ${cx},${cy-ry} Z`;
      // Small dots
      const d2x = w * 0.25;
      const d2y = bodyH + dotBig + 2;
      const d2 = `M ${d2x},${d2y-dotBig} C ${d2x+dotBig*0.55},${d2y-dotBig} ${d2x+dotBig},${d2y-dotBig*0.55} ${d2x+dotBig},${d2y} C ${d2x+dotBig},${d2y+dotBig*0.55} ${d2x+dotBig*0.55},${d2y+dotBig} ${d2x},${d2y+dotBig} C ${d2x-dotBig*0.55},${d2y+dotBig} ${d2x-dotBig},${d2y+dotBig*0.55} ${d2x-dotBig},${d2y} C ${d2x-dotBig},${d2y-dotBig*0.55} ${d2x-dotBig*0.55},${d2y-dotBig} ${d2x},${d2y-dotBig} Z`;
      const d3x = d2x - 7;
      const d3y = d2y + dotBig + dotSmall + 4;
      const d3 = `M ${d3x},${d3y-dotSmall} C ${d3x+dotSmall*0.55},${d3y-dotSmall} ${d3x+dotSmall},${d3y-dotSmall*0.55} ${d3x+dotSmall},${d3y} C ${d3x+dotSmall},${d3y+dotSmall*0.55} ${d3x+dotSmall*0.55},${d3y+dotSmall} ${d3x},${d3y+dotSmall} C ${d3x-dotSmall*0.55},${d3y+dotSmall} ${d3x-dotSmall},${d3y+dotSmall*0.55} ${d3x-dotSmall},${d3y} C ${d3x-dotSmall},${d3y-dotSmall*0.55} ${d3x-dotSmall*0.55},${d3y-dotSmall} ${d3x},${d3y-dotSmall} Z`;
      return {
        d: `${d1} ${d2} ${d3}`,
        viewBox: `0 0 ${w} ${h}`,
      };
    },
  },

  // ── Other ──
  {
    key: "heart",
    label: "Heart",
    category: "other",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("path", {
        d: "M50,88 C25,65 2,50 2,30 A22,22 0,0,1,50,20 A22,22 0,0,1,98,30 C98,50 75,65 50,88Z",
        fill, stroke, strokeWidth: sw,
      }),
    defaultW: 200,
    defaultH: 200,
  },
  {
    key: "cross",
    label: "Cross",
    category: "other",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "35,0 65,0 65,35 100,35 100,65 65,65 65,100 35,100 35,65 0,65 0,35 35,35", fill, stroke, strokeWidth: sw }),
    defaultW: 200,
    defaultH: 200,
  },
  {
    key: "ring",
    label: "Ring",
    category: "other",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("path", {
        d: "M50,2 A48,48 0 1,1 49.99,2 Z M50,20 A30,30 0 1,0 50.01,20 Z",
        fill, stroke, strokeWidth: sw, fillRule: "evenodd",
      }),
    defaultW: 200,
    defaultH: 200,
  },
  {
    key: "chevron-right",
    label: "Chevron Right",
    category: "other",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "25,5 75,50 25,95 40,50", fill, stroke, strokeWidth: sw }),
    defaultW: 150,
    defaultH: 200,
  },
  {
    key: "chevron-left",
    label: "Chevron Left",
    category: "other",
    viewBox: "0 0 100 100",
    path: (fill, stroke, sw) =>
      h("polygon", { points: "75,5 25,50 75,95 60,50", fill, stroke, strokeWidth: sw }),
    defaultW: 150,
    defaultH: 200,
  },
  // ── Drawn (not shown in panel, created by drawing tools) ──
  {
    key: "freehand",
    label: "Freehand",
    category: "drawn",
    viewBox: "0 0 100 100",
    path: (_fill, stroke, sw) =>
      h("line", { x1: 10, y1: 50, x2: 90, y2: 50, stroke, strokeWidth: Math.max(sw, 3), strokeLinecap: "round", fill: "none" }),
    defaultW: 200,
    defaultH: 200,
    isLine: true,
  },
  {
    key: "pen-path",
    label: "Pen Path",
    category: "drawn",
    viewBox: "0 0 100 100",
    path: (_fill, stroke, sw) =>
      h("line", { x1: 10, y1: 50, x2: 90, y2: 50, stroke, strokeWidth: Math.max(sw, 3), strokeLinecap: "round", fill: "none" }),
    defaultW: 200,
    defaultH: 200,
    isLine: true,
  },
  {
    key: "drawn-line",
    label: "Line",
    category: "drawn",
    viewBox: "0 0 100 100",
    path: (_fill, stroke, sw) =>
      h("line", { x1: 5, y1: 50, x2: 95, y2: 50, stroke, strokeWidth: Math.max(sw, 3), strokeLinecap: "round", fill: "none" }),
    defaultW: 200,
    defaultH: 20,
    isLine: true,
  },
  {
    key: "arrow-line",
    label: "Arrow Line",
    category: "drawn",
    viewBox: "0 0 100 100",
    path: (_fill, stroke, sw) =>
      h(React.Fragment, null,
        h("defs", null, h("marker", { id: "arrowhead-preview", markerWidth: 10, markerHeight: 7, refX: 10, refY: 3.5, orient: "auto" },
          h("polygon", { points: "0 0, 10 3.5, 0 7", fill: stroke }))),
        h("line", { x1: 5, y1: 50, x2: 90, y2: 50, stroke, strokeWidth: Math.max(sw, 3), strokeLinecap: "round", fill: "none", markerEnd: "url(#arrowhead-preview)" }),
      ),
    defaultW: 200,
    defaultH: 20,
    isLine: true,
  },
];

export const shapesByCategory = shapeDefinitions.reduce<Record<string, ShapeDefinition[]>>(
  (acc, shape) => {
    if (!acc[shape.category]) acc[shape.category] = [];
    acc[shape.category].push(shape);
    return acc;
  },
  {}
);

export const getShapeByKey = (key: string): ShapeDefinition | undefined =>
  shapeDefinitions.find((s) => s.key === key);

export const categoryLabels: Record<string, string> = {
  basic: "Basic",
  arrows: "Arrows",
  lines: "Lines",
  stars: "Stars",
  callouts: "Callouts",
  other: "Other",
  drawn: "Drawn",
};

/** Check if a shape key represents a line/stroke-only shape */
export const isLineShape = (key: string): boolean => {
  const shape = getShapeByKey(key);
  return shape?.isLine === true;
};
