// A bar is boxed as a row of single-entry boxes; the web draws the row as the one bar element it
// always was, and `reduce` declares one control for it.

import { makeBoxes } from "@enumeratio/boxes";
import { parseExpression } from "@enumeratio/formats/expression";
import { expect, test } from "vite-plus/test";
import { renderBox } from "../src/box-render.ts";
import { boxControls } from "../src/control-box.ts";
import { boxDeclarations, pin } from "../src/reduce.ts";
import { tupleOf } from "../src/mathjson.ts";

const json = (src: string) => parseExpression(src).json as never;
const boxes = (src: string) => makeBoxes(json(src));

test("a bar row is drawn as the one bar element, with the attributes the bar had", () => {
  const drawn = (src: string) => {
    const { tag, attributes } = renderBox(boxes(src));
    return { tag, attributes };
  };
  expect(drawn("SetterBar((k, 2), [2, 3, 5])")).toEqual({
    tag: "setter-bar-box",
    attributes: { name: "k", value: "2", values: "2|3|5" },
  });
  expect(drawn('RadioButtonBar((q, 2), [Labeled(1, "one"), Labeled(2, "two")])')).toEqual({
    tag: "radio-button-bar-box",
    attributes: { name: "q", value: "2", values: "1 -> one|2 -> two" },
  });
  expect(drawn("TogglerBar((s, [1, 3]), [1, 2, 3])")).toEqual({
    tag: "toggler-bar-box",
    attributes: { name: "s", value: "1|3", values: "1|2|3" },
  });
});

test("a lone single-entry box is its own element, and a lone toggle a toggler bar of one", () => {
  expect(renderBox(["SetterBox", ["Dynamic", "k"], ["List", 3], "3"]).tag).toBe("setter-box");
  expect(renderBox(["RadioButtonBox", ["Dynamic", "k"], ["List", 3]]).tag).toBe("radio-button-box");
  expect(renderBox(["SetterBox", ["Dynamic", ["MemberQ", "s", 3]], ["List", "True"], "3"])).toMatchObject({
    tag: "toggler-bar-box",
    attributes: { name: "s", values: "3" },
  });
});

test("each variable has one control: the boxes of a bar group back by their binding", () => {
  const controls = boxControls(
    boxes("Column([SetterBar(k, [2, 3, 5]), TogglerBar((s, [2]), [2, 3]), Slider(h, (0, 1))])"),
  );
  expect(controls.map((c) => [c.name, c.bar, c.head])).toEqual([
    ["k", "SetterBar", "SetterBox"],
    ["s", "TogglerBar", "SetterBox"],
    ["h", undefined, "SliderBox"],
  ]);
  // All three entries, in one list.
  expect(tupleOf(controls[0]!.domain)).toHaveLength(3);
});

test("reduce declares a bar as the head it was written with", () => {
  const declared = boxDeclarations(
    json('Column([SetterBar(k, [2, 3]), RadioButtonBar(q, ["a", "b"]), TogglerBar(s, [1, 2])])'),
  );
  expect(declared.map((d) => [d.name, d.head, d.kind])).toEqual([
    ["k", "SetterBar", "listed"],
    ["q", "RadioButtonBar", "listed"],
    ["s", "TogglerBar", "listed"],
  ]);
});

test("a toggler's and a menu's drawn choices read back through boxControls", () => {
  const [toggler] = boxControls(boxes('Toggler((n, 6), [Labeled(4, "square"), Labeled(6, "hexagon")])'));
  expect(toggler).toMatchObject({ head: "TogglerBox", name: "n", intent: "toggle" });
  const labeled = (toggler!.domain as unknown as unknown[]).slice(1) as unknown[][];
  expect(labeled.map((entry) => entry[0])).toEqual(["Labeled", "Labeled"]);
  expect(labeled.map((entry) => entry[2])).toEqual([{ str: "square" }, { str: "hexagon" }]);
  const [menu] = boxControls(boxes('PopupMenu(c, ["a", "b"])'));
  expect(menu).toMatchObject({ head: "PopupMenuBox", name: "c", intent: "choice" });
  expect(JSON.stringify(menu!.domain)).toContain('"List"');
  const drawn = renderBox(boxes('PopupMenu((n, 6), [Labeled(4, "square"), Labeled(6, "hexagon")])'));
  expect(drawn.attributes).toMatchObject({ name: "n", values: "4 -> square|6 -> hexagon" });
});

test("a control inside a tooltip, a pane selector or running text is declared too", () => {
  const nested = boxControls([
    "RowBox",
    [
      ["TooltipBox", ["SliderBox", ["Dynamic", "a"], ["Tuple", 0, 5]], "tip"],
      ["PaneSelectorBox", [["x", ["SliderBox", ["Dynamic", "b"], ["Tuple", 0, 5]]]], ["DynamicBox", "s"]],
      ["TextCell", ["TextData", ["see ", ["SliderBox", ["Dynamic", "c"], ["Tuple", 0, 5]]]], "Text"],
    ],
  ] as never);
  expect(nested.map((c) => c.name)).toEqual(["a", "b", "c"]);
});

test("reduce sees a control nested in a tooltip or pane selector", () => {
  const expr = json('Column([Tooltip(Slider(a, (0, 5)), "tip"), PaneSelector([1 -> Slider(b, (0, 5))], Dynamic(a))])');
  expect(boxDeclarations(expr).map((d) => d.name)).toEqual(["a", "b"]);
  // The terminal driver pins them out of the expression it shows.
  const pinned = pin(expr, new Map([["a", 2 as never]]));
  expect(JSON.stringify(pinned)).not.toContain("Slider(a");
  expect(JSON.stringify(pinned)).not.toContain('"Slider",');
});
