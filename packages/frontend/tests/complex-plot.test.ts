import { expect, test } from "vite-plus/test";
import { type ComplexPlotView, zoomAbout } from "../src/complex-plot.ts";

const view = (over: Partial<ComplexPlotView> = {}): ComplexPlotView => ({
  center: [0, 0],
  extent: 2.4,
  mask: 0,
  ...over,
});

/** Where the pointer's position maps to in the plane, for a given view. */
const worldAt = (v: ComplexPlotView, ux: number, uy: number, aspect: number): [number, number] => [
  v.center[0] + ux * v.extent * aspect,
  v.center[1] + uy * v.extent,
];

test("the point under the cursor stays under the cursor", () => {
  const aspect = 1.35;
  const [ux, uy] = [-0.25, 0.25];
  let v = view();
  const before = worldAt(v, ux, uy, aspect);
  for (let i = 0; i < 12; i++) v = zoomAbout(v, ux, uy, aspect, 0.87);
  const after = worldAt(v, ux, uy, aspect);
  expect(after[0]).toBeCloseTo(before[0], 12);
  expect(after[1]).toBeCloseTo(before[1], 12);
});

test("the view actually zooms in, and the centre follows the cursor", () => {
  // Getting the sign backwards still holds no point fixed but pushes the centre the
  // wrong way, so pin the direction explicitly.
  const v = zoomAbout(view(), -0.25, 0.25, 1.35, 0.87);
  expect(v.extent).toBeLessThan(2.4);
  expect(v.center[0]).toBeLessThan(0); // cursor was left of centre
  expect(v.center[1]).toBeGreaterThan(0); // ...and above it
});

test("zooming out also holds the point, moving the centre the other way", () => {
  const aspect = 1.35;
  const [ux, uy] = [0.4, -0.1];
  const v0 = view({ center: [1, -0.5], extent: 1 });
  const before = worldAt(v0, ux, uy, aspect);
  const v1 = zoomAbout(v0, ux, uy, aspect, 2);
  expect(v1.extent).toBe(2);
  const after = worldAt(v1, ux, uy, aspect);
  expect(after[0]).toBeCloseTo(before[0], 12);
  expect(after[1]).toBeCloseTo(before[1], 12);
});

test("zooming at the exact centre only changes the extent", () => {
  const v = zoomAbout(view({ center: [3, -2] }), 0, 0, 1.35, 0.5);
  expect(v.center).toEqual([3, -2]);
  expect(v.extent).toBe(1.2);
});

test("the extent clamps, and a clamped zoom leaves the view alone", () => {
  expect(zoomAbout(view({ extent: 64 }), 0.3, 0.3, 1.35, 2).extent).toBe(64);
  expect(zoomAbout(view({ extent: 0.05 }), 0.3, 0.3, 1.35, 0.5).extent).toBe(0.05);
  // At the stop the centre must not drift either -- the element relies on this to
  // detect "nothing happened" and skip the redraw.
  const stuck = zoomAbout(view({ extent: 64, center: [1, 1] }), 0.3, 0.3, 1.35, 2);
  expect(stuck.center).toEqual([1, 1]);
});

test("the mask is carried through untouched", () => {
  expect(zoomAbout(view({ mask: 1 }), 0.2, 0.2, 1.35, 0.9).mask).toBe(1);
});
