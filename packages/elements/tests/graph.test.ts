import { expect, test } from "vite-plus/test";
import {
  dendrogramSvg,
  graphPlotSvg,
  layeredGraphPlotSvg,
  treePlotSvg,
  type GraphData,
  type TreeNode,
} from "../src/graph.ts";

const count = (s: string, tag: string): number => s.split(`<${tag}`).length - 1;
const viewBox = (s: string): string => s.match(/viewBox="([^"]+)"/)?.[1] ?? "";
const cxs = (s: string): string[] => [...s.matchAll(/cx="([\d.]+)"/g)].map((m) => m[1]);
const cys = (s: string): string[] => [...s.matchAll(/cy="([\d.]+)"/g)].map((m) => m[1]);

// ---------------------------------------------------------------------------
// TreePlot
// ---------------------------------------------------------------------------

const smallTree: TreeNode = {
  label: "root",
  children: [{ label: "a", children: [{ label: "a1" }, { label: "a2" }] }, { label: "b" }],
};

test("tree plot draws one circle per node and one line per edge", () => {
  const s = treePlotSvg(smallTree);
  expect(count(s, "circle")).toBe(5); // root, a, b, a1, a2
  expect(count(s, "line")).toBe(4); // root-a, root-b, a-a1, a-a2
});

test("tree plot layout: leaves at sequential x, parent x = mean of children", () => {
  const s = treePlotSvg(smallTree);
  expect(viewBox(s)).toBe("0 0 142 154"); // mL + 2*unitX + 2r + mR, mT + 2*unitY + 2r + mB
  // a1 (leaf 0, depth 2), a2 (leaf 1, depth 2), a (depth 1, x=0.5), b (leaf 2, depth 1), root (depth 0, x=1.25)
  expect(s).toContain('cx="25" cy="129"'); // a1
  expect(s).toContain('cx="71" cy="129"'); // a2
  expect(s).toContain('cx="48" cy="75"'); // a: mean(0,1)=0.5
  expect(s).toContain('cx="117" cy="75"'); // b
  expect(s).toContain('cx="82.5" cy="21"'); // root: mean(0.5,2)=1.25
});

test("tree plot labels every node", () => {
  const s = treePlotSvg(smallTree);
  for (const label of ["root", "a", "b", "a1", "a2"]) expect(s).toContain(`>${label}<`);
});

test("a single node draws one circle and no edges", () => {
  const s = treePlotSvg({ label: "solo" });
  expect(count(s, "circle")).toBe(1);
  expect(count(s, "line")).toBe(0);
  expect(viewBox(s)).toBe("0 0 50 46");
});

test("missing/invalid input yields an empty placeholder frame", () => {
  const s = treePlotSvg(undefined);
  expect(viewBox(s)).toBe("0 0 80 40");
  expect(count(s, "circle")).toBe(0);
});

test("tree plot is a pure function: same input twice -> identical string", () => {
  const a = treePlotSvg(JSON.parse(JSON.stringify(smallTree)));
  const b = treePlotSvg(JSON.parse(JSON.stringify(smallTree)));
  expect(a).toBe(b);
});

// ---------------------------------------------------------------------------
// GraphPlot
// ---------------------------------------------------------------------------

const square: GraphData = {
  edges: [
    ["a", "b"],
    ["b", "c"],
    ["c", "d"],
    ["d", "a"],
  ],
};

test("graph plot draws one circle per node and one line per edge", () => {
  const s = graphPlotSvg(square);
  expect(count(s, "circle")).toBe(4);
  expect(count(s, "line")).toBe(4);
});

test("graph plot nodes sit on a deterministic circle, node 0 at the top", () => {
  const s = graphPlotSvg(square);
  // n=4, R=52 (max(50, 4*13)), so cardinal angles land on exact integers.
  const xs = cxs(s);
  const ys = cys(s);
  expect(xs[0]).toBe("78"); // a: top of circle (angle -90deg)
  expect(ys[0]).toBe("38");
  expect(xs[1]).toBe("130"); // b: right (angle 0deg)
  expect(ys[1]).toBe("90");
});

test("nodes are inferred from edges when `nodes` is omitted", () => {
  const s = graphPlotSvg({ edges: [["x", "y"]] });
  expect(count(s, "circle")).toBe(2);
  expect(s).toContain(">x<");
  expect(s).toContain(">y<");
});

test("a disconnected node (in `nodes` but no edges) still renders", () => {
  const s = graphPlotSvg({ nodes: ["a", "b", "isolated"], edges: [["a", "b"]] });
  expect(count(s, "circle")).toBe(3);
  expect(s).toContain(">isolated<");
});

test("directed graphs draw an arrowhead marker on edges", () => {
  const undirected = graphPlotSvg(square);
  const directed = graphPlotSvg(square, { directed: true });
  expect(undirected).not.toContain("marker-end");
  expect(directed).toContain("marker-end");
  expect(directed).toContain("<marker");
});

test("a single node with no edges renders without throwing", () => {
  const s = graphPlotSvg({ nodes: ["only"], edges: [] });
  expect(count(s, "circle")).toBe(1);
  expect(count(s, "line")).toBe(0);
});

test("empty graph data yields an empty placeholder frame", () => {
  const s = graphPlotSvg({ edges: [] });
  expect(viewBox(s)).toBe("0 0 80 40");
});

test("graph plot is a pure function: same input twice -> identical string", () => {
  const a = graphPlotSvg(JSON.parse(JSON.stringify(square)));
  const b = graphPlotSvg(JSON.parse(JSON.stringify(square)));
  expect(a).toBe(b);
});

// ---------------------------------------------------------------------------
// LayeredGraphPlot
// ---------------------------------------------------------------------------

const dag: GraphData = {
  edges: [
    ["a", "b"],
    ["a", "c"],
    ["b", "d"],
    ["c", "d"],
  ],
};

test("layered graph plot assigns longest-path layers", () => {
  const s = layeredGraphPlotSvg(dag);
  // a: layer 0, b/c: layer 1 (side by side), d: layer 2 -- exact node centers.
  expect(viewBox(s)).toBe("0 0 140 176");
  expect(s).toContain('cx="70" cy="22"'); // a
  expect(s).toContain('cx="35" cy="86"'); // b
  expect(s).toContain('cx="105" cy="86"'); // c
  expect(s).toContain('cx="70" cy="150"'); // d
});

test("layered graph plot always draws arrowheads (a DAG is directed)", () => {
  const s = layeredGraphPlotSvg(dag);
  expect(s).toContain("marker-end");
  expect(count(s, "line")).toBe(4);
});

test("a cyclic input still renders without hanging", () => {
  const s = layeredGraphPlotSvg({
    edges: [
      ["a", "b"],
      ["b", "c"],
      ["c", "a"],
    ],
  });
  expect(count(s, "circle")).toBe(3);
});

test("empty layered graph data yields an empty placeholder frame", () => {
  expect(viewBox(layeredGraphPlotSvg({ edges: [] }))).toBe("0 0 80 40");
});

test("layered graph plot is a pure function: same input twice -> identical string", () => {
  const a = layeredGraphPlotSvg(JSON.parse(JSON.stringify(dag)));
  const b = layeredGraphPlotSvg(JSON.parse(JSON.stringify(dag)));
  expect(a).toBe(b);
});

// ---------------------------------------------------------------------------
// Dendrogram
// ---------------------------------------------------------------------------

const merges: TreeNode = {
  height: 3,
  children: [{ height: 1, children: [{ label: "x" }, { label: "y" }] }, { label: "z" }],
};

test("dendrogram draws one circle per leaf and brackets at each merge height", () => {
  const s = dendrogramSvg(merges);
  expect(count(s, "circle")).toBe(3); // x, y, z
  expect(count(s, "line")).toBe(6); // 2 merges * (2 verticals + 1 horizontal)
});

test("dendrogram layout: leaves along x, merges at their declared height", () => {
  const s = dendrogramSvg(merges);
  expect(viewBox(s)).toBe("0 0 112 180"); // mL + 2*unitX + mR, mT + plotH + mB
  expect(s).toContain('cx="16" cy="162"'); // x (leaf 0, height 0 -> bottom)
  expect(s).toContain('cx="56" cy="162"'); // y (leaf 1)
  expect(s).toContain('cx="96" cy="162"'); // z (leaf 2)
  // z's vertical drop spans the full range: from the leaf baseline (162) up to
  // the root merge height 3 (12).
  expect(s).toContain('x1="96" y1="162" x2="96" y2="12"');
});

test("a missing internal height is inferred as 1 + max(child height)", () => {
  const s = dendrogramSvg({
    children: [{ children: [{ label: "x" }, { label: "y" }] }, { label: "z" }],
  });
  // inner merge (x,y) has no children with height, so it infers height 1;
  // the root then infers 1 + 1 = 2.
  expect(count(s, "circle")).toBe(3);
  expect(count(s, "line")).toBe(6);
});

test("a single node (no merges) draws one leaf, no brackets", () => {
  const s = dendrogramSvg({ label: "solo" });
  expect(count(s, "circle")).toBe(1);
  expect(count(s, "line")).toBe(0);
});

test("missing/invalid input yields an empty placeholder frame", () => {
  expect(viewBox(dendrogramSvg(undefined))).toBe("0 0 80 40");
});

test("dendrogram is a pure function: same input twice -> identical string", () => {
  const a = dendrogramSvg(JSON.parse(JSON.stringify(merges)));
  const b = dendrogramSvg(JSON.parse(JSON.stringify(merges)));
  expect(a).toBe(b);
});

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

test("a title renders centred above each frame", () => {
  expect(treePlotSvg(smallTree, { title: "Family" })).toContain(">Family<");
  expect(graphPlotSvg(square, { title: "Cycle" })).toContain(">Cycle<");
  expect(layeredGraphPlotSvg(dag, { title: "DAG" })).toContain(">DAG<");
  expect(dendrogramSvg(merges, { title: "Clusters" })).toContain(">Clusters<");
});
