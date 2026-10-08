import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, expect, test } from "vite-plus/test";
import {
  type Box,
  DEFAULT_STYLE,
  type DisplayList,
  grid,
  type GridRows,
  type Item,
  layout,
  makeBoxes,
  type Metrics,
  pane,
  panel,
  rowsOf,
  tag,
  text,
} from "../src/index.ts";

// Not a head's value, so a golden of the display lists. Regenerate with `UPDATE_LAYOUT=1 vp test`.
const GOLDEN = fileURLToPath(new URL("./layout.golden.json", import.meta.url));
const updating = process.env.UPDATE_LAYOUT === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

// A terminal: one cell per character, a line a cell high, a leaf three by two.
const CELLS: Metrics = {
  measure: (s) => ({ advance: Array.from(s).length, ascent: 1, descent: 0 }),
  leaf: () => ({ width: 3, height: 2 }),
  em: 1,
  cell: true,
};

// A page: ten pixels a character, an em of sixteen, a leaf forty by twenty.
const PIXELS: Metrics = {
  measure: (s, font) => ({ advance: Array.from(s).length * 10, ascent: font.size * 0.8, descent: font.size * 0.2 }),
  leaf: () => ({ width: 40, height: 20, baseline: 15 }),
  em: 16,
};

const boxes = (json: unknown): Box => makeBoxes(json as never);
const row = (...xs: unknown[]) => ["List", ...xs];
const str = (s: string) => `'${s}'`;

const CASES: Record<string, unknown> = {
  row: ["Row", row("x", str("and"), 12)],
  column: ["Column", row("a", "bcd")],
  grid: ["Grid", row(row(1, 2), row(30, 4))],
  ruled: ["Grid", row(row(1, 2), row(30, 4)), ["KeyValuePair", "Frame", "True"], ["KeyValuePair", "Dividers", "All"]],
  aligned: ["Grid", row(row(1, 22), row(333, 4)), ["KeyValuePair", "Alignment", "Right"]],
  after: ["Labeled", "x", str("one"), "Right"],
  above: ["Labeled", "x", str("one"), "Top"],
  panel: ["Panel", ["Row", row("x", "y")]],
  fraction: ["Row", row(["Rational", 1, 2], "x")],
};

for (const [name, json] of Object.entries(CASES)) {
  test(`${name} on cells`, () => {
    const list = layout(boxes(json), DEFAULT_STYLE, CELLS);
    fresh[`cells ${name}`] = list;
    if (!updating) expect(list).toEqual(golden[`cells ${name}`]);
  });
}

test("a row in pixels sits on one baseline", () => {
  const list = layout(boxes(CASES.row), DEFAULT_STYLE, PIXELS);
  fresh["pixels row"] = list;
  if (!updating) expect(list).toEqual(golden["pixels row"]);
  const ys = new Set(list.items.map((i) => (i.kind === "text" ? i.y : undefined)).filter((y) => y !== undefined));
  expect(ys.size).toBe(1);
});

test("math is a slot for the typesetter off cells, and drawn on them", () => {
  const fraction = boxes(["Divide", "a", "b"]);
  expect(layout(fraction, DEFAULT_STYLE, PIXELS).items.map((i) => i.kind)).toEqual(["slot"]);
  const cells = layout(fraction, DEFAULT_STYLE, CELLS);
  expect(cells.items.map((i) => i.kind)).toEqual(["text", "rule", "text"]);
  expect(cells.height).toBe(3);
  // The line the neighbors sit on is the bar.
  expect(cells.baseline).toBe(2);
});

test("a figure is a slot sized by the environment, whatever the layout around it", () => {
  const figure: Box = ["GraphicsBox", ["RowBox", []]];
  const labeled = tag(grid([[figure, text("σ")]]), "Labeled");
  const list = layout(labeled, DEFAULT_STYLE, CELLS);
  const slot = list.items.find((i): i is Extract<Item, { kind: "slot" }> => i.kind === "slot")!;
  expect([slot.x, slot.y, slot.width, slot.height]).toEqual([0, 0, 3, 2]);
  // The label sits beside it, centered on its height.
  const label = list.items.find((i) => i.kind === "text")!;
  expect(label).toMatchObject({ x: 4, y: 0, text: "σ" });
});

test("a span takes the room of the cells it covers", () => {
  const spanned = grid([
    [text("wide cell"), "SpanFromLeft"],
    [text("a"), text("b")],
  ]);
  const list = layout(spanned, DEFAULT_STYLE, CELLS);
  const wide = list.items.find((i) => i.kind === "text" && i.text === "wide cell")!;
  expect(wide).toMatchObject({ x: 0, y: 0 });
  // Both columns together hold the wide cell: the second column starts past a ruled gap.
  expect(list.width).toBeGreaterThanOrEqual(9);
});

test("a pane keeps its size and clips, or scales to fit", () => {
  const long = text("a long line of text");
  const clipped = layout(pane(long, { ImageSize: [8, 1] }), DEFAULT_STYLE, CELLS);
  expect([clipped.width, clipped.height]).toEqual([8, 1]);
  expect(clipped.items[0]).toMatchObject({ kind: "group", width: 8, height: 1 });
  const scaled = layout(pane(long, { ImageSize: [100, 10], ImageSizeAction: "ShrinkToFit" }), DEFAULT_STYLE, PIXELS);
  expect(scaled.items[0]).toMatchObject({ kind: "group", width: 100 });
  expect((scaled.items[0] as { scale?: number }).scale).toBeLessThan(1);
  const scroll = layout(pane(long, { ImageSize: 40, Scrollbars: true }), DEFAULT_STYLE, PIXELS);
  expect(scroll.items[0]).toMatchObject({ kind: "group", scroll: true });
});

test("a panel frames its content", () => {
  const list: DisplayList = layout(panel(text("x")), DEFAULT_STYLE, CELLS);
  // One cell of content, a cell of padding on each side, a cell of frame.
  expect([list.width, list.height]).toEqual([5, 3]);
  expect(list.items[0]).toMatchObject({ kind: "rect", stroke: true });
});

test("a grid's rows can come from a producer", () => {
  const made: number[] = [];
  const producer: GridRows = {
    length: 3,
    row: (i) => {
      made.push(i);
      return [text(String(i))];
    },
  };
  expect(rowsOf([[text("a")], [text("b")]]).length).toBe(2);
  const list = layout(grid(producer as never), DEFAULT_STYLE, CELLS);
  expect(list.height).toBe(3);
  expect(made).toContain(2);
});

test("the formatters lower to boxes, the head kept as a tag", () => {
  expect(boxes(CASES.row)).toEqual(["TagBox", ["RowBox", ["x", ["TextBox", "and"], "12"]], "Row"]);
  expect(boxes(["Row", row("a", "b"), str(", ")])).toEqual([
    "TagBox",
    ["RowBox", ["a", ["TextBox", ", "], "b"]],
    "Row",
  ]);
  expect(boxes(CASES.column)).toEqual(["TagBox", ["GridBox", [["a"], ["bcd"]]], "Column"]);
  expect(boxes(CASES.panel)).toEqual(["PanelBox", ["TagBox", ["RowBox", ["x", "y"]], "Row"]]);
  expect(boxes(["Labeled", "x", str("one"), "Top"])).toEqual([
    "TagBox",
    ["GridBox", [[["StyleBox", ["TextBox", "one"], { BaseStyle: "Label" }]], ["x"]]],
    "Labeled",
  ]);
  // A short row is padded, and a grid's options ride on its box.
  expect(boxes(["Grid", row(row(1, 2), row(3)), ["KeyValuePair", "Frame", "True"]])).toEqual([
    "TagBox",
    [
      "GridBox",
      [
        ["1", "2"],
        ["3", ["TextBox", ""]],
      ],
      { GridBoxFrame: true },
    ],
    "Grid",
  ]);
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
