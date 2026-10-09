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
        ["SliderBox", ["DynamicBox", "k"], ["Tuple", 0, 5]],
        ["DynamicBox", ["Power", "k", 2]],
      ],
    ],
    "Row",
  ]);
  expect(isBox(box)).toBe(true);
});

test("a control keeps its start, its entries and its options", () => {
  const entries = ["List", { str: "a" }, { str: "b" }];
  const picked = makeBoxes(json(["PopupMenu", ["Tuple", "c", { str: "b" }], entries]));
  expect(picked).toEqual(["PopupMenuBox", ["DynamicBox", ["Tuple", "c", { str: "b" }]], entries]);
  // A pair of strings is the entries, not an option named "Apple".
  const pair = ["Tuple", { str: "Apple" }, { str: "Pear" }];
  expect(makeBoxes(json(["PopupMenu", "c", pair]))).toEqual(["PopupMenuBox", ["DynamicBox", "c"], pair]);
  const vertical = makeBoxes(json(["VerticalSlider", "h", ["Tuple", 0, 1], ["KeyValuePair", "Readout", "True"]]));
  expect(vertical).toEqual([
    "SliderBox",
    ["DynamicBox", "h"],
    ["Tuple", 0, 1],
    { Appearance: "Vertical", Readout: true },
  ]);
});

test("a control's operands read back from its box", () => {
  const box = makeBoxes(json(["Slider2D", "p", ["Tuple", ["Tuple", 0, 0], ["Tuple", 1, 1]], ["Tuple", 0.1, 0.1]]));
  if (typeof box === "string" || box[0] !== "Slider2DBox") throw new Error("not a Slider2DBox");
  expect(controlOperands(box[1], box[2])).toEqual([
    "p",
    ["Tuple", ["Tuple", 0, 0], ["Tuple", 1, 1]],
    ["Tuple", 0.1, 0.1],
  ]);
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
  expect(makeBoxes(json(["ColorSlider", "c"]))).toEqual(["ColorSetterBox", ["DynamicBox", "c"], "SwatchSpectrum"]);
});

test("every control box has an intent, and boxes round-trip through MathJSON", () => {
  expect(Object.keys(CONTROL_INTENT).toSorted()).toEqual([...CONTROL_BOX_HEADS].toSorted());
  const box = makeBoxes(json(["Checkbox", "on"]));
  expect(fromMathJson(toMathJson(box))).toEqual(box);
  expect(toText(box)).toBe("-Checkbox-");
});
