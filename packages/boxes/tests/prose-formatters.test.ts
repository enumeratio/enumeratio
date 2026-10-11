import { expect, test } from "vite-plus/test";
import { type Box, fromMathJson, isBox, makeBoxes, toMathJson } from "../src/index.ts";
import { toText } from "../src/render/index.ts";

const boxes = (json: unknown): Box => makeBoxes(json as never);
const str = (s: string) => `'${s}'`;
const list = (...xs: unknown[]) => ["List", ...xs];

test("a StringTemplate is TextData with a hole for each variable, readout, setter and island", () => {
  const template =
    'Base $\\beta = _b$, n = {_n | random}, {N(_n^2)} ({Setter(_k, True, "snap")}) {InputField(Variables)}';
  expect(boxes(["StringTemplate", str(template)])).toEqual([
    "TagBox",
    [
      "TextData",
      [
        "Base ",
        ["FormBox", ["RowBox", ["\\beta = ", ["TemplateSlot", "b"]]], "TeXForm"],
        ", n = ",
        ["TemplateSlot", "n", { random: "" }],
        ", ",
        ["TemplateExpression", "N(_n^2)"],
        " (",
        ["ButtonBox", ["TextBox", "snap"], { ButtonFunction: "Set(_k, True)" }],
        ") ",
        ["TemplateSlot", "Variables"],
      ],
    ],
    "StringTemplate",
  ]);
});

test("TeX without a variable is held as written, and a subscript is not a variable", () => {
  expect(boxes(["StringTemplate", str("$x_d$ and $\\mathbb{Z}/n$")])).toEqual([
    "TagBox",
    ["TextData", [["FormBox", "x_d", "TeXForm"], " and ", ["FormBox", "\\mathbb{Z}/n", "TeXForm"]]],
    "StringTemplate",
  ]);
});

test("a template reads as its words, holes as written", () => {
  expect(toText(boxes(["StringTemplate", str("d = {_d}, {2 _d}")]))).toBe("d = ${d}, ${2 _d}");
});

test("a Tooltip is a TooltipBox of the body and the tip", () => {
  expect(boxes(["Tooltip", "x", str("the unknown")])).toEqual(["TooltipBox", "x", ["TextBox", "the unknown"]]);
  expect(toText(boxes(["Tooltip", "x", str("the unknown")]))).toBe("x");
});

test("a PaneSelector is its panes keyed by value, over a DynamicBox of the selector", () => {
  const selected = boxes([
    "PaneSelector",
    list(["Rule", "True", str("big")], ["Rule", "False", str("small")]),
    ["Dynamic", [">", "n", 5]],
  ]);
  expect(selected).toEqual([
    "PaneSelectorBox",
    [
      ["True", ["TextBox", "big"]],
      ["False", ["TextBox", "small"]],
    ],
    ["DynamicBox", [">", "n", 5]],
  ]);
  // Static writers have no value to pick by: the first pane.
  expect(toText(selected)).toBe("big");
});

test("TooltipBox and PaneSelectorBox are boxes and round-trip through MathJSON", () => {
  for (const box of [
    ["TooltipBox", "x", "tip", { Placement: "Above" }],
    [
      "PaneSelectorBox",
      [
        ["1", "one"],
        ["2", ["TextBox", "two"]],
      ],
      ["DynamicBox", "n"],
    ],
  ] as Box[]) {
    expect(isBox(box)).toBe(true);
    expect(fromMathJson(toMathJson(box))).toEqual(box);
  }
  expect(isBox(["PaneSelectorBox", [["1"]], ["DynamicBox", "n"]])).toBe(false);
});
