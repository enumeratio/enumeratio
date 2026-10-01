import { expect, test } from "vite-plus/test";
import { Clock } from "../src/clock.ts";

test("one clock, many watchers — they all hear the same moment", () => {
  const clock = new Clock();
  const heard: number[][] = [[], []];
  const stop0 = clock.watch((t) => heard[0]!.push(t.phase));
  const stop1 = clock.watch((t) => heard[1]!.push(t.phase));
  clock.seek(0.25);
  clock.seek(0.5);
  expect(heard[0]).toEqual(heard[1]);
  expect(heard[0]!.at(-1)).toBeCloseTo(0.5, 12);
  stop0();
  clock.seek(0.75);
  expect(heard[0]!.at(-1), "a watcher that stopped hears nothing more").toBeCloseTo(0.5, 12);
  expect(heard[1]!.at(-1)).toBeCloseTo(0.75, 12);
  stop1();
});

test("a watcher hears the current moment the instant it starts watching", () => {
  // Otherwise a figure renders at phase 0 for one frame and jumps — visible as a flicker on
  // every figure that mounts late.
  const clock = new Clock();
  clock.seek(0.4);
  let first: number | undefined;
  const stop = clock.watch((t) => {
    first ??= t.phase;
  });
  expect(first).toBeCloseTo(0.4, 12);
  stop();
});

test("pausing and playing does not lose or replay the paused interval", () => {
  const clock = new Clock();
  const stop = clock.watch(() => {});
  clock.seek(0.3);
  clock.pause();
  expect(clock.playing).toBe(false);
  const held = clock.time;
  clock.play();
  expect(clock.playing).toBe(true);
  expect(clock.time, "resumes where it stopped").toBe(held);
  stop();
});

test("seeking wraps rather than running off the end", () => {
  const clock = new Clock();
  clock.seek(1.25);
  expect(clock.phase).toBeCloseTo(0.25, 12);
  clock.seek(-0.25);
  expect(clock.phase).toBeCloseTo(0.75, 12);
});

test("changing the speed holds the phase, so nothing jumps", () => {
  // The alternative — holding the TIME — makes every figure on the page leap the moment the
  // speed is touched, which is the one thing a speed control must not do.
  const clock = new Clock();
  clock.seek(0.4);
  clock.period = 3;
  expect(clock.phase).toBeCloseTo(0.4, 12);
  expect(clock.time).toBeCloseTo(1.2, 12);
  clock.period = 0; // nonsense is clamped, not obeyed
  expect(clock.period).toBeGreaterThan(0);
});

test("toggle is the two of them", () => {
  const clock = new Clock();
  expect(clock.playing).toBe(true);
  clock.toggle();
  expect(clock.playing).toBe(false);
  clock.toggle();
  expect(clock.playing).toBe(true);
});

test("the loop decides what the end of a cycle does", () => {
  const clock = new Clock();
  clock.period = 4;
  clock.advance(5); // a cycle and a quarter
  expect(clock.phase).toBeCloseTo(0.25, 12);

  clock.loop = "reflect"; // keeps the phase it is at
  expect(clock.phase).toBeCloseTo(0.25, 12);
  clock.advance(4); // to 1.25 turns: on the way back
  expect(clock.phase).toBeCloseTo(0.75, 12);
  clock.advance(2); // 1.75 turns
  expect(clock.phase).toBeCloseTo(0.25, 12);

  clock.loop = "none";
  clock.seek(0.5);
  clock.advance(10);
  expect(clock.phase).toBe(1);
  expect(clock.playing).toBe(false); // ran its course
  clock.play(); // starts over
  expect(clock.playing).toBe(true);
  expect(clock.phase).toBe(0);
  clock.seek(1.5); // a play-through clamps where a cycle would wrap
  expect(clock.phase).toBe(1);
});

test("the rate scales real time", () => {
  const clock = new Clock();
  clock.period = 4;
  clock.rate = 2;
  clock.advance(1);
  expect(clock.phase).toBeCloseTo(0.5, 12);
  clock.rate = 0; // nonsense is one, not stopped
  expect(clock.rate).toBe(1);
});
