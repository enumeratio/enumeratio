import { expect, test } from "vite-plus/test";
import {
  compositionSvg,
  dyckSvg,
  ferrersSvg,
  permutationSvg,
  renderGlyph,
  latticePathSvg,
  setPartitionSvg,
  subsetSvg,
  tableauSvg,
  treeLayout,
  treeSvg,
} from "../src/glyphs.ts";

const viewBox = (s: string): string => s.match(/viewBox="([^"]+)"/)?.[1] ?? "";
const count = (s: string, tag: string): number => s.split(`<${tag}`).length - 1;

test("permutation matrix: n×n grid, one dot per row at image[i]", () => {
  const s = permutationSvg([3, 1, 2]);
  expect(viewBox(s)).toBe("-1 -1 68 68"); // 3*22 + 2, square
  expect(count(s, "rect")).toBe(9); // n² grid cells
  expect(count(s, "circle")).toBe(3); // one dot per row
  // 132's dots track image[row]: (col-0.5, row+0.5)*22
  expect(s).toContain('cx="55" cy="11"'); // row 1 -> col 3
  expect(s).toContain('cx="11" cy="33"'); // row 2 -> col 1
  expect(s).toContain('cx="33" cy="55"'); // row 3 -> col 2
});

test("Ferrers diagram: one box per cell, rows = parts", () => {
  const s = ferrersSvg([3, 1]);
  expect(viewBox(s)).toBe("-1 -1 56 38"); // cols*18+2, rows*18+2
  expect(count(s, "rect")).toBe(4); // 3 + 1 boxes
});

test("composition bar: width tracks n, not part count", () => {
  const a = compositionSvg([3]); // one part
  const b = compositionSvg([1, 1, 1]); // three parts, same sum
  expect(viewBox(a)).toBe(viewBox(b)); // total width ∝ n
  expect(count(a, "rect")).toBe(1);
  expect(count(b, "rect")).toBe(3);
  expect(count(b, "text")).toBe(3); // each part labelled
});

test("subset cells: n cells, members filled", () => {
  const s = subsetSvg([1, 3], 4);
  expect(viewBox(s)).toBe("-1 -1 90 24"); // 4*22+2, 22+2
  expect(count(s, "rect")).toBe(4);
  expect(count(s, "text")).toBe(4); // every index labelled
});

test("subset n defaults to the largest member", () => {
  expect(viewBox(subsetSvg([2, 5]))).toBe(viewBox(subsetSvg([1, 2, 3, 4, 5])));
});

test("Dyck path: staircase polyline, height = peak", () => {
  const s = dyckSvg([1, 0, 1, 1, 0, 0]);
  expect(viewBox(s)).toBe("-1 -1 98 34"); // 6*16+2 wide, peak 2 -> 2*16+2 tall
  expect(count(s, "polyline")).toBe(1);
  const pts = s.match(/points="([^"]+)"/)?.[1] ?? "";
  expect(pts.split(" ").length).toBe(7); // n+1 vertices
  expect(pts.startsWith("0,32")).toBe(true); // baseline start (y flipped)
  expect(pts).toContain("64,0"); // the peak, at step 4
});

test("renderGlyph dispatches on kind", () => {
  expect(renderGlyph("permutation", [1, 2])).toBe(permutationSvg([1, 2]));
  expect(renderGlyph("subset", [1], { n: 3 })).toBe(subsetSvg([1], 3));
});

test("treeLayout decodes a preorder child-count word into parent/depth", () => {
  // Two 2-leaf cherries under a root: shape 1100100.
  const { parent, depth } = treeLayout([2, 2, 0, 0, 2, 0, 0]);
  expect(parent).toEqual([-1, 0, 1, 1, 0, 4, 4]);
  expect(depth).toEqual([0, 1, 2, 2, 1, 2, 2]);
});

test("tidy layout: leaves sequential, internal nodes at the mean of their children", () => {
  const { x } = treeLayout([2, 2, 0, 0, 2, 0, 0]);
  expect(x).toEqual([1.5, 0.5, 0, 1, 2.5, 2, 3]);
});

test("tree glyph: one circle per node, one line per edge, root centred", () => {
  const s = treeSvg([1, 0, 0], { binary: true }); // root + two leaves
  expect(count(s, "circle")).toBe(3);
  expect(count(s, "line")).toBe(2);
  expect(viewBox(s)).toBe("-1 -1 42 32"); // 2 leaves*20+2 wide, depth 1*20 + 2r + 2
  const cxs = [...s.matchAll(/cx="([\d.]+)"/g)].map((m) => m[1]);
  expect(cxs).toEqual(["20", "10", "30"]); // root at the midpoint of its leaves
});

test("a lone leaf is one node, no edges; a plane-tree word (non-binary) works too", () => {
  const leaf = treeSvg([0], { binary: true });
  expect(count(leaf, "circle")).toBe(1);
  expect(count(leaf, "line")).toBe(0);
  const star = treeSvg([3, 0, 0, 0]); // root with three children
  expect(count(star, "circle")).toBe(4);
  expect(count(star, "line")).toBe(3);
  expect(renderGlyph("binary-tree", [1, 0, 0])).toBe(treeSvg([1, 0, 0], { binary: true }));
});

test("Young tableau: Ferrers boxes numbered 1..n in reading order", () => {
  const s = tableauSvg([3, 2]); // shape (3,2), n = 5
  expect(viewBox(s)).toBe("-1 -1 62 42"); // 3*20+2 wide, 2*20+2 tall
  expect(count(s, "rect")).toBe(5); // one box per cell
  expect(count(s, "text")).toBe(5); // one entry per cell
  // Reading order: row 0 holds 1,2,3; row 1 holds 4,5. Entry 4 sits in row 1, col 0.
  expect(s).toContain(">1<");
  expect(s).toContain(">5<");
  // The last box (entry 5) is at row 1, col 1 -> x=20, y=20.
  expect(s).toContain('x="20" y="20"');
  expect(renderGlyph("tableau", [2, 1])).toBe(tableauSvg([2, 1]));
});

test("set partition: one pill per block, elements grouped by RGS", () => {
  const s = setPartitionSvg([0, 0, 1, 0, 2]); // {1,2,4} {3} {5}
  expect(count(s, "rect")).toBe(3); // three blocks
  expect(count(s, "text")).toBe(5); // every element labelled once
  // First pill holds elements 1,2,4 -> width 3*22, so viewBox is wider than tall.
  const vb = viewBox(s).split(" ").map(Number);
  expect(vb[2]).toBeGreaterThan(vb[3]);
  expect(renderGlyph("set-partition", [0, 1, 0])).toBe(setPartitionSvg([0, 1, 0]));
});

test("lattice path: grid sized to the step counts, one polyline", () => {
  const s = latticePathSvg([0, 1, 1, 0]); // 2 easts, 2 norths -> 2x2 grid
  expect(viewBox(s)).toBe("-1 -1 42 42"); // 2*20+2 square
  expect(count(s, "polyline")).toBe(1);
  const pts = s.match(/<polyline points="([^"]+)"/)?.[1] ?? "";
  expect(pts.split(" ").length).toBe(5); // n+1 vertices
  expect(pts.startsWith("0,40")).toBe(true); // starts bottom-left (y flipped)
  expect(pts.endsWith("40,0")).toBe(true); // ends top-right
  // 3 vertical + 3 horizontal grid lines for a 2x2 grid.
  expect(count(s, "line")).toBe(6);
});
