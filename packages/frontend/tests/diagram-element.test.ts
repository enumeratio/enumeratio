// The route `<graphics-box>` takes for a diagram head: the story's expression becomes the element's
// `value` text (`renderingOf`), which the plot view parses back (`plotOfText`), lowers
// (`diagramBoxOf`) and draws (`renderDiagram`). A dictionary written `{"edges" -> …}` once came back
// from the parse as `Dictionary(KeyValuePair(…))` and from the printer with its lists as text, and
// the figure drew empty in the page while the CLI (which has the engine's own form) drew fine.

import { readStories } from "@enumeratio/entry/node";
import type { BoxNode } from "@enumeratio/boxes";
import { expect, test } from "vite-plus/test";
import { diagramBoxOf } from "../src/diagram-lowering.ts";
import { renderDiagram } from "../src/diagram.ts";
import { plotItems } from "../src/plot-box.ts";
import { plotOfText, renderingOf } from "../src/symbols.ts";

const stories = (name: string) => readStories(new URL("../../components/reference/", import.meta.url), name);

/** What the plot view makes of a story: the settings and the box its `value` text lowers to. */
function elementRoute(expr: unknown): { settings: Record<string, string>; box: BoxNode } {
  const value = renderingOf(expr as never)?.attributes["value"];
  if (value === undefined) throw new Error("the story is not a plot element");
  const plot = plotOfText(value);
  if (plot === undefined) throw new Error(`no plot settings for ${value}`);
  return { settings: plot.settings, box: diagramBoxOf(plot.settings) as BoxNode };
}

const primsOf = (box: BoxNode): string[] => plotItems(box).map((i) => i.prim[0] as string);

for (const story of stories("GraphPlot")) {
  test(`GraphPlot story ${story.id} draws nodes and edges in the element`, () => {
    const { settings, box } = elementRoute(story.expr);
    // `data` is the structure as JSON, not the text it was written in.
    expect(typeof JSON.parse(settings["data"]!)).toBe("object");
    const heads = primsOf(box);
    if (settings["layout"] !== "dendrogram") expect(heads).toContain("DiskBox");
    expect(heads.some((h) => h === "LineBox" || h === "ArrowBox")).toBe(true);
    // The SVG carries a path per mark and a text per label: not the empty 80x40 box.
    const svg = renderDiagram(box);
    expect(svg.match(/<path/g)!.length).toBeGreaterThanOrEqual(heads.length);
    expect(svg).toContain("<text");
  });
}

test("a dictionary typed as the CLI takes it draws the same graph in the element", () => {
  const plot = plotOfText('GraphPlot({"edges" -> [["a", "b"], ["b", "c"], ["c", "a"]]}, Directed -> True)')!;
  const box = diagramBoxOf(plot.settings) as BoxNode;
  expect(primsOf(box).filter((h) => h === "DiskBox")).toHaveLength(3);
  expect(primsOf(box).filter((h) => h === "ArrowBox")).toHaveLength(3);
});

for (const story of stories("TorusSquare")) {
  test(`TorusSquare story ${story.id} draws in the element`, () => {
    expect(primsOf(elementRoute(story.expr).box).length).toBeGreaterThan(0);
  });
}
