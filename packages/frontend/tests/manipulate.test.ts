import { expect, test } from "vite-plus/test";
import {
  clamp,
  defaultStep,
  advancePhase,
  formatValue,
  parseControls,
  parseNumeric,
  quantizeValue,
  stepValue,
} from "../src/manipulate.ts";

test("a bare slider tuple defaults its value to the min (Manipulate default)", () => {
  expect(parseControls("{a, 0, 5}")).toEqual([{ kind: "slider", name: "a", value: 0, min: 0, max: 5, step: 0.05 }]);
});

test("explicit initial value and step are honoured", () => {
  expect(parseControls("{{a, 2}, 0, 5, 0.5}")).toEqual([
    { kind: "slider", name: "a", value: 2, min: 0, max: 5, step: 0.5 },
  ]);
});

test("initial value is clamped into range", () => {
  expect(parseControls("{{a, 99}, 0, 5}")[0].value).toBe(5);
});

test("a brace list is a discrete choice setter, starting at the first choice", () => {
  expect(parseControls("{k, {2, 3, 5, 7}}")).toEqual([{ kind: "choice", name: "k", value: 2, choices: [2, 3, 5, 7] }]);
  // An explicit initial value that is one of the choices is honoured.
  expect(parseControls("{{k, 5}, {2, 3, 5, 7}}")[0].value).toBe(5);
});

test("several controls split on ';'", () => {
  const c = parseControls("{a, 0, 1}; {b, -2, 2, 0.25}; {k, {1, 2}}");
  expect(c.map((x) => x.name)).toEqual(["a", "b", "k"]);
  expect(c.map((x) => x.kind)).toEqual(["slider", "slider", "choice"]);
});

test("malformed controls are skipped, not thrown", () => {
  expect(parseControls("")).toEqual([]);
  expect(parseControls("{a}")).toEqual([]); // too few fields
  expect(parseControls("{a, x, y}")).toEqual([]); // non-numeric bounds
});

test("defaultStep lands on a round 1/2/5 value", () => {
  expect(defaultStep(0, 10)).toBe(0.1);
  expect(defaultStep(0, 1)).toBe(0.01);
  expect(defaultStep(0, 200)).toBe(2);
});

test("clamp is order-agnostic", () => {
  expect(clamp(7, 0, 5)).toBe(5);
  expect(clamp(-1, 5, 0)).toBe(0); // reversed bounds
  expect(clamp(3, 0, 5)).toBe(3);
});

test("stepValue advances a slider by its step and wraps at the max", () => {
  const c = parseControls("{{a, 0}, 0, 1, 0.25}")[0];
  expect(c.kind).toBe("slider");
  if (c.kind !== "slider") return;
  expect(stepValue({ ...c, value: 0 })).toBe(0.25);
  expect(stepValue({ ...c, value: 0.75 })).toBe(1);
  expect(stepValue({ ...c, value: 1 })).toBe(0); // wraps back to min
});

// --- playback advances continuously -------------------------------------------------

const slider = (over: Partial<{ value: number; min: number; max: number; step: number }> = {}) =>
  ({ kind: "slider", name: "a", value: 0, min: 0, max: 1, step: 0.05, ...over }) as const;

test("a continuous axis moves through the values between steps", () => {
  expect(advancePhase(0, slider(), 60, 120)).toBeCloseTo(0.025, 12); // half a step
  expect(advancePhase(0, slider(), 120, 120)).toBeCloseTo(0.05, 12);
});

test("one interval covers exactly one step, whatever the frame rate", () => {
  let p = 0;
  for (let i = 0; i < 8; i++) p = advancePhase(p, slider(), 15, 120); // 8 frames of 15 ms
  expect(p).toBeCloseTo(0.05, 12); // the same ground as one 120 ms tick
});

test("a discrete axis still advances at a high frame rate", () => {
  // The bug this guards: quantising the stored value each frame discards the fraction
  // of a step the frame contributed, and the axis sticks forever.
  const c = slider({ value: 3, min: 1, max: 24, step: 1 });
  let p = 3;
  for (let i = 0; i < 8; i++) p = advancePhase(p, { ...c, value: p }, 15, 120);
  expect(p).toBeCloseTo(4, 12);
  expect(quantizeValue(p, 1)).toBe(4);
});

test("quantising snaps a discrete axis and leaves a continuous one alone", () => {
  expect(quantizeValue(3.4, 1)).toBe(3);
  expect(quantizeValue(3.6, 1)).toBe(4);
  expect(quantizeValue(0.317, 0.05)).toBe(0.317); // continuous: between steps is the point
});

test("playback wraps back to the min past the top", () => {
  expect(advancePhase(1, slider(), 120, 120)).toBe(0);
  expect(advancePhase(24, slider({ min: 1, max: 24, step: 1 }), 120, 120)).toBe(1);
});

test("a degenerate range or a zero delta holds still", () => {
  expect(advancePhase(2, slider({ min: 2, max: 2, value: 2 }), 120, 120)).toBe(2);
  expect(advancePhase(0.5, slider(), 0, 120)).toBe(0.5);
});

// --- control separators -------------------------------------------------------------

test("controls separate on ';' (Wolfram's own spelling)", () => {
  const c = parseControls("{a, 0, 5}; {b, 1, 9, 2}");
  expect(c.map((x) => x.name)).toEqual(["a", "b"]);
  expect(c[1]).toEqual({ kind: "slider", name: "b", value: 1, min: 1, max: 9, step: 2 });
});

test("',' between tuples separates too, rather than parsing as one mangled control", () => {
  // This used to yield a single control with a NaN step (or none at all), silently.
  const c = parseControls("{m, 1, 12, 1}, {c, -4, 1, 0.1}");
  expect(c).toEqual([
    { kind: "slider", name: "m", value: 1, min: 1, max: 12, step: 1 },
    { kind: "slider", name: "c", value: -4, min: -4, max: 1, step: 0.1 },
  ]);
  expect(parseControls("{a, 0, 5}, {b, 0, 5}").map((x) => x.name)).toEqual(["a", "b"]);
});

test("a single control is untouched by the comma handling", () => {
  // Its own commas separate fields, not controls.
  expect(parseControls("{a, 0, 5, 0.5}")).toEqual([{ kind: "slider", name: "a", value: 0, min: 0, max: 5, step: 0.5 }]);
  expect(parseControls("{ {A, 1}, 0, 2}")).toEqual([
    { kind: "slider", name: "A", value: 1, min: 0, max: 2, step: 0.02 },
  ]);
  expect(parseControls("{k, {2, 3, 5, 7}}")).toEqual([{ kind: "choice", name: "k", value: 2, choices: [2, 3, 5, 7] }]);
});

test("mixed separators, and a choice setter alongside a slider", () => {
  const c = parseControls("{a, 0, 5}, {k, {1, 2, 4}}; {b, 0, 1, 0.25}");
  expect(c.map((x) => `${x.kind}:${x.name}`)).toEqual(["slider:a", "choice:k", "slider:b"]);
});

// --- numeric attributes written by Manipulate --------------------------------------

test("digit separators survive the round trip through a substituted attribute", () => {
  // Epsil serializes this way; Number() alone returns NaN and the reader would
  // silently fall back instead of following the slider.
  expect(parseNumeric("-2.119_744")).toBeCloseTo(-2.119744, 12);
  expect(parseNumeric("1_000")).toBe(1000);
  expect(parseNumeric(" 3.5 ")).toBe(3.5);
  expect(Number.isNaN(parseNumeric("nope"))).toBe(true);
});

// --- display precision ---------------------------------------------------------------

test("stepping stays on a clean grid rather than accumulating binary noise", () => {
  let c = { kind: "slider", name: "a", value: 0, min: 0, max: 2, step: 0.05 } as const;
  let v = 0;
  for (let i = 0; i < 34; i++) v = stepValue({ ...c, value: v });
  expect(v).toBe(1.7); // not 1.7000000000000002
});

test("a control value displays to the step's precision", () => {
  expect(formatValue(1.7, 0.05)).toBe("1.70");
  expect(formatValue(2.119744, 0.1)).toBe("2.1"); // mid-ease, between grid points
  expect(formatValue(6, 1)).toBe("6");
});

test("a trailing symbol in a control tuple names the control that draws it", () => {
  expect(parseControls("{k, 0, 1, 0.1, VerticalSlider}")).toEqual([
    { kind: "slider", name: "k", value: 0, min: 0, max: 1, step: 0.1, control: "VerticalSlider" },
  ]);
  expect(parseControls("{k, {1, 2, 3}, PopupMenu}")).toEqual([
    { kind: "choice", name: "k", value: 1, choices: [1, 2, 3], control: "PopupMenu" },
  ]);
  // An unknown trailing symbol is not a control type, and not a step either.
  expect(parseControls("{k, 0, 1, Whatever}")[0]).toMatchObject({ kind: "slider", step: 1 });
});
