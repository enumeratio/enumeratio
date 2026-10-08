// The tree frame: a layer for `Show` whose addresses are (depth, order), the root at depth 0 and
// each depth's nodes numbered left to right from 0, placed by the tidy layout (leaves at
// consecutive x, a parent over the mean of its children). Its links are the parent edges. A plane
// tree (`PlaneTree`, its preorder child counts) and a binary tree (`BinaryTree`, nested, a leaf 0
// and a node [left, right]) are both this frame.
//
// Properties: IsLeaf, IsRoot, IsInternal. Values: Depth, Order, Index (preorder), Children,
// SubtreeSize. Relations to the selection: Ancestor, Descendant (both strict), Subtree (the
// selected node and its descendants), Sibling, Adjacent (a parent or a child).

import { argsOf, type FigureLayer, headOf, intsOf, type Json, normal, UNIT_BASIS, unwrapped } from "./frame-json.ts";
import { treeLayout } from "./glyphs.ts";
import type { Address, GraphicsPrimitive } from "./tiles-canvas.ts";

/** A tree by its preorder child counts: node `i` has `counts[i]` children. */
export interface TreeModel {
  readonly counts: readonly number[];
}

/** Whether `counts` is the preorder child-count word of exactly one tree. */
function wellFormed(counts: readonly number[]): boolean {
  let owed = 1;
  for (const c of counts) {
    if (owed === 0 || c < 0) return false;
    owed += c - 1;
  }
  return counts.length > 0 && owed === 0;
}

/** A binary tree's nested form, flattened to child counts: a leaf is 0, a node is [left, right]. */
function binaryCounts(json: Json, out: number[] = []): number[] | undefined {
  if (json === 0 || json === "0") return (out.push(0), out);
  const kids = headOf(json) === "List" ? argsOf(json) : [];
  if (kids.length !== 2) return undefined;
  out.push(2);
  return binaryCounts(kids[0], out) && binaryCounts(kids[1], out) ? out : undefined;
}

/** The model an expression names: `PlaneTree(counts)` or `BinaryTree(nested)`. */
export function treeModelOf(node: Json): TreeModel | string {
  const json = unwrapped(node);
  const [arg] = argsOf(json);
  const counts =
    headOf(json) === "PlaneTree" ? intsOf(arg) : headOf(json) === "BinaryTree" ? binaryCounts(arg) : undefined;
  if (counts && wellFormed(counts)) return { counts };
  return "TreeDiagram needs PlaneTree([2, 0, 0]) (preorder child counts) or BinaryTree([0, 0]).";
}

/** Node radius, in leaf spacings. */
const RADIUS = 0.25;

/** A tree as a layer for `Show`: a node at (depth, order), the parent edges as its links. */
export function treeLayer(model: TreeModel): FigureLayer {
  const { counts } = model;
  const n = counts.length;
  const { parent, depth, x } = treeLayout(counts);
  // Preorder keeps a node's subtree contiguous, so its extent is its size.
  const size = counts.map(() => 1);
  for (let i = n - 1; i > 0; i--) size[parent[i]!]! += size[i]!;
  const order = new Array<number>(n);
  const seen: number[] = [];
  for (let i = 0; i < n; i++) order[i] = seen[depth[i]!] = (seen[depth[i]!] ?? -1) + 1;
  const byAddress = new Map(counts.map((_, i) => [`${depth[i]},${order[i]}`, i] as const));
  const nodeAt = (d: number, o: number): number | undefined => byAddress.get(`${d},${o}`);
  const address = (i: number): Address => [depth[i]!, order[i]!];
  const links = counts.flatMap((_, i) => (parent[i]! >= 0 ? [[address(parent[i]!), address(i)] as const] : []));
  const below = (c: number, s: number): boolean => c > s && c < s + size[s]!;

  return {
    title: `Tree on ${n} ${n === 1 ? "node" : "nodes"}`,
    view: "fixed",
    basis: UNIT_BASIS,
    maxIndex: n,
    bounds: { i: [0, Math.max(...depth)], j: [0, Math.max(...order)] },
    grid: UNIT_BASIS,
    gridLabel: (_axis, k) => String(k),
    addresses: () => counts.map((_, i) => address(i)),
    place: (d, o) => {
      const i = nodeAt(d, o);
      return i === undefined ? [0, -d] : [x[i]!, -d];
    },
    mark: (): GraphicsPrimitive => ({ head: "Disk", radius: RADIUS }),
    links: () => links,
    known: () => true,
    prepare: () => {},
    has: (d, o, name) => {
      const i = nodeAt(d, o);
      if (i === undefined) return undefined;
      switch (normal(name)) {
        case "leaf":
          return counts[i] === 0;
        case "root":
          return i === 0;
        case "internal":
          return counts[i]! > 0;
        case "unknown":
          return false;
      }
      return undefined;
    },
    value: (d, o, name) => {
      const i = nodeAt(d, o);
      if (i === undefined) return undefined;
      switch (normal(name)) {
        case "depth":
          return depth[i];
        case "order":
          return order[i];
        case "index":
          return i;
        case "children":
          return counts[i];
        case "subtreesize":
          return size[i];
      }
      return undefined;
    },
    relatedTo: (relation, [td, to], d, o) => {
      const [c, s] = [nodeAt(d, o), nodeAt(td, to)];
      if (c === undefined || s === undefined) return false;
      switch (relation) {
        case "Ancestor":
          return below(s, c);
        case "Descendant":
          return below(c, s);
        case "Subtree":
          return c === s || below(c, s);
        case "Sibling":
          return c !== s && parent[c] === parent[s] && parent[c]! >= 0;
        case "Adjacent":
          return parent[c] === s || parent[s] === c;
      }
      return false;
    },
    summary: () => [
      ["nodes", String(n)],
      ["leaves", String(counts.filter((c) => c === 0).length)],
      ["height", String(Math.max(...depth))],
    ],
    describe: (d, o) => {
      const i = nodeAt(d, o);
      if (i === undefined) return { title: `(${d}, ${o})`, rows: [] };
      return {
        title: i === 0 ? "root" : `node (${d}, ${o})`,
        rows: [
          ["depth", String(d)],
          ["children", String(counts[i])],
          ["subtree", `${size[i]} ${size[i] === 1 ? "node" : "nodes"}`],
        ],
      };
    },
  };
}
