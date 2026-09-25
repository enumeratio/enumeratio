import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { isReal, type Cx } from "./complex.ts";

// Shared glue between the numeric kernels and compute-engine's boxed expressions:
// the operand predicates the evaluate handlers branch on, the boxed-result helper,
// and the `compile` handler factory the heads share.

export type BoxInput = Parameters<ComputeEngine["box"]>[0];
export type NativeEval = NonNullable<BoxedExpression["operatorDefinition"]>["evaluate"];
export type EvalOptions = Parameters<NonNullable<NativeEval>>[1];

/** A concrete real integer operand (NaN re from a symbolic operand fails Number.isInteger). */
export const isRealInt = (x: BoxedExpression): boolean => x.im === 0 && Number.isInteger(x.re);

/** A concrete (finite) numeric operand — as opposed to a symbolic one (NaN re/im). */
export const isFiniteNum = (x: BoxedExpression): boolean => Number.isFinite(x.re) && Number.isFinite(x.im);

/** Box a complex result, collapsing to a real number when the imaginary part vanishes. */
export const numberResult = (ce: ComputeEngine, r: Cx): BoxedExpression => {
  if (!Number.isFinite(r.re) || !Number.isFinite(r.im)) return ce.symbol("ComplexInfinity");
  // Real inputs with a positive real base stay on the Math.pow path (im exactly 0);
  // a negative real a gives a genuinely complex value.
  if (isReal(r, 1e-14 * (1 + Math.abs(r.re)))) return ce.number(r.re);
  return ce.number(ce.complex(r.re, r.im));
};

/**
 * Should this call produce a number? Either N() asked for one, or an operand is
 * inexact — a float argument means a float answer, which is how compute-engine's
 * own numeric handlers behave (PolyLog(2, 0.5) evaluates, PolyLog(2, 1/2) does not).
 *
 * `isExact` is a number-literal property; compute-engine narrows to it through an
 * interface the package doesn't re-export, so it is read structurally here. A
 * non-literal operand has no float to lose and counts as exact.
 */
export const wantsNumber = (ops: readonly BoxedExpression[], options: EvalOptions): boolean =>
  (options.numericApproximation ?? false) || ops.some((o) => (o as Partial<{ isExact: boolean }>).isExact === false);

/**
 * Did the captured native handler decline to evaluate — i.e. hand back the same
 * head, unevaluated? That is compute-engine's way of staying symbolic, and it marks
 * exactly the cases our kernels are here to fill in.
 */
export const declined = (r: BoxedExpression | undefined, head: string): boolean =>
  r === undefined || r.operator === head;

/**
 * A `compile` handler so `ce.compile(expr, {target})` emits a call to our kernel for
 * a head compute-engine's own compiler can't lower. Real-valued: assumes real args
 * and emits the real part, which composes in the real-scalar JS / WGSL pipelines the
 * plotters use.
 *  - javascript: `_.<js>(…)`, a real wrapper injected on the scope object.
 *  - wgsl: `<wgsl>(vec2f(…, 0.0), …).x`, using the `zetaWGSL` kernel (which the shader
 *    host must prepend). `.x` takes the real part back to an f32.
 * A target left unnamed returns undefined, which lets a native lowering (where the
 * target has one) take over instead. GLSL and other targets fall through the same way.
 */
export const realCompile =
  (arity: number, emit: { js?: string; wgsl?: string }) =>
  (
    args: readonly BoxedExpression[],
    compile: (e: BoxedExpression) => string,
    ctx: { language?: string },
  ): string | undefined => {
    const ops = args.slice(0, arity);
    if (ops.length < arity || ops.some((o) => o === undefined)) return undefined;
    const cs = ops.map(compile);
    if (ctx.language === "javascript" && emit.js) return `_.${emit.js}(${cs.join(", ")})`;
    if (ctx.language === "wgsl" && emit.wgsl) return `${emit.wgsl}(${cs.map((c) => `vec2f(${c}, 0.0)`).join(", ")}).x`;
    return undefined;
  };
