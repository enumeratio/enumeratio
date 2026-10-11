import { expect, test } from "vite-plus/test";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import {
  CONTROL_BOX_HEADS,
  CONTROL_INTENT,
  controlOperands,
  fromMathJson,
  isBox,
  makeBoxes,
  toMathJson,
} from "../src/index.ts";
import { toText } from "../src/render/index.ts";

const json = (x: unknown) => x as MathJsonExpression;

test("a Row of a Slider and a Dynamic is boxes end to end", () => {
  const box = makeBoxes(json(["Row", ["List", ["Slider", "k", ["Tuple", 0, 5]], ["Dynamic", ["Power", "k", 2]]]]));
  expect(box).toEqual([
    "TagBox",
    [
      "RowBox",
      [
        ["SliderBox", ["Dynamic", "k"], ["Tuple", 0, 5]],
        ["DynamicBox", ["Power", "k", 2]],
      ],
    ],
    "Row",
  ]);
  expect(isBox(box)).toBe(true);
});

test("a control keeps its start, its entries and its options", () => {
  const entries = ["List", { str: "a" }, { str: "b" }];
  const rules = ["List", ["KeyValuePair", { str: "a" }, { str: "a" }], ["KeyValuePair", { str: "b" }, { str: "b" }]];
  const picked = makeBoxes(json(["PopupMenu", ["Tuple", "c", { str: "b" }], entries]));
  expect(picked).toEqual(["PopupMenuBox", ["Dynamic", ["Tuple", "c", { str: "b" }]], rules]);
  // A pair of strings is the entries, not an option named "Apple".
  const pair = ["Tuple", { str: "Apple" }, { str: "Pear" }];
  const pairRules = [
    "List",
    ["KeyValuePair", { str: "Apple" }, { str: "Apple" }],
    ["KeyValuePair", { str: "Pear" }, { str: "Pear" }],
  ];
  expect(makeBoxes(json(["PopupMenu", "c", pair]))).toEqual(["PopupMenuBox", ["Dynamic", "c"], pairRules]);
  // A label differing from its value rides in the rule and reads back as `Labeled`.
  const labeled = makeBoxes(json(["PopupMenu", "c", ["List", ["Labeled", 1, { str: "one" }], 2]]));
  expect(labeled).toEqual([
    "PopupMenuBox",
    ["Dynamic", "c"],
    ["List", ["KeyValuePair", 1, { str: "one" }], ["KeyValuePair", 2, { str: "2" }]],
  ]);
  expect(controlOperands(labeled)).toEqual(["c", ["List", ["Labeled", 1, { str: "one" }], 2]]);
  const vertical = makeBoxes(json(["VerticalSlider", "h", ["Tuple", 0, 1], ["KeyValuePair", "Readout", "True"]]));
  expect(vertical).toEqual(["SliderBox", ["Dynamic", "h"], ["Tuple", 0, 1], { Appearance: "Vertical", Readout: true }]);
});

test("a control's operands read back from its box", () => {
  const box = makeBoxes(json(["Slider2D", "p", ["Tuple", ["Tuple", 0, 0], ["Tuple", 1, 1]], ["Tuple", 0.1, 0.1]]));
  if (typeof box === "string" || box[0] !== "Slider2DBox") throw new Error("not a Slider2DBox");
  expect(controlOperands(box)).toEqual(["p", ["Tuple", ["Tuple", 0, 0], ["Tuple", 1, 1]], ["Tuple", 0.1, 0.1]]);
});

test("the remaining controls lower to their boxes", () => {
  const lowered = (head: string, ...args: unknown[]) => (makeBoxes(json([head, ...args])) as readonly unknown[])[0];
  expect(lowered("Knob", "k", ["Tuple", 0, 1])).toBe("KnobBox");
  expect(lowered("IntervalSlider", "r", ["Tuple", 0, 5])).toBe("IntervalSliderBox");
  expect(lowered("ListPicker", "c", ["List", "a", "b"])).toBe("ListPickerBox");
  // The bars are rows of single-entry boxes (bars.test.ts).
  expect(lowered("RadioButtonBar", "c", ["List", "a", "b"])).toBe("GridBox");
  expect(lowered("TogglerBar", "s", ["List", "a", "b"])).toBe("GridBox");
  expect(lowered("SetterBar", "c", ["List", "a", "b"])).toBe("GridBox");
  expect(lowered("Locator", ["Tuple", "p", ["Tuple", 1, 1]])).toBe("LocatorBox");
  // Wolfram boxes a ColorSlider as a ColorSetterBox showing the spectrum.
  expect(makeBoxes(json(["ColorSlider", "c"]))).toEqual(["ColorSetterBox", ["Dynamic", "c"], "SwatchSpectrum"]);
});

test("a toggler lists value -> label rules and shows its variable", () => {
  const toggler = makeBoxes(json(["Toggler", "s", ["List", "off", "on"]]));
  expect(toggler).toEqual([
    "TogglerBox",
    ["Dynamic", "s"],
    ["List", ["KeyValuePair", "off", { str: "off" }], ["KeyValuePair", "on", { str: "on" }]],
    ["DynamicBox", ["ToBoxes", "s", "StandardForm"]],
  ]);
  expect(isBox(toggler)).toBe(true);
  expect(fromMathJson(toMathJson(toggler))).toEqual(toggler);
  expect(controlOperands(toggler)).toEqual(["s", ["List", "off", "on"]]);
});

test("every control box has an intent, and boxes round-trip through MathJSON", () => {
  expect(Object.keys(CONTROL_INTENT).toSorted()).toEqual([...CONTROL_BOX_HEADS].toSorted());
  const box = makeBoxes(json(["Checkbox", "on"]));
  expect(fromMathJson(toMathJson(box))).toEqual(box);
  expect(toText(box)).toBe("-Checkbox-");
});

test("a record written with a DynamicBox binding or without a shown box still reads (the binding stays as written)", () => {
  const legacy = fromMathJson(json(["SetterBox", ["DynamicBox", "c"], ["List", ["Labeled", 1, { str: "one" }]]]));
  expect(legacy).toEqual([
    "SetterBox",
    ["DynamicBox", "c"],
    ["List", 1],
    ["TextBox", "one", { ShowStringCharacters: true }],
  ]);
  expect(controlOperands(legacy)).toEqual(["c", ["List", ["Labeled", 1, { str: "one" }]]]);
  const toggler = fromMathJson(json(["TogglerBox", ["DynamicBox", ["Tuple", "s", "off"]], ["List", "off", "on"]]));
  expect(controlOperands(toggler)).toEqual([
    ["Tuple", "s", "off"],
    ["List", "off", "on"],
  ]);
  expect(() => fromMathJson(json(["SetterBox", ["Dynamic", "c"], "choices"]))).toThrow();
});

test("a binding that names no variable leaves no operands", () => {
  expect(controlOperands(["SliderBox", "k", ["Tuple", 0, 5]] as never)).toEqual([]);
});
