import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareFractals, iterateQuadratic, julia, mandelbrot } from "../src/fractal.ts";
import { emitComplexWGSL, type Json } from "../src/wgsl-complex.ts";

const ce = new ComputeEngine();
declareFractals(ce);

const mag = (c: { re: number; im: number }) => Math.hypot(c.re, c.im);

test("a point inside the set stays bounded, however long you iterate", () => {
  // 0 and -1 are in the Mandelbrot set: the orbit of 0 never escapes.
  expect(mag(mandelbrot({ re: 0, im: 0 }, 512))).toBeLessThan(2);
  expect(mag(mandelbrot({ re: -1, im: 0 }, 512))).toBeLessThan(2);
  // -1 is 2-periodic: 0 -> -1 -> 0 -> -1, so an even count returns to 0.
  expect(mandelbrot({ re: -1, im: 0 }, 2).re).toBeCloseTo(0, 12);
});

test("a point outside escapes, and the magnitude is what says so", () => {
  expect(mag(mandelbrot({ re: 1, im: 0 }, 64))).toBeGreaterThan(1e6);
  expect(mag(mandelbrot({ re: 0, im: 2 }, 64))).toBeGreaterThan(1e6);
});

test("escape stops the loop rather than running to overflow", () => {
  // Bailing out early is what keeps a diverging orbit finite and comparable.
  const far = mandelbrot({ re: 4, im: 4 }, 512);
  expect(Number.isFinite(far.re)).toBe(true);
  expect(Number.isFinite(far.im)).toBe(true);
});

test("Julia iterates from the point, Mandelbrot from zero", () => {
  const c = { re: -0.4, im: 0.6 };
  expect(julia({ re: 0, im: 0 }, c, 8)).toEqual(mandelbrot(c, 8));
  // From a different start they part company.
  expect(julia({ re: 0.5, im: 0 }, c, 8)).not.toEqual(mandelbrot(c, 8));
});

test("one step is the map itself", () => {
  expect(iterateQuadratic({ re: 2, im: 0 }, { re: 1, im: 0 }, 1)).toEqual({ re: 5, im: 0 });
  expect(iterateQuadratic({ re: 0, im: 1 }, { re: 0, im: 0 }, 1)).toEqual({ re: -1, im: 0 });
});

test("the iteration count is clamped, never zero or unbounded", () => {
  // A shader cannot be trusted with an unbounded loop, and the CPU path agrees with it.
  expect(iterateQuadratic({ re: 0, im: 0 }, { re: 1, im: 0 }, 0)).toEqual({ re: 1, im: 0 });
  expect(Number.isFinite(mag(mandelbrot({ re: 0, im: 0 }, 1e9)))).toBe(true);
});

test("both heads evaluate numerically and lower to their GPU kernels", () => {
  expect(ce.box(["Mandelbrot", ["Complex", -1, 0], 2] as never).N().re).toBeCloseTo(0, 12);
  expect(emitComplexWGSL(["Mandelbrot", "z", 64] as Json)?.code).toBe("mandelbrot(z, prm.p[0].xy)");
  expect(emitComplexWGSL(["Julia", "z", ["Complex", -0.4, 0.6], 64] as Json)?.code).toBe(
    "julia(z, prm.p[0].xy, prm.p[1].xy)",
  );
});
