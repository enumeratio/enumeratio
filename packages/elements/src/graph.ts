// Pure SVG renderers for graph & hierarchical layouts, mirroring chart.ts's
// shape: typed data in, a themeable SVG string out, no DOM dependency so every
// layout is unit-testable. Covers Wolfram's Data Visualization guide --
// TreePlot, GraphPlot, LayeredGraphPlot, Dendrogram.
//
// Every layout here is a pure, deterministic function of its input: no
// Math.random, no Date, no DOM measurement. These render server-side (VitePress
// SSR) and are asserted on exact coordinates, so the same input must always
// produce byte-identical SVG.

const ACCENT = "var(--notatio-accent, var(--vp-c-brand-1, #d97706))";
const AXIS = "var(--notatio-border, var(--vp-c-divider, currentColor))";
const FG = "var(--notatio-fg, currentColor)";
const BG = "var(--notatio-bg, var(--vp-c-bg, #ffffff))";

const n2 = (x: number): string => String(Math.round(x * 100) / 100);

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const frame = (w: number, h: number, body: string, ariaLabel: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n2(w)} ${n2(h)}" role="img" aria-label="${ariaLabel}">${body}</svg>`;

/** A minimal empty frame for missing/invalid input, mirroring chart.ts's empty-data frames. */
const emptyFrame = (ariaLabel: string): string => frame(80, 40, "", ariaLabel);

const titleSvg = (w: number, title: string | undefined): string =>
  title
    ? `<text x="${n2(w / 2)}" y="14" text-anchor="middle" font-size="12" font-family="ui-sans-serif, system-ui, sans-serif" fill="${FG}">${esc(title)}</text>`
    : "";

const nodeLabel = (x: number, y: number, text: string): string =>
  text
    ? `<text x="${n2(x)}" y="${n2(y)}" text-anchor="middle" font-size="9" font-family="ui-monospace, monospace" fill="${FG}" opacity="0.75">${esc(text)}</text>`
    : "";

// ---------------------------------------------------------------------------
// Shared node/edge shapes
// ---------------------------------------------------------------------------

/** Nested-tree input shared by TreePlot and Dendrogram. */
export interface TreeNode {
  label?: string;
  /** Merge height (Dendrogram only -- TreePlot ignores it). */
  height?: number;
  children?: TreeNode[];
}

/** Graph input shared by GraphPlot and LayeredGraphPlot. Node ids are strings. */
export interface GraphData {
  /** Explicit node id list (kept even if disconnected); inferred from edges when omitted. */
  nodes?: readonly string[];
  edges: readonly (readonly [string, string])[];
}

/** Union of `nodes` (in order) and every id appearing in `edges` (first-seen order). */
function collectNodes(data: GraphData): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of data.nodes ?? [])
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  for (const [a, b] of data.edges)
    for (const id of [a, b])
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
  return out;
}

const ARROW_MARKER = `<defs><marker id="notatio-graphplot-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${ACCENT}"/></marker></defs>`;

/** A line trimmed at both ends by `r` (node radius) so it meets the node's boundary, not its center. */
function trimmedLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist === 0 || dist <= 2 * r) return { x1, y1, x2, y2 };
  const ux = dx / dist;
  const uy = dy / dist;
  return { x1: x1 + ux * r, y1: y1 + uy * r, x2: x2 - ux * r, y2: y2 - uy * r };
}

// ---------------------------------------------------------------------------
// TreePlot
// ---------------------------------------------------------------------------

const TREE_UNIT_X = 46;
const TREE_UNIT_Y = 54;
const TREE_R = 9;

export interface TreePlotOptions {
  title?: string;
}

interface TreePlaced {
  x: number;
  depth: number;
  label: string;
  children: TreePlaced[];
}

/** Tidy layout: leaves take sequential x left-to-right, an internal node sits at the mean x of its children. */
function layoutTree(node: TreeNode, depth: number, leafCounter: { n: number }): TreePlaced {
  const kids = node.children ?? [];
  if (kids.length === 0) {
    const x = leafCounter.n++;
    return { x, depth, label: node.label ?? "", children: [] };
  }
  const placedKids = kids.map((k) => layoutTree(k, depth + 1, leafCounter));
  const x = placedKids.reduce((s, k) => s + k.x, 0) / placedKids.length;
  return { x, depth, label: node.label ?? "", children: placedKids };
}

function maxDepthOf(node: TreePlaced): number {
  return node.children.reduce((m, k) => Math.max(m, maxDepthOf(k)), node.depth);
}

/** A rooted tree laid out tidily by depth: nodes as circles, parent -> child edges as lines. */
export function treePlotSvg(root: TreeNode | undefined, opts: TreePlotOptions = {}): string {
  if (!root) return emptyFrame("tree plot");

  const placed = layoutTree(root, 0, { n: 0 });
  const leaves = Math.max(1, countLeaves(placed));
  const depth = maxDepthOf(placed);

  const mT = opts.title ? 24 : 12;
  const mL = 16;
  const mR = 16;
  const mB = 16;
  const cx = (x: number): number => mL + x * TREE_UNIT_X + TREE_R;
  const cy = (d: number): number => mT + d * TREE_UNIT_Y + TREE_R;

  let edges = "";
  let nodes = "";
  const walk = (p: TreePlaced): void => {
    nodes += `<circle cx="${n2(cx(p.x))}" cy="${n2(cy(p.depth))}" r="${TREE_R}" fill="${BG}" stroke="${ACCENT}" stroke-width="1.5"/>`;
    nodes += nodeLabel(cx(p.x), cy(p.depth) + TREE_R + 11, p.label);
    for (const k of p.children) {
      edges += `<line x1="${n2(cx(p.x))}" y1="${n2(cy(p.depth))}" x2="${n2(cx(k.x))}" y2="${n2(cy(k.depth))}" stroke="${AXIS}" stroke-width="1.5"/>`;
      walk(k);
    }
  };
  walk(placed);

  const w = mL + Math.max(0, leaves - 1) * TREE_UNIT_X + 2 * TREE_R + mR;
  const h = mT + depth * TREE_UNIT_Y + 2 * TREE_R + mB;

  return frame(w, h, titleSvg(w, opts.title) + edges + nodes, "tree plot");
}

function countLeaves(p: TreePlaced): number {
  return p.children.length === 0 ? 1 : p.children.reduce((s, k) => s + countLeaves(k), 0);
}

// ---------------------------------------------------------------------------
// GraphPlot
// ---------------------------------------------------------------------------

const GRAPH_R = 10;

export interface GraphPlotOptions {
  title?: string;
  /** Draw arrowheads a -> b (Wolfram's `DirectedEdge`). */
  directed?: boolean;
}

/** A deterministic circular layout: node i of n sits at angle (i/n)*2*PI, starting at the top. */
function circularPositions(
  ids: readonly string[],
  R: number,
  cx: number,
  cy: number,
): Map<string, { x: number; y: number }> {
  const n = ids.length;
  const pos = new Map<string, { x: number; y: number }>();
  ids.forEach((id, i) => {
    if (n === 1) {
      pos.set(id, { x: cx, y: cy });
      return;
    }
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    pos.set(id, { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) });
  });
  return pos;
}

/** Undirected (or directed) graph: nodes on a deterministic circle, edges as lines. */
export function graphPlotSvg(data: GraphData | undefined, opts: GraphPlotOptions = {}): string {
  const edges = data?.edges ?? [];
  const ids = data ? collectNodes(data) : [];
  if (ids.length === 0) return emptyFrame("graph plot");

  const mT = opts.title ? 24 : 12;
  const labelPad = 16;
  const R = Math.max(50, ids.length * 13);
  const size = 2 * (R + GRAPH_R + labelPad);
  const cx = size / 2;
  const cy = mT + size / 2;

  const pos = circularPositions(ids, R, cx, cy);

  let edgesSvg = "";
  let hasSelfLoop = false;
  for (const [a, b] of edges) {
    const pa = pos.get(a);
    const pb = pos.get(b);
    if (!pa || !pb) continue;
    if (a === b) {
      hasSelfLoop = true;
      const lx = pa.x;
      const ly = pa.y - GRAPH_R - 8;
      edgesSvg += `<circle cx="${n2(lx)}" cy="${n2(ly)}" r="8" fill="none" stroke="${AXIS}" stroke-width="1.5"/>`;
      continue;
    }
    const trimmed = trimmedLine(pa.x, pa.y, pb.x, pb.y, GRAPH_R);
    const marker = opts.directed ? ` marker-end="url(#notatio-graphplot-arrow)"` : "";
    edgesSvg += `<line x1="${n2(trimmed.x1)}" y1="${n2(trimmed.y1)}" x2="${n2(trimmed.x2)}" y2="${n2(trimmed.y2)}" stroke="${AXIS}" stroke-width="1.5"${marker}/>`;
  }

  const nodesSvg = ids
    .map((id) => {
      const p = pos.get(id);
      if (!p) return "";
      return (
        `<circle cx="${n2(p.x)}" cy="${n2(p.y)}" r="${GRAPH_R}" fill="${BG}" stroke="${ACCENT}" stroke-width="1.5"/>` +
        nodeLabel(p.x, p.y + 3, id)
      );
    })
    .join("");

  const defs = opts.directed && edges.length > 0 ? ARROW_MARKER : "";
  const h = mT + size + (hasSelfLoop ? 4 : 0);

  return frame(size, h, defs + titleSvg(size, opts.title) + edgesSvg + nodesSvg, "graph plot");
}

// ---------------------------------------------------------------------------
// LayeredGraphPlot
// ---------------------------------------------------------------------------

const LAYER_UNIT_X = 70;
const LAYER_UNIT_Y = 64;

/**
 * Longest-path layering via Kahn's algorithm: layer(v) = 1 + max(layer(u)) over
 * in-edges u -> v, sources at layer 0. A cycle leaves its members stalled at
 * whatever layer they last reached (never revisited) -- deterministic, no
 * infinite loop, and malformed/cyclic input still renders instead of throwing.
 */
function computeLayers(
  ids: readonly string[],
  edges: readonly (readonly [string, string])[],
): Map<string, number> {
  const adj = new Map<string, string[]>(ids.map((id) => [id, []]));
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const [a, b] of edges) {
    if (!adj.has(a) || !indeg.has(b)) continue;
    adj.get(a)!.push(b);
    indeg.set(b, (indeg.get(b) ?? 0) + 1);
  }
  const layer = new Map<string, number>(ids.map((id) => [id, 0]));
  const remaining = new Map(indeg);
  const visited = new Set<string>();
  const queue = ids.filter((id) => indeg.get(id) === 0);
  let qi = 0;
  while (qi < queue.length) {
    const u = queue[qi++];
    visited.add(u);
    for (const v of adj.get(u) ?? []) {
      layer.set(v, Math.max(layer.get(v) ?? 0, (layer.get(u) ?? 0) + 1));
      remaining.set(v, (remaining.get(v) ?? 0) - 1);
      if (remaining.get(v) === 0 && !visited.has(v)) queue.push(v);
    }
  }
  return layer;
}

export interface LayeredGraphPlotOptions {
  title?: string;
}

/** A DAG laid out top-to-bottom by longest-path layer, nodes ordered deterministically within each layer. */
export function layeredGraphPlotSvg(
  data: GraphData | undefined,
  opts: LayeredGraphPlotOptions = {},
): string {
  const edges = data?.edges ?? [];
  const ids = data ? collectNodes(data) : [];
  if (ids.length === 0) return emptyFrame("layered graph plot");

  const layer = computeLayers(ids, edges);
  const maxLayer = Math.max(0, ...ids.map((id) => layer.get(id) ?? 0));

  const byLayer: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const id of ids) byLayer[layer.get(id) ?? 0].push(id);
  const maxCount = Math.max(1, ...byLayer.map((l) => l.length));

  const mT = opts.title ? 24 : 12;
  const mB = 16;
  const plotW = Math.max(2 * LAYER_UNIT_X, maxCount * LAYER_UNIT_X);

  const pos = new Map<string, { x: number; y: number }>();
  byLayer.forEach((layerIds, L) => {
    const k = layerIds.length;
    layerIds.forEach((id, i) => {
      const x = ((i + 0.5) / k) * plotW;
      const y = mT + L * LAYER_UNIT_Y + GRAPH_R;
      pos.set(id, { x, y });
    });
  });

  let edgesSvg = "";
  for (const [a, b] of edges) {
    const pa = pos.get(a);
    const pb = pos.get(b);
    if (!pa || !pb || a === b) continue;
    const trimmed = trimmedLine(pa.x, pa.y, pb.x, pb.y, GRAPH_R);
    edgesSvg += `<line x1="${n2(trimmed.x1)}" y1="${n2(trimmed.y1)}" x2="${n2(trimmed.x2)}" y2="${n2(trimmed.y2)}" stroke="${AXIS}" stroke-width="1.5" marker-end="url(#notatio-graphplot-arrow)"/>`;
  }

  const nodesSvg = ids
    .map((id) => {
      const p = pos.get(id);
      if (!p) return "";
      return (
        `<circle cx="${n2(p.x)}" cy="${n2(p.y)}" r="${GRAPH_R}" fill="${BG}" stroke="${ACCENT}" stroke-width="1.5"/>` +
        nodeLabel(p.x, p.y + 3, id)
      );
    })
    .join("");

  const w = plotW;
  const h = mT + maxLayer * LAYER_UNIT_Y + 2 * GRAPH_R + mB;
  const defs = edges.length > 0 ? ARROW_MARKER : "";

  return frame(w, h, defs + titleSvg(w, opts.title) + edgesSvg + nodesSvg, "layered graph plot");
}

// ---------------------------------------------------------------------------
// Dendrogram
// ---------------------------------------------------------------------------

const DENDRO_UNIT_X = 40;
const DENDRO_PLOT_H = 150;
const DENDRO_R = 6;

export interface DendrogramOptions {
  title?: string;
}

interface DendroPlaced {
  x: number;
  height: number;
  label: string;
  children: DendroPlaced[];
}

/**
 * Merge-tree layout: leaves get sequential x in traversal order, an internal
 * node's x is the mean of its children's x. Height comes from `node.height`
 * when given; otherwise it's inferred as one more than its tallest child, so a
 * tree with no heights still renders a well-formed dendrogram.
 */
function layoutDendrogram(node: TreeNode, leafCounter: { n: number }): DendroPlaced {
  const kids = node.children ?? [];
  if (kids.length === 0) {
    const x = leafCounter.n++;
    return { x, height: 0, label: node.label ?? "", children: [] };
  }
  const placedKids = kids.map((k) => layoutDendrogram(k, leafCounter));
  const x = placedKids.reduce((s, k) => s + k.x, 0) / placedKids.length;
  const childMax = Math.max(...placedKids.map((k) => k.height));
  const height =
    typeof node.height === "number" && Number.isFinite(node.height)
      ? Math.max(node.height, childMax)
      : childMax + 1;
  return { x, height, label: node.label ?? "", children: placedKids };
}

/** A hierarchical-clustering merge tree: U-shaped brackets joined at merge heights, leaves along the x axis. */
export function dendrogramSvg(root: TreeNode | undefined, opts: DendrogramOptions = {}): string {
  if (!root) return emptyFrame("dendrogram");

  const placed = layoutDendrogram(root, { n: 0 });
  const leaves = Math.max(1, countLeavesD(placed));
  const maxHeight = placed.height;

  const mT = opts.title ? 24 : 12;
  const mL = 16;
  const mR = 16;
  const mB = 18;
  const plotH = DENDRO_PLOT_H;
  const xAt = (x: number): number => mL + x * DENDRO_UNIT_X;
  const yAt = (height: number): number =>
    maxHeight === 0 ? mT + plotH : mT + ((maxHeight - height) / maxHeight) * plotH;

  let body = "";
  const walk = (p: DendroPlaced): void => {
    if (p.children.length === 0) {
      body += `<circle cx="${n2(xAt(p.x))}" cy="${n2(yAt(0))}" r="${DENDRO_R}" fill="${BG}" stroke="${ACCENT}" stroke-width="1.5"/>`;
      body += nodeLabel(xAt(p.x), yAt(0) + DENDRO_R + 11, p.label);
      return;
    }
    const y = yAt(p.height);
    const childXs = p.children.map((c) => xAt(c.x));
    for (const c of p.children)
      body += `<line x1="${n2(xAt(c.x))}" y1="${n2(yAt(c.height))}" x2="${n2(xAt(c.x))}" y2="${n2(y)}" stroke="${AXIS}" stroke-width="1.5"/>`;
    body += `<line x1="${n2(Math.min(...childXs))}" y1="${n2(y)}" x2="${n2(Math.max(...childXs))}" y2="${n2(y)}" stroke="${AXIS}" stroke-width="1.5"/>`;
    for (const c of p.children) walk(c);
  };
  walk(placed);

  const w = mL + Math.max(0, leaves - 1) * DENDRO_UNIT_X + mR;
  const h = mT + plotH + mB;

  return frame(w, h, titleSvg(w, opts.title) + body, "dendrogram");
}

function countLeavesD(p: DendroPlaced): number {
  return p.children.length === 0 ? 1 : p.children.reduce((s, k) => s + countLeavesD(k), 0);
}
