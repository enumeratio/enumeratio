import { expect, test } from "vite-plus/test";
import { advancePlayback, iterate, rewindFor, sweepInterval } from "../src/playback.ts";

const SPAN = { min: 0, max: 3, step: 1 };

test("an implicit advance obeys the cycle at the ends", () => {
  expect(iterate(3, 1, SPAN, "cycle", 1)).toEqual({ value: 0, direction: 1, done: false });
  expect(iterate(3, 1, SPAN, "reflect", 1)).toEqual({ value: 2, direction: -1, done: false });
  expect(iterate(0, 1, SPAN, "reflect", -1)).toEqual({ value: 1, direction: 1, done: false });
  expect(iterate(3, 1, SPAN, "none", 1)).toEqual({ value: 3, direction: 1, done: true });
  expect(iterate(1, 1, SPAN, "none", 1)).toEqual({ value: 2, direction: 1, done: false });
});

test("an explicit step wraps only on loop, and clamps otherwise", () => {
  expect(iterate(3, 1, SPAN, "cycle")).toEqual({ value: 0, direction: 1, done: false });
  expect(iterate(0, -1, SPAN, "cycle")).toEqual({ value: 3, direction: 1, done: false });
  expect(iterate(3, 1, SPAN, "reflect")).toEqual({ value: 3, direction: 1, done: false });
  expect(iterate(3, 1, SPAN, "none")).toEqual({ value: 3, direction: 1, done: true });
  expect(iterate(2, 5, SPAN, "none")).toEqual({ value: 3, direction: 1, done: true });
});

test("several steps at once walk through a reflection rather than over it", () => {
  // From 2 forward by 3 on 0..3: 3, then turn, 2, 1.
  expect(iterate(2, 3, SPAN, "reflect", 1)).toEqual({ value: 1, direction: -1, done: false });
  expect(iterate(2, 3, SPAN, "cycle", 1)).toEqual({ value: 1, direction: 1, done: false });
});

test("a real span steps clean", () => {
  const span = { min: 0, max: 1, step: 0.1 };
  expect(iterate(0.2, 1, span, "cycle", 1).value).toBe(0.3);
  expect(iterate(1, 1, span, "cycle", 1).value).toBe(0);
  expect(iterate(1, 1, span, "reflect", 1).value).toBe(0.9);
});

test("a once-through that is already at its end rewinds before it plays", () => {
  expect(rewindFor(3, SPAN, "none", 1)).toBe(0);
  expect(rewindFor(1, SPAN, "none", 1)).toBe(1);
  expect(rewindFor(0, SPAN, "none", -1)).toBe(3);
  expect(rewindFor(3, SPAN, "cycle", 1)).toBe(3);
});

test("a sweep is paced to a few seconds, within reason", () => {
  expect(sweepInterval(4)).toBe(1000);
  expect(sweepInterval(40)).toBe(100);
  expect(sweepInterval(4000)).toBe(60);
});

test("a continuous playback carries its overshoot round, folds it back, or stops", () => {
  const span = { min: 0, max: 1, step: 0.1 };
  // Half a step per 60 ms at 120 ms a step.
  expect(advancePlayback(0.95, span, 120, 120, "cycle", 1)).toEqual({
    phase: expect.closeTo(0.05, 9),
    direction: 1,
    done: false,
  });
  expect(advancePlayback(0.95, span, 120, 120, "reflect", 1)).toEqual({
    phase: expect.closeTo(0.95, 9),
    direction: -1,
    done: false,
  });
  expect(advancePlayback(0.05, span, 120, 120, "reflect", -1)).toEqual({
    phase: expect.closeTo(0.05, 9),
    direction: 1,
    done: false,
  });
  expect(advancePlayback(0.95, span, 120, 120, "none", 1)).toEqual({
    phase: 1,
    direction: 1,
    done: true,
  });
  expect(advancePlayback(0.5, span, 60, 120, "reflect", -1)).toEqual({
    phase: expect.closeTo(0.45, 9),
    direction: -1,
    done: false,
  });
});

test("a span that is not a whole number of steps ends on the grid", () => {
  const span = { min: 0.01, max: 0.2, step: 0.05 };
  expect(iterate(0.16, 1, span, "none")).toEqual({ value: 0.16, direction: 1, done: true });
  expect(iterate(0.16, 1, span, "cycle", 1).value).toBe(0.01);
});
