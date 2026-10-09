// A bar is boxed as a row of single-entry boxes; the web draws the row as the one bar element it
// always was, and `reduce` declares one control for it.

import { makeBoxes } from "@enumeratio/boxes";
import { parseExpression } from "@enumeratio/formats/expression";
import { expect, test } from "vite-plus/test";
import { renderBox } from "../src/box-render.ts";
import { boxControls } from "../src/control-box.ts";
import { boxDeclarations } from "../src/reduce.ts";
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
  expect(renderBox(["SetterBox", ["DynamicBox", "k"], ["List", 3]]).tag).toBe("setter-box");
  expect(renderBox(["RadioButtonBox", ["DynamicBox", "k"], ["List", 3]]).tag).toBe("radio-button-box");
  expect(renderBox(["SetterBox", ["DynamicBox", ["MemberQ", "s", 3]], ["List", 3]])).toMatchObject({
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
