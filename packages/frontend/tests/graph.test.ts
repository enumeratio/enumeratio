import { type Box, type BoxNode, optionsOfBox } from "@enumeratio/boxes";
import { expect, test } from "vite-plus/test";
import { isDiagramBox, renderDiagram } from "../src/diagram.ts";
import {
  dendrogramBox,
  type GraphData,
  graphPlotBox,
  layeredGraphPlotBox,
  treePlotBox,
  type TreeNode,
} from "../src/graph.ts";
import { plotItems } from "../src/plot-box.ts";

// The boxes are y-up, as every Wolfram `Graphics`: a vertex at pixel row r of a frame H high is at H - r.
const prims = (box: Box, head: string): Record<string, unknown>[] =>
  plotItems(box as BoxNode)
    .filter((i) => i.prim[0] === head)
    .map((i) => optionsOfBox(i.prim));
const size = (box: Box): unknown => optionsOfBox(box as BoxNode).ImageSize;
const centers = (box: Box): unknown[] => prims(box, "DiskBox").map((o) => o.Center);
const labels = (box: Box): string[] =>
  plotItems(box as BoxNode)
    .filter((i) => i.prim[0] === "InsetBox")
    .map((i) => i.prim[1] as string);
const svgOf = (box: Box): string => renderDiagram(box as BoxNode);

test("each figure is a diagram GraphicsBox, and its SVG has a viewBox the size of its frame", () => {
  const box = treePlotBox({ label: "solo" });
  expect(isDiagramBox(box)).toBe(true);
  expect(svgOf(box)).toContain('viewBox="0 0 50 46"');
});

// ---------------------------------------------------------------------------
// TreePlot
// ---------------------------------------------------------------------------

const smallTree: TreeNode = {
  label: "root",
  children: [{ label: "a", children: [{ label: "a1" }, { label: "a2" }] }, { label: "b" }],
};

test("tree plot draws one disk per node and one line per edge", () => {
  const box = treePlotBox(smallTree);
  expect(prims(box, "DiskBox")).toHaveLength(5); // root, a, b, a1, a2
  expect(prims(box, "LineBox")).toHaveLength(4); // root-a, root-b, a-a1, a-a2
});

test("tree plot layout: leaves at sequential x, parent x = mean of children", () => {
  const box = treePlotBox(smallTree);
  // mL + 2*unitX + 2r + mR by mT + 2*unitY + 2r + mB
  expect(size(box)).toEqual([142, 154]);
  expect(centers(box)).toEqual(
    expect.arrayContaining([
      [25, 25], // a1 (leaf 0, depth 2)
      [71, 25], // a2 (leaf 1)
      [48, 79], // a: mean(0,1)=0.5
      [117, 79], // b
      [82.5, 133], // root: mean(0.5,2)=1.25
    ]),
  );
});

test("tree plot labels every node", () => {
  expect(labels(treePlotBox(smallTree)).toSorted()).toEqual(["a", "a1", "a2", "b", "root"]);
  expect(svgOf(treePlotBox(smallTree))).toContain(">root<");
});

test("a single node draws one disk and no edges", () => {
  const box = treePlotBox({ label: "solo" });
  expect(prims(box, "DiskBox")).toHaveLength(1);
  expect(prims(box, "LineBox")).toHaveLength(0);
  expect(size(box)).toEqual([50, 46]);
});

test("missing/invalid input yields an empty placeholder frame", () => {
  const box = treePlotBox(undefined);
  expect(size(box)).toEqual([80, 40]);
  expect(prims(box, "DiskBox")).toHaveLength(0);
});

test("tree plot is a pure function: same input twice -> identical box", () => {
  expect(treePlotBox(JSON.parse(JSON.stringify(smallTree)))).toEqual(
    treePlotBox(JSON.parse(JSON.stringify(smallTree))),
  );
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

test("graph plot draws one disk per node and one line per edge", () => {
  const box = graphPlotBox(square);
  expect(prims(box, "DiskBox")).toHaveLength(4);
  expect(prims(box, "LineBox")).toHaveLength(4);
});

test("graph plot nodes sit on a deterministic circle, node 0 at the top", () => {
  const box = graphPlotBox(square);
  // n=4, R=52 (max(50, 4*13)), so cardinal angles land on exact integers; the frame is 156 by 168.
  expect(size(box)).toEqual([156, 168]);
  const [a, b] = centers(box) as number[][];
  expect(a).toEqual([78, 130]); // a: top of circle (angle -90deg)
  expect(b).toEqual([130, 78]); // b: right (angle 0deg)
});

test("nodes are inferred from edges when `nodes` is omitted", () => {
  const box = graphPlotBox({ edges: [["x", "y"]] });
  expect(prims(box, "DiskBox")).toHaveLength(2);
  expect(labels(box)).toEqual(["x", "y"]);
});

test("a disconnected node (in `nodes` but no edges) still renders", () => {
  const box = graphPlotBox({ nodes: ["a", "b", "isolated"], edges: [["a", "b"]] });
  expect(prims(box, "DiskBox")).toHaveLength(3);
  expect(labels(box)).toContain("isolated");
});

test("directed graphs draw their edges as arrows", () => {
  expect(prims(graphPlotBox(square), "ArrowBox")).toHaveLength(0);
  const directed = graphPlotBox(square, { directed: true });
  expect(prims(directed, "ArrowBox")).toHaveLength(4);
  expect(prims(directed, "LineBox")).toHaveLength(0);
  // Each arrow's head is a filled triangle after its line.
  expect(svgOf(directed).match(/<path/g)!.length).toBeGreaterThan(svgOf(graphPlotBox(square)).match(/<path/g)!.length);
});

test("a self-loop is a ring beside its node, not a line", () => {
  const box = graphPlotBox({ edges: [["a", "a"]] });
  expect(prims(box, "DiskBox")).toHaveLength(2); // the node and its loop
  expect(prims(box, "LineBox")).toHaveLength(0);
});

test("a single node with no edges renders without throwing", () => {
  const box = graphPlotBox({ nodes: ["only"], edges: [] });
  expect(prims(box, "DiskBox")).toHaveLength(1);
  expect(prims(box, "LineBox")).toHaveLength(0);
});

test("empty graph data yields an empty placeholder frame", () => {
  expect(size(graphPlotBox({ edges: [] }))).toEqual([80, 40]);
});

test("graph plot is a pure function: same input twice -> identical box", () => {
  expect(graphPlotBox(JSON.parse(JSON.stringify(square)))).toEqual(graphPlotBox(JSON.parse(JSON.stringify(square))));
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
  const box = layeredGraphPlotBox(dag);
  // a: layer 0, b/c: layer 1 (side by side), d: layer 2 -- exact node centers.
  expect(size(box)).toEqual([140, 176]);
  expect(centers(box)).toEqual(
    expect.arrayContaining([
      [70, 154], // a
      [35, 90], // b
      [105, 90], // c
      [70, 26], // d
    ]),
  );
});

test("layered graph plot always draws arrows (a DAG is directed)", () => {
  expect(prims(layeredGraphPlotBox(dag), "ArrowBox")).toHaveLength(4);
});

test("a cyclic input still renders without hanging", () => {
  const box = layeredGraphPlotBox({
    edges: [
      ["a", "b"],
      ["b", "c"],
      ["c", "a"],
    ],
  });
  expect(prims(box, "DiskBox")).toHaveLength(3);
});

test("empty layered graph data yields an empty placeholder frame", () => {
  expect(size(layeredGraphPlotBox({ edges: [] }))).toEqual([80, 40]);
});

test("layered graph plot is a pure function: same input twice -> identical box", () => {
  expect(layeredGraphPlotBox(JSON.parse(JSON.stringify(dag)))).toEqual(
    layeredGraphPlotBox(JSON.parse(JSON.stringify(dag))),
  );
});

// ---------------------------------------------------------------------------
// Dendrogram
// ---------------------------------------------------------------------------

const merges: TreeNode = {
  height: 3,
  children: [{ height: 1, children: [{ label: "x" }, { label: "y" }] }, { label: "z" }],
};

test("dendrogram draws one disk per leaf and brackets at each merge height", () => {
  const box = dendrogramBox(merges);
  expect(prims(box, "DiskBox")).toHaveLength(3); // x, y, z
  expect(prims(box, "LineBox")).toHaveLength(6); // 2 merges * (2 verticals + 1 horizontal)
});

test("dendrogram layout: leaves along x, merges at their declared height", () => {
  const box = dendrogramBox(merges);
  expect(size(box)).toEqual([112, 180]); // mL + 2*unitX + mR by mT + plotH + mB
  expect(centers(box)).toEqual([
    [16, 18], // x (leaf 0, height 0 -> bottom)
    [56, 18], // y (leaf 1)
    [96, 18], // z (leaf 2)
  ]);
  // z's vertical drop spans the full range: from the leaf baseline up to the root merge height 3.
  expect(prims(box, "LineBox").map((o) => o.Points)).toContainEqual([
    [96, 18],
    [96, 168],
  ]);
});

test("a missing internal height is inferred as 1 + max(child height)", () => {
  const box = dendrogramBox({
    children: [{ children: [{ label: "x" }, { label: "y" }] }, { label: "z" }],
  });
  // inner merge (x,y) has no children with height, so it infers height 1;
  // the root then infers 1 + 1 = 2.
  expect(prims(box, "DiskBox")).toHaveLength(3);
  expect(prims(box, "LineBox")).toHaveLength(6);
});

test("a single node (no merges) draws one leaf, no brackets", () => {
  const box = dendrogramBox({ label: "solo" });
  expect(prims(box, "DiskBox")).toHaveLength(1);
  expect(prims(box, "LineBox")).toHaveLength(0);
});

test("missing/invalid input yields an empty placeholder frame", () => {
  expect(size(dendrogramBox(undefined))).toEqual([80, 40]);
});

test("dendrogram is a pure function: same input twice -> identical box", () => {
  expect(dendrogramBox(JSON.parse(JSON.stringify(merges)))).toEqual(dendrogramBox(JSON.parse(JSON.stringify(merges))));
});

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

test("a title is the box's PlotLabel, centred above each frame", () => {
  for (const [box, title] of [
    [treePlotBox(smallTree, { title: "Family" }), "Family"],
    [graphPlotBox(square, { title: "Cycle" }), "Cycle"],
    [layeredGraphPlotBox(dag, { title: "DAG" }), "DAG"],
    [dendrogramBox(merges, { title: "Clusters" }), "Clusters"],
  ] as const) {
    expect(optionsOfBox(box as BoxNode).PlotLabel).toBe(title);
    expect(svgOf(box)).toContain(`>${title}<`);
  }
});
