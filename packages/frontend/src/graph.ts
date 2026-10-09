// Graph & hierarchical layouts as `GraphicsBox`es (the wiki's Speculative-Box-Primitives, §6
// slice 4): TreePlot, GraphPlot, LayeredGraphPlot and Dendrogram from Wolfram's Data Visualization
// guide. Vertices are `DiskBox`es, edges `LineBox`es (`ArrowBox`es when directed), labels
// `InsetBox`es; `diagram.ts` draws the box.
//
// Every layout here is a pure, deterministic function of its input: no Math.random, no Date, no
// DOM measurement. These render server-side (VitePress SSR) and are asserted on exact
// coordinates, so the same input must always produce the same box.

import type { Box } from "@enumeratio/boxes";
import { ACCENT, GROUND, INK, RULE, Sketch, type Look, type TextStyle } from "./diagram.ts";

const EDGE: Look = { stroke: { color: RULE, width: 1.5 } };
const ARROW: Look = { fill: ACCENT, stroke: { color: RULE, width: 1.5 } };
const VERTEX: Look = { fill: GROUND, stroke: { color: ACCENT, width: 1.5 } };
const NAME: TextStyle = { size: 9, color: INK, anchor: "middle", mono: true, opacity: 0.75 };

/** A minimal empty frame for missing/invalid input. */
const emptyFrame = (label: string): Box => new Sketch(80, 40, { label }).box();

const vertexLabel = (sketch: Sketch, x: number, y: number, text: string): void => {
  sketch.text([x, y], text, NAME);
};

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
export function treePlotBox(root: TreeNode | undefined, opts: TreePlotOptions = {}): Box {
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

  const w = mL + Math.max(0, leaves - 1) * TREE_UNIT_X + 2 * TREE_R + mR;
  const h = mT + depth * TREE_UNIT_Y + 2 * TREE_R + mB;
  const sketch = new Sketch(w, h, { label: "tree plot", title: opts.title });

  const nodes: TreePlaced[] = [];
  const walk = (p: TreePlaced): void => {
    nodes.push(p);
    for (const k of p.children) {
      sketch.line(
        [
          [cx(p.x), cy(p.depth)],
          [cx(k.x), cy(k.depth)],
        ],
        EDGE,
      );
      walk(k);
    }
  };
  walk(placed);
  for (const p of nodes) {
    sketch.disk([cx(p.x), cy(p.depth)], TREE_R, VERTEX);
    vertexLabel(sketch, cx(p.x), cy(p.depth) + TREE_R + 11, p.label);
  }
  return sketch.box();
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
export function graphPlotBox(data: GraphData | undefined, opts: GraphPlotOptions = {}): Box {
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
  const hasSelfLoop = edges.some(([a, b]) => a === b && pos.has(a));
  const sketch = new Sketch(size, mT + size + (hasSelfLoop ? 4 : 0), { label: "graph plot", title: opts.title });

  for (const [a, b] of edges) {
    const pa = pos.get(a);
    const pb = pos.get(b);
    if (!pa || !pb) continue;
    if (a === b) {
      sketch.disk([pa.x, pa.y - GRAPH_R - 8], 8, EDGE);
      continue;
    }
    const t = trimmedLine(pa.x, pa.y, pb.x, pb.y, GRAPH_R);
    const ends: [[number, number], [number, number]] = [
      [t.x1, t.y1],
      [t.x2, t.y2],
    ];
    if (opts.directed) sketch.arrow(ends, ARROW);
    else sketch.line(ends, EDGE);
  }
  for (const id of ids) {
    const p = pos.get(id);
    if (!p) continue;
    sketch.disk([p.x, p.y], GRAPH_R, VERTEX);
    vertexLabel(sketch, p.x, p.y + 3, id);
  }
  return sketch.box();
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
function computeLayers(ids: readonly string[], edges: readonly (readonly [string, string])[]): Map<string, number> {
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
export function layeredGraphPlotBox(data: GraphData | undefined, opts: LayeredGraphPlotOptions = {}): Box {
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

  const h = mT + maxLayer * LAYER_UNIT_Y + 2 * GRAPH_R + mB;
  const sketch = new Sketch(plotW, h, { label: "layered graph plot", title: opts.title });

  for (const [a, b] of edges) {
    const pa = pos.get(a);
    const pb = pos.get(b);
    if (!pa || !pb || a === b) continue;
    const t = trimmedLine(pa.x, pa.y, pb.x, pb.y, GRAPH_R);
    sketch.arrow(
      [
        [t.x1, t.y1],
        [t.x2, t.y2],
      ],
      ARROW,
    );
  }
  for (const id of ids) {
    const p = pos.get(id);
    if (!p) continue;
    sketch.disk([p.x, p.y], GRAPH_R, VERTEX);
    vertexLabel(sketch, p.x, p.y + 3, id);
  }
  return sketch.box();
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
    typeof node.height === "number" && Number.isFinite(node.height) ? Math.max(node.height, childMax) : childMax + 1;
  return { x, height, label: node.label ?? "", children: placedKids };
}

/** A hierarchical-clustering merge tree: U-shaped brackets joined at merge heights, leaves along the x axis. */
export function dendrogramBox(root: TreeNode | undefined, opts: DendrogramOptions = {}): Box {
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

  const w = mL + Math.max(0, leaves - 1) * DENDRO_UNIT_X + mR;
  const sketch = new Sketch(w, mT + plotH + mB, { label: "dendrogram", title: opts.title });
  const walk = (p: DendroPlaced): void => {
    if (p.children.length === 0) {
      sketch.disk([xAt(p.x), yAt(0)], DENDRO_R, VERTEX);
      vertexLabel(sketch, xAt(p.x), yAt(0) + DENDRO_R + 11, p.label);
      return;
    }
    const y = yAt(p.height);
    const childXs = p.children.map((c) => xAt(c.x));
    for (const c of p.children)
      sketch.line(
        [
          [xAt(c.x), yAt(c.height)],
          [xAt(c.x), y],
        ],
        EDGE,
      );
    sketch.line(
      [
        [Math.min(...childXs), y],
        [Math.max(...childXs), y],
      ],
      EDGE,
    );
    for (const c of p.children) walk(c);
  };
  walk(placed);
  return sketch.box();
}

function countLeavesD(p: DendroPlaced): number {
  return p.children.length === 0 ? 1 : p.children.reduce((s, k) => s + countLeavesD(k), 0);
}

// ---------------------------------------------------------------------------
// Reading the data
// ---------------------------------------------------------------------------

const isId = (v: unknown): v is string | number => typeof v === "string" || typeof v === "number";

/**
 * Coerce raw JSON into a `TreeNode`: `{ label?, height?, children? }`, recursively. A non-object
 * (or an object whose `children` isn't a list) still reads as a valid (possibly childless) node
 * rather than throwing.
 */
export function treeOf(data: unknown): TreeNode | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const obj = data as Record<string, unknown>;
  const node: TreeNode = {};
  if (typeof obj.label === "string") node.label = obj.label;
  if (typeof obj.height === "number" && Number.isFinite(obj.height)) node.height = obj.height;
  if (Array.isArray(obj.children)) {
    const kids = obj.children.map(treeOf).filter((k): k is TreeNode => k !== undefined);
    if (kids.length > 0) node.children = kids;
  }
  return node;
}

/**
 * Coerce raw JSON into `GraphData`: `{ nodes?: [...], edges: [[a,b], ...] }`. Node ids (numbers
 * or strings) are normalized to strings; malformed edges are dropped rather than throwing.
 */
export function graphOf(data: unknown): GraphData | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const obj = data as Record<string, unknown>;
  const nodes = Array.isArray(obj.nodes) ? obj.nodes.filter(isId).map(String) : undefined;
  const rawEdges = Array.isArray(obj.edges) ? obj.edges : [];
  const edges = rawEdges
    .filter(
      (e): e is [string | number, string | number] => Array.isArray(e) && e.length === 2 && isId(e[0]) && isId(e[1]),
    )
    .map(([a, b]): [string, string] => [String(a), String(b)]);
  return { nodes, edges };
}
