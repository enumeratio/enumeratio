import { expect, test } from "vite-plus/test";
import {
  boundEntry,
  choiceBinding,
  parseChoices,
  complexLatex,
  cycleIndex,
  displayStep,
  gearing,
  holdMultiplier,
  isIntegerKnob,
  ladderGear,
  modifierGear,
  looksLikeMath,
  numberLatex,
  parseComplex,
  parseEntries,
  scrubIndex,
  scrubValue,
} from "../src/scrub.ts";

const RANGE = { min: -10, max: 10, step: 0.5 };

test("a drag right raises and a drag left lowers, one step per sensitivity", () => {
  expect(scrubValue(0, 8, RANGE, 8)).toBe(0.5);
  expect(scrubValue(0, 32, RANGE, 8)).toBe(2);
  expect(scrubValue(0, -32, RANGE, 8)).toBe(-2);
});

test("the value follows the pointer's position, so a reversed drag returns it", () => {
  const out = scrubValue(3, 40, RANGE, 8);
  expect(out).toBe(5.5);
  // The same gesture unwound lands back on the start, which a rate-based scrub cannot do.
  expect(scrubValue(3, 0, RANGE, 8)).toBe(3);
});

test("a drag is clamped to the range rather than running away", () => {
  expect(scrubValue(0, 10_000, RANGE, 8)).toBe(10);
  expect(scrubValue(0, -10_000, RANGE, 8)).toBe(-10);
});

test("stepped values stay clean rather than accumulating binary noise", () => {
  // 0.1 * 3 is 0.30000000000000004, and a scrubber shows every digit of it.
  expect(scrubValue(0, 8 * 3, { min: 0, max: 1, step: 0.1 }, 8)).toBe(0.3);
  expect(scrubValue(0, 8 * 7, { min: 0, max: 1, step: 0.1 }, 8)).toBe(0.7);
});

test("scrubbing a discrete list moves an index, clamped at both ends", () => {
  expect(scrubIndex(0, 16, 4, 8)).toBe(2);
  expect(scrubIndex(0, 999, 4, 8)).toBe(3);
  expect(scrubIndex(3, -999, 4, 8)).toBe(0);
  expect(scrubIndex(0, 10, 0, 8)).toBe(0); // an empty list has nowhere to go
});

test("a toggler wraps where a scrub clamps", () => {
  expect(cycleIndex(2, 1, 3)).toBe(0);
  expect(cycleIndex(0, -1, 3)).toBe(2);
  expect(cycleIndex(0, 1, 0)).toBe(0);
});

test("places come from the step, so the readout keeps a fixed width while dragging", () => {
  expect(numberLatex(3, 0.5)).toBe("3.0");
  expect(numberLatex(3, 1)).toBe("3");
  expect(numberLatex(-1.25, 0.01)).toBe("-1.25");
});

test("a complex knob always shows both parts, zero included", () => {
  expect(complexLatex(3, 2, 1)).toBe("3 + 2i");
  expect(complexLatex(3, -2, 1)).toBe("3 - 2i");
  expect(complexLatex(3, 0, 1)).toBe("3 + 0i");
});

test("an author's value is read as a real or complex number", () => {
  expect(parseComplex("3")).toEqual({ re: 3, im: 0 });
  expect(parseComplex("-1.5")).toEqual({ re: -1.5, im: 0 });
  expect(parseComplex("3+2i")).toEqual({ re: 3, im: 2 });
  expect(parseComplex("0.5 - 0.25i")).toEqual({ re: 0.5, im: -0.25 });
  expect(parseComplex("2i")).toEqual({ re: 0, im: 2 });
  expect(parseComplex("-i")).toEqual({ re: 0, im: -1 });
  expect(parseComplex("")).toBeUndefined();
  expect(parseComplex("banana")).toBeUndefined();
});

test("entries split on '|' so commas stay in the prose", () => {
  expect(parseEntries("a few|several, even many|  lots ")).toEqual([
    "a few",
    "several, even many",
    "lots",
  ]);
  expect(parseEntries("")).toEqual([]);
});

test("words are set as prose, values are typeset", () => {
  expect(looksLikeMath("a few")).toBe(false);
  expect(looksLikeMath("many")).toBe(false);
  expect(looksLikeMath("2")).toBe(true);
  expect(looksLikeMath("\\pi")).toBe(true);
  expect(looksLikeMath("Sin(x)")).toBe(true);
});

test("a value written without a point steps by whole numbers", () => {
  expect(isIntegerKnob("4", undefined)).toBe(true);
  expect(isIntegerKnob("0", undefined)).toBe(true);
  expect(isIntegerKnob("-3", undefined)).toBe(true);
  expect(isIntegerKnob("3+2i", undefined)).toBe(true);
  // A point is the author saying the quantity is measured, not counted.
  expect(isIntegerKnob("4.0", undefined)).toBe(false);
  expect(isIntegerKnob("0.5", undefined)).toBe(false);
});

test("an explicit step overrides how the value was written, in both directions", () => {
  expect(isIntegerKnob("4", 0.25)).toBe(false);
  expect(isIntegerKnob("4.0", 1)).toBe(true);
  expect(isIntegerKnob("4", 2)).toBe(true);
  // A nonsensical step is no step at all.
  expect(isIntegerKnob("4", 0)).toBe(true);
  expect(isIntegerKnob("4", Number.NaN)).toBe(true);
});

test("a discrete control binds its entry when the entry is a number, else its index", () => {
  expect(boundEntry("7", 3)).toBe(7);
  expect(boundEntry("-2.5", 1)).toBe(-2.5);
  expect(boundEntry("several", 1)).toBe(1);
  expect(boundEntry("", 2)).toBe(2);
  expect(boundEntry(undefined, 0)).toBe(0);
});

test("a gear scales the step tenfold either way", () => {
  expect(gearing(0.5, 8, "normal", false)).toEqual({ step: 0.5, pixelsPerStep: 8 });
  expect(gearing(0.5, 8, "coarse", false)).toEqual({ step: 5, pixelsPerStep: 8 });
  expect(gearing(0.5, 8, "fine", false)).toEqual({ step: 0.05, pixelsPerStep: 8 });
});

test("an integer knob's fine gear keeps whole numbers and asks ten times the travel", () => {
  expect(gearing(1, 8, "fine", true)).toEqual({ step: 1, pixelsPerStep: 80 });
  expect(gearing(1, 8, "coarse", true)).toEqual({ step: 10, pixelsPerStep: 8 });
  // A step of two in fine gear is still two, slowly; in coarse it is twenty.
  expect(gearing(2, 8, "fine", true)).toEqual({ step: 2, pixelsPerStep: 80 });
  expect(gearing(2, 8, "coarse", true)).toEqual({ step: 20, pixelsPerStep: 8 });
});

test("the ladder is climbed by leaving the axis: up is coarse, down is fine", () => {
  expect(ladderGear(0)).toBe("normal");
  expect(ladderGear(39)).toBe("normal");
  expect(ladderGear(40)).toBe("coarse");
  expect(ladderGear(-40)).toBe("fine");
});

test("Shift means coarse and Alt means fine, and Shift wins", () => {
  expect(modifierGear({ shiftKey: false, altKey: false })).toBeUndefined();
  expect(modifierGear({ shiftKey: true, altKey: false })).toBe("coarse");
  expect(modifierGear({ shiftKey: false, altKey: true })).toBe("fine");
  expect(modifierGear({ shiftKey: true, altKey: true })).toBe("coarse");
});

test("a held arrow ramps 1-2-5-10 and stops there", () => {
  expect(holdMultiplier(0)).toBe(1);
  expect(holdMultiplier(9)).toBe(1);
  expect(holdMultiplier(10)).toBe(2);
  expect(holdMultiplier(20)).toBe(5);
  expect(holdMultiplier(30)).toBe(10);
  expect(holdMultiplier(500)).toBe(10);
});

test("a value off the step's grid is printed to one more place, never rounded onto it", () => {
  expect(displayStep(3, 0.5)).toBe(0.5);
  expect(displayStep(3.05, 0.5)).toBe(0.05);
  expect(numberLatex(3.05, 0.5)).toBe("3.05");
  expect(numberLatex(3.5, 0.5)).toBe("3.5");
  // Both parts of a complex value share the wider place count.
  expect(complexLatex(3.05, 1, 0.5)).toBe("3.05 + 1.00i");
});

test("a choice list may label its entries with an arrow, and binds by value", () => {
  expect(parseChoices("a|2 -> two| True -> yes ")).toEqual([
    { value: "a", label: "a" },
    { value: "2", label: "two" },
    { value: "True", label: "yes" },
  ]);
  const choices = parseChoices("a few|3|True|k -> the k one");
  expect(choiceBinding(choices[0], 0)).toBe(0); // a word: its index
  expect(choiceBinding(choices[1], 1)).toBe(3); // a number: itself
  expect(choiceBinding(choices[2], 2)).toBe("True"); // a truth value: the symbol
  expect(choiceBinding(choices[3], 3)).toBe("k"); // labelled: the value named
  expect(choiceBinding(undefined, 4)).toBe(4);
});
