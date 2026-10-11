// The bars lower to Wolfram's single-entry boxes, and a row of them sharing a binding reads back as one control.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { expect, test } from "vite-plus/test";
import { type Box, barOf, isBox, isControlLeaf, makeBoxes } from "../src/index.ts";
import { toText } from "../src/render/index.ts";

const json = (x: unknown) => x as MathJsonExpression;
const entries = ["List", { str: "a" }, { str: "b" }];

test("a SetterBar is a GridBox row of single-entry SetterBoxes", () => {
  const setter = makeBoxes(json(["SetterBar", ["Tuple", "c", { str: "b" }], entries]));
  expect(setter).toEqual([
    "GridBox",
    [
      [
        [
          "SetterBox",
          ["Dynamic", ["Tuple", "c", { str: "b" }]],
          ["List", { str: "a" }],
          ["TextBox", "a", { ShowStringCharacters: true }],
        ],
        [
          "SetterBox",
          ["Dynamic", ["Tuple", "c", { str: "b" }]],
          ["List", { str: "b" }],
          ["TextBox", "b", { ShowStringCharacters: true }],
        ],
      ],
    ],
  ]);
  expect(isBox(setter)).toBe(true);
});

test("a TogglerBar is the same row over MemberQ, each entry toggling in and out of the list", () => {
  const toggler = makeBoxes(json(["TogglerBar", "s", ["List", 2, 3]]));
  expect(toggler).toEqual([
    "GridBox",
    [
      [
        ["SetterBox", ["Dynamic", ["MemberQ", "s", 2]], ["List", "True"], "2"],
        ["SetterBox", ["Dynamic", ["MemberQ", "s", 3]], ["List", "True"], "3"],
      ],
    ],
  ]);
  expect(isBox(toggler)).toBe(true);
});

test("a RadioButtonBar is a row of radio buttons, each beside its label", () => {
  const radio = makeBoxes(json(["RadioButtonBar", "q", ["List", ["Labeled", 1, { str: "one" }], 2]]));
  if (typeof radio === "string" || radio[0] !== "GridBox") throw new Error("not a GridBox");
  const [cells] = radio[1];
  expect(cells).toHaveLength(2);
  const heads = cells!.map((cell) =>
    typeof cell === "string" || cell[0] !== "RowBox" ? undefined : cell[1].map((b) => b[0]),
  );
  expect(heads).toEqual([
    ["RadioButtonBox", "TextBox"],
    ["RadioButtonBox", "2"],
  ]);
  expect(isBox(radio)).toBe(true);
  expect(barOf(radio)).toMatchObject({ kind: "RadioButtonBar", entries: [["Labeled", 1, { str: "one" }], 2] });
});

test("a row of single-entry boxes that share a binding reads back as one bar", () => {
  const read = (head: string, ...args: unknown[]) => barOf(makeBoxes(json([head, ...args])));
  expect(read("SetterBar", ["Tuple", "c", { str: "b" }], entries)).toEqual({
    kind: "SetterBar",
    head: "SetterBox",
    variable: ["Tuple", "c", { str: "b" }],
    entries: [{ str: "a" }, { str: "b" }],
    options: {},
  });
  expect(read("TogglerBar", ["Tuple", "s", ["List", 2]], ["List", 2, 3])).toMatchObject({
    kind: "TogglerBar",
    variable: ["Tuple", "s", ["List", 2]],
    entries: [2, 3],
  });
  expect(read("RadioButtonBar", "q", ["List", 1, 2])).toMatchObject({ kind: "RadioButtonBar", entries: [1, 2] });
});

test("boxes on different variables or kinds are not one bar; a lone toggle is a bar of one", () => {
  const cell = (name: string): Box => ["SetterBox", ["Dynamic", name], ["List", 1], "1"];
  expect(barOf(["GridBox", [[cell("a"), cell("b")]]])).toBeUndefined();
  expect(barOf(["GridBox", [[cell("a")], [cell("a")]]])).toBeUndefined();
  expect(barOf(cell("a"))).toBeUndefined();
  expect(barOf(["SetterBox", ["Dynamic", ["MemberQ", "a", 1]], ["List", "True"], "1"])).toMatchObject({
    kind: "TogglerBar",
    entries: [1],
  });
});

test("a bar is one leaf to the layout and one word to the text writers", () => {
  const bar = makeBoxes(json(["SetterBar", "c", entries]));
  expect(isControlLeaf(bar)).toBe(true);
  expect(toText(bar)).toBe("-SetterBar-");
  expect(toText(makeBoxes(json(["RadioButtonBar", "q", ["List", 1, 2]])))).toBe("-RadioButtonBar-");
  expect(toText(makeBoxes(json(["TogglerBar", "s", ["List", 1, 2]])))).toBe("-TogglerBar-");
});

test("entries that are not written out as a list are not split", () => {
  expect(makeBoxes(json(["SetterBar", "c", "choices"]))).toEqual([
    "SetterBox",
    ["Dynamic", "c"],
    ["List", "choices"],
    "choices",
  ]);
  expect((makeBoxes(json(["TogglerBar", "s", "choices"])) as readonly unknown[])[0]).not.toBe("GridBox");
});
