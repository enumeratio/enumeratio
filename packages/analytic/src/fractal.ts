import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { isFiniteNum, type NativeEval, numberResult, realCompile } from "./box.ts";
import type { Cx } from "./complex.ts";

// Iterated quadratic maps -- the Mandelbrot and Julia sets, as expressions.
//
// Not special functions, and this is not their permanent home -- graphics objects have
// no package of their own yet; they are here because the complex GPU kernel and the
// compile handlers are, and splitting them out before the graphics seam exists would
// only move the problem.
//
// Both yield the n-th iterate of z -> z² + c rather than an escape count. That is the
// honest complex-valued object and it needs no special colouring: the exterior blows up
// and reads as poles, while the interior stays bounded and reads as colour. It also
// means the *same* machinery draws them as draws a zeta function.

/** The n-th iterate of z ↦ z² + c, stopping early once it has clearly escaped. */
export function iterateQuadratic(z0: Cx, c: Cx, n: number): Cx {
  const steps = Math.min(512, Math.max(1, Math.round(n)));
  let re = z0.re;
  let im = z0.im;
  for (let i = 0; i < steps; i++) {
    const nextRe = re * re - im * im + c.re;
    im = 2 * re * im + c.im;
    re = nextRe;
    if (re * re + im * im > 1e12) break;
  }
  return { re, im };
}

/** Mandelbrot: iterate from 0, with the plane as the parameter. */
export const mandelbrot = (c: Cx, n: number): Cx => iterateQuadratic({ re: 0, im: 0 }, c, n);

/** Julia: iterate from the point, with the parameter held fixed. */
export const julia = (z: Cx, c: Cx, n: number): Cx => iterateQuadratic(z, c, n);

/** Real-valued forms, for the real-scalar compiled pipelines. */
export const mandelbrotReal = (c: number, n: number): number => mandelbrot({ re: c, im: 0 }, n).re;
export const juliaReal = (z: number, cRe: number, n: number): number =>
  julia({ re: z, im: 0 }, { re: cRe, im: 0 }, n).re;

function evaluateIterate(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  numeric: boolean,
  from: "zero" | "point",
): BoxedExpression | undefined {
  const first = ops[0];
  const second = ops[1];
  const third = ops[2];
  if (!numeric || !first) return undefined;
  const steps = (from === "zero" ? second : third)?.re ?? 64;
  if (!Number.isFinite(steps)) return undefined;
  if (from === "zero") {
    if (!isFiniteNum(first)) return undefined;
    return numberResult(ce, mandelbrot({ re: first.re, im: first.im }, steps));
  }
  if (!second || !isFiniteNum(first) || !isFiniteNum(second)) return undefined;
  return numberResult(
    ce,
    julia({ re: first.re, im: first.im }, { re: second.re, im: second.im }, steps),
  );
}

/**
 * Declare `Mandelbrot(c, n)` and `Julia(z, c, n)`. `n` defaults to 64 iterations, which
 * is enough for the shape to read at the scales a reader starts at.
 */
export function declareFractals(ce: ComputeEngine): void {
  ce.declare("Mandelbrot", {
    signature: "(number, number?) -> number",
    evaluate: ((ops: readonly BoxedExpression[], options: { numericApproximation?: boolean }) =>
      evaluateIterate(ce, ops, options.numericApproximation ?? false, "zero")) as NativeEval,
    compile: realCompile(2, { js: "__mb", wgsl: "mandelbrot" }),
  });

  ce.declare("Julia", {
    signature: "(number, number, number?) -> number",
    evaluate: ((ops: readonly BoxedExpression[], options: { numericApproximation?: boolean }) =>
      evaluateIterate(ce, ops, options.numericApproximation ?? false, "point")) as NativeEval,
    compile: realCompile(3, { js: "__ju", wgsl: "julia" }),
  });
}
