import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bernoulliNumber, bernoulliPolyExpr, type Json } from "./bernoulli.ts";
import {
  type BoxInput,
  type EvalOptions,
  isFiniteNum,
  isRealInt,
  type NativeEval,
  numberResult,
  realCompile,
} from "./box.ts";
import { add, cpow, cx, type Cx, mul, scale } from "./complex.ts";
import { lerchPhi } from "./lerch.ts";
import { evaluateIncompleteGamma } from "./incomplete-gamma.ts";
import { evaluatePolygamma } from "./polygamma.ts";
import { evaluatePolyLog } from "./polylog.ts";
import { atEnginePrecision, preciseHurwitzZeta } from "./precise.ts";
import { declareCarlson } from "./carlson.ts";
import { declareDerivatives } from "./derivatives.ts";
import { declareElliptic } from "./elliptic.ts";
import { declareModular } from "./modular.ts";
import { declareSpecialFunctions } from "./special-functions.ts";

// Hurwitz zeta ζ(s, a) = Σ_{n≥0} (n+a)^{-s}, analytically continued, as a
// compute-engine head. Numeric evaluation is Euler–Maclaurin: sum the first N
// terms directly (which also shifts a into the right half-plane), then add the
// tail's integral, endpoint, and Bernoulli-number correction terms. Exact
// closed forms are returned symbolically where Wolfram has them: the s=1 pole,
// the ζ(−n, a) Bernoulli-polynomial values, and the ζ(s, m) reduction to the
// Riemann ζ that makes ζ(s, 1) = ζ(s).

/** Bernoulli correction pairs B₂..B₂ₖ used in the tail (optimal-truncation regime). */
const EM_PAIRS = 12;

/** cₖ = B₂ₖ / (2k)!, the Euler–Maclaurin tail coefficients. */
const EM_COEFF: number[] = (() => {
  const c: number[] = [0];
  let factorial = 1; // (2k)!
  for (let k = 1; k <= EM_PAIRS; k++) {
    factorial *= (2 * k - 1) * (2 * k);
    c[k] = bernoulliNumber(2 * k) / factorial;
  }
  return c;
})();

// Scratch registers for the allocation-free complex power below. The kernel is
// synchronous and single-threaded, so a shared pair is safe and keeps the hot loop
// from allocating a {re,im} per term (each eval does ~N+15 powers).
let _pr = 0;
let _pi = 0;

/** z^w for z = zr+zi·i, w = wr+wi·i, principal branch; result in _pr/_pi. */
function cpowInto(zr: number, zi: number, wr: number, wi: number): void {
  if (zi === 0 && zr > 0 && wi === 0) {
    _pr = Math.pow(zr, wr);
    _pi = 0;
    return;
  }
  const logr = 0.5 * Math.log(zr * zr + zi * zi);
  const th = Math.atan2(zi, zr);
  const er = wr * logr - wi * th;
  const ei = wr * th + wi * logr;
  const m = Math.exp(er);
  _pr = m * Math.cos(ei);
  _pi = m * Math.sin(ei);
}

/**
 * Numeric ζ(s, a) for complex s, a via Euler–Maclaurin. Terms where (n+a)=0 (a a
 * nonpositive integer) are dropped, matching Wolfram's `HurwitzZeta`, which omits
 * the singular term rather than diverging there. Returns a non-finite part at the
 * s=1 pole.
 *
 * Hot path: all complex arithmetic is inlined on primitive locals (no per-term
 * object allocation). The math is identical to the `Cx`-helper form; see
 * `zetaGeneralized` for the readable version of the same operations.
 */
export function hurwitzZeta(s: Cx, a: Cx): Cx {
  const sRe = s.re;
  const sIm = s.im;
  const aRe = a.re;
  const aIm = a.im;
  // Direct terms push a into Re(a)+N large relative to |s|, where the asymptotic
  // tail is accurate; a few more than |s| keeps the truncated series converging.
  const targetRe = Math.max(12, Math.ceil(Math.abs(sRe) + Math.abs(sIm)) + 6);
  const n = Math.max(8, Math.ceil(targetRe - aRe));
  const negSr = -sRe;
  const negSi = -sIm;

  let sumR = 0;
  let sumI = 0;
  for (let k = 0; k < n; k++) {
    const br = aRe + k;
    if (br === 0 && aIm === 0) continue; // Wolfram HurwitzZeta drops (n+a)=0
    cpowInto(br, aIm, negSr, negSi);
    sumR += _pr;
    sumI += _pi;
  }

  const zr = aRe + n; // Re(z) large
  const zi = aIm;
  cpowInto(zr, zi, negSr, negSi); // z^{-s}
  const zNegSr = _pr;
  const zNegSi = _pi;

  cpowInto(zr, zi, 1 - sRe, -sIm); // z^{1-s}
  const dr = sRe - 1;
  const dd = dr * dr + sIm * sIm; // divide by (s-1)
  sumR += (_pr * dr + _pi * sIm) / dd;
  sumI += (_pi * dr - _pr * sIm) / dd;

  sumR += 0.5 * zNegSr; // ½ z^{-s}
  sumI += 0.5 * zNegSi;

  // Σ_{k≥1} cₖ · (s)_{2k-1} · z^{-(s+2k-1)}, rolling the Pochhammer and z-power forward.
  cpowInto(zr, zi, -2, 0); // z^{-2}
  const zi2r = _pr;
  const zi2i = _pi;
  const zd = zr * zr + zi * zi; // zPow = z^{-s}/z = z^{-(s+1)}
  let zpr = (zNegSr * zr + zNegSi * zi) / zd;
  let zpi = (zNegSi * zr - zNegSr * zi) / zd;
  let pochR = sRe; // (s)_1
  let pochI = sIm;
  for (let k = 1; k <= EM_PAIRS; k++) {
    sumR += EM_COEFF[k] * (pochR * zpr - pochI * zpi);
    sumI += EM_COEFF[k] * (pochR * zpi + pochI * zpr);
    // poch *= (s+2k-1)(s+2k)
    const gr = (sRe + 2 * k - 1) * (sRe + 2 * k) - sIm * sIm;
    const gi = (sRe + 2 * k - 1) * sIm + sIm * (sRe + 2 * k);
    const npR = pochR * gr - pochI * gi;
    pochI = pochR * gi + pochI * gr;
    pochR = npR;
    // zPow *= z^{-2}
    const nzr = zpr * zi2r - zpi * zi2i;
    zpi = zpr * zi2i + zpi * zi2r;
    zpr = nzr;
  }
  return { re: sumR, im: sumI };
}

/**
 * Numeric Zeta(s, a) in Wolfram's generalized-zeta convention. Identical to
 * HurwitzZeta for Re(a) > 0; for a with Re(a) ≤ 0 it differs in the finitely many
 * terms off the positive axis: those use ((k+a)²)^(−s/2) (which is the real
 * |k+a|^(−s) when k+a is real and negative), and the (k+a)=0 slot is dropped. So,
 * unlike HurwitzZeta, Zeta(s, a) is finite at a = 0, −1, −2, … (Zeta(s, 0) = ζ(s)).
 */
export function zetaGeneralized(s: Cx, a: Cx): Cx {
  const negHalfS = scale(s, -0.5);
  let acc = cx(0, 0);
  let cur = cx(a.re, a.im);
  while (cur.re < 0) {
    acc = add(acc, cpow(mul(cur, cur), negHalfS)); // ((k+a)²)^(−s/2)
    cur = cx(cur.re + 1, cur.im);
  }
  if (cur.re === 0 && cur.im === 0) cur = cx(1, 0); // drop the (k+a)=0 term — no pole
  return add(acc, hurwitzZeta(s, cur));
}

/** Real-valued ζ(s, a) for real s, a — the shape compute-engine's compiled
 * (JS/GPU) plotting pipeline consumes, which is real-scalar. */
export const hurwitzZetaReal = (s: number, a: number): number =>
  hurwitzZeta({ re: s, im: 0 }, { re: a, im: 0 }).re;
export const zetaGeneralizedReal = (s: number, a: number): number =>
  zetaGeneralized({ re: s, im: 0 }, { re: a, im: 0 }).re;

function evaluateHurwitz(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  numeric: boolean,
): BoxedExpression | undefined {
  const s = ops[0];
  const a = ops[1];
  if (s === undefined || a === undefined) return undefined;

  const box = (expr: Json) => ce.box(expr as unknown as BoxInput);
  const finish = (expr: BoxedExpression) => (numeric ? expr.N() : expr.evaluate());

  // ζ(1, a): a simple pole for every a.
  if (isRealInt(s) && s.re === 1) return ce.symbol("ComplexInfinity");

  // ζ(−n, a) = −B_{n+1}(a)/(n+1). Exact and polynomial in a — works for symbolic a.
  if (isRealInt(s) && s.re <= 0) {
    const nn = -s.re;
    const poly = bernoulliPolyExpr(nn + 1, a.json as unknown as Json);
    return finish(box(["Divide", ["Negate", poly], nn + 1]));
  }

  // ζ(s, m) for a positive integer m: ζ(s) − Σ_{k=1}^{m-1} k^{-s}. Gives the
  // ζ(s, 1) = ζ(s) reduction and closed forms like ζ(2, 2) = π²/6 − 1. Skipped for
  // a concretely complex s, whose ζ(s) compute-engine can't evaluate numerically —
  // those fall through to Euler–Maclaurin, which handles complex s directly.
  const complexS = Number.isFinite(s.re) && Number.isFinite(s.im) && s.im !== 0;
  if (!complexS && a.im === 0 && Number.isInteger(a.re) && a.re >= 1) {
    const m = a.re;
    const sJson = s.json as unknown as Json;
    if (m === 1) return finish(box(["Zeta", sJson]));
    const subtracted: Json[] = [];
    for (let k = 1; k < m; k++) subtracted.push(["Power", k, ["Negate", sJson]]);
    const tail: Json = subtracted.length === 1 ? subtracted[0] : ["Add", ...subtracted];
    return finish(box(["Subtract", ["Zeta", sJson], tail]));
  }

  // ζ(n, a) = (−1)ⁿ ψ⁽ⁿ⁻¹⁾(a)/(n−1)! for an integer n ≥ 2 and real a > 0. Exact, and
  // compute-engine's PolyGamma carries it to whatever precision was asked for, which the
  // double-precision kernel below cannot. Numeric path only: under plain evaluate the head
  // keeps its own form rather than trading it for a polygamma.
  if (numeric && isRealInt(s) && s.re >= 2 && a.im === 0 && a.re > 0) {
    const n = s.re;
    const sign: Json = n % 2 === 0 ? 1 : -1;
    const viaPolygamma = atEnginePrecision(
      ce,
      box([
        "Divide",
        ["Multiply", sign, ["PolyGamma", n - 1, a.json as unknown as Json]],
        ["Factorial", n - 1],
      ]).N(),
    );
    if (viaPolygamma !== undefined) return viaPolygamma;
  }

  // Asked for more digits than a double holds? Take the same Euler–Maclaurin written as an
  // expression, which compute-engine's own arithmetic carries to the requested precision.
  if (numeric) {
    const precise = preciseHurwitzZeta(ce, s, a);
    if (precise !== undefined) return precise;
  }

  // Numeric Euler–Maclaurin for everything else — only when a number is asked for.
  if (numeric && isFiniteNum(s) && isFiniteNum(a)) {
    return numberResult(ce, hurwitzZeta({ re: s.re, im: s.im }, { re: a.re, im: a.im }));
  }

  return undefined; // stay symbolic
}

/**
 * Evaluate the two-argument Zeta(s, a) — Wolfram's generalized zeta. For Re(a) > 0
 * (and symbolic a) it is identical to HurwitzZeta, so it reuses those exact
 * reductions; for a concrete a with Re(a) ≤ 0 it uses the generalized-zeta
 * convention numerically (see zetaGeneralized). The one-argument case is handled by
 * the caller, which defers to compute-engine's native Riemann zeta.
 */
function evaluateZeta(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  numeric: boolean,
): BoxedExpression | undefined {
  const s = ops[0];
  const a = ops[1];
  if (s === undefined || a === undefined) return undefined;

  if (isRealInt(s) && s.re === 1) return ce.symbol("ComplexInfinity"); // ζ(1, a) pole

  // Re(a) > 0, or a symbolic: identical to HurwitzZeta (exact reductions + EM).
  if (!isFiniteNum(a) || a.re > 0) return evaluateHurwitz(ce, ops, numeric);

  // Zeta(s, 0) = ζ(s): the (k+a)=0 term is dropped, leaving the Riemann sum. Exact.
  if (a.re === 0 && a.im === 0) {
    const expr = ce.box(["Zeta", s.json as unknown as BoxInput] as unknown as BoxInput);
    return numeric ? expr.N() : expr.evaluate();
  }

  // a concrete with Re(a) ≤ 0: generalized-zeta convention, numeric only.
  if (numeric && isFiniteNum(s)) {
    return numberResult(ce, zetaGeneralized({ re: s.re, im: s.im }, { re: a.re, im: a.im }));
  }

  return undefined; // stay symbolic
}

/**
 * Evaluate the Lerch transcendent LerchPhi(z, s, a) = Σ zⁿ (n+a)^(−s). Exact
 * reductions: z=1 → HurwitzZeta(s, a); s=0 → 1/(1−z). Otherwise numeric via the
 * direct series (see lerch.ts), which covers |z| ≤ 1.
 */
function evaluateLerch(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  numeric: boolean,
): BoxedExpression | undefined {
  const z = ops[0];
  const s = ops[1];
  const a = ops[2];
  if (z === undefined || s === undefined || a === undefined) return undefined;
  const box = (expr: Json) => ce.box(expr as unknown as BoxInput);
  const finish = (expr: BoxedExpression) => (numeric ? expr.N() : expr.evaluate());

  // Φ(1, s, a) = ζ(s, a) — flows into the HurwitzZeta closed forms.
  if (z.im === 0 && z.re === 1) {
    return finish(box(["HurwitzZeta", s.json as unknown as Json, a.json as unknown as Json]));
  }
  // Φ(z, 0, a) = 1/(1 − z), independent of a (the geometric series and its continuation).
  if (isRealInt(s) && s.re === 0) {
    return finish(box(["Divide", 1, ["Subtract", 1, z.json as unknown as Json]]));
  }
  if (numeric && isFiniteNum(z) && isFiniteNum(s) && isFiniteNum(a)) {
    return numberResult(
      ce,
      lerchPhi({ re: z.re, im: z.im }, { re: s.re, im: s.im }, { re: a.re, im: a.im }),
    );
  }
  return undefined; // stay symbolic
}

/**
 * Declare the analytic special-function heads on `ce`, numerically aligned with
 * Wolfram:
 * - `HurwitzZeta(s, a)` — the two-argument Hurwitz zeta (`HurwitzZeta[s, a]`).
 * - `Zeta(s, a)` — the two-argument generalized zeta (`Zeta[s, a]`), which differs
 *   from HurwitzZeta only for a with Re(a) ≤ 0. compute-engine's `Zeta` is
 *   single-argument (Riemann); this extends the head to accept a second argument
 *   while preserving the native one-argument behaviour (closed forms, poles,
 *   list-threading).
 * - `LerchPhi(z, s, a)` — the Lerch transcendent (`LerchPhi[z, s, a]`).
 *
 * `Gamma` and `GammaRegularized` gain a third argument (Wolfram's generalized incomplete
 * gamma, and with it the lower incomplete gamma) while keeping the native one- and
 * two-argument behaviour.
 *
 * `PolyLog(s, z)` and `PolyGamma(m, z)` are native compute-engine heads already;
 * they are extended rather than introduced — the native evaluator runs first and
 * ours only fills the cases it declines (see polylog.ts / polygamma.ts) and adds the
 * GPU lowering it has no kernel for.
 *
 * Also declares the heads in special-functions.ts: `BarnesG`, `LogBarnesG`, `LogGamma`,
 * `ClausenCl`, `DirichletEta`, `DirichletBeta`, `StieltjesGamma`, `DirichletCharacter`,
 * `DirichletL`, `HarmonicNumber`, `ChebyshevT`, `ChebyshevU`, `LegendrePolynomial`,
 * `RisingFactorial`, and the `Catalan` constant — the Carlson symmetric elliptic
 * integrals in carlson.ts: `CarlsonRF`, `CarlsonRC`, `CarlsonRD`, `CarlsonRJ`, `CarlsonRG`
 * — and, in elliptic.ts, `IncompleteEllipticF`/`IncompleteEllipticE` plus an in-place
 * precision fix for native `EllipticE` at complex modulus; the modular heads in
 * modular.ts: `ModularJ`, `ModularLambda`, `EisensteinG`.
 */
export function declareAnalytic(ce: ComputeEngine): void {
  ce.declare("HurwitzZeta", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      evaluateHurwitz(ce, ops, options.numericApproximation ?? false),
    compile: realCompile(2, { js: "__hz", wgsl: "hurwitz" }),
  });

  // Capture the native single-argument Riemann zeta before redeclaring, then defer
  // to it for the one-argument case; declaring `Zeta` replaces its whole definition.
  const nativeZeta: NativeEval = ce.box(["Zeta", 2]).operatorDefinition?.evaluate;
  ce.declare("Zeta", {
    signature: "(number, number?) -> number",
    broadcastable: true, // preserve native threading over a list of s
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      ops.length < 2
        ? nativeZeta?.(ops, options)
        : evaluateZeta(ce, ops, options.numericApproximation ?? false),
    // Two-arg compile only; one-arg Riemann zeta has no GPU kernel here, so a
    // single-argument call falls through to undefined (unsupported by the target).
    compile: (args, compile, ctx) =>
      args.length >= 2
        ? realCompile(2, { js: "__zg", wgsl: "zetaGen" })(args, compile, ctx)
        : undefined,
  });

  // LerchPhi(z, s, a): the Lerch transcendent (HurwitzZeta and PolyLog are special cases).
  ce.declare("LerchPhi", {
    signature: "(number, number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      evaluateLerch(ce, ops, options.numericApproximation ?? false),
    compile: realCompile(3, { js: "__lp", wgsl: "lerchPhi" }),
  });

  // PolyLog(s, z): native for integer s; the Lerch series adds non-integer and
  // complex orders inside |z| ≤ 1. No native lowering on either target, so both the
  // JS wrapper and the WGSL kernel come from here.
  const nativePolyLog: NativeEval = ce.box(["PolyLog", 2, 0.5]).operatorDefinition?.evaluate;
  ce.declare("PolyLog", {
    signature: "(number, number) -> number",
    broadcastable: true, // thread over a list of z (or of s), like the other heads
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      evaluatePolyLog(ce, nativePolyLog, ops, options),
    compile: realCompile(2, { js: "__pl", wgsl: "polyLog" }),
  });

  // PolyGamma(m, z): native for real z at every integer order (m = 0 is the digamma);
  // ours adds complex z. compute-engine already lowers it to `_SYS.polygamma` on the
  // JS target, so only the WGSL kernel is named here and JS falls through to native.
  const nativePolyGamma: NativeEval = ce.box(["PolyGamma", 1, 1]).operatorDefinition?.evaluate;
  ce.declare("PolyGamma", {
    signature: "(number, number) -> number",
    broadcastable: true, // preserve native threading over a list of z
    evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
      evaluatePolygamma(ce, nativePolyGamma, ops, options),
    compile: realCompile(2, { wgsl: "polygamma" }),
  });

  // Gamma(s, z₀, z₁) and GammaRegularized(s, z₀, z₁): the generalized incomplete gamma,
  // whose z₀ = 0 case is the lower incomplete gamma. Native for one and two arguments.
  // The operand type and `broadcastable` follow each native definition — Gamma's second
  // argument is optional and it threads over a list, GammaRegularized's is required and it
  // does not — so that redeclaring changes the arity and nothing else, type errors included.
  for (const [head, secondRequired, broadcastable] of [
    ["Gamma", false, true],
    ["GammaRegularized", true, false],
  ] as const) {
    const native: NativeEval = ce.box([head, 2, 1]).operatorDefinition?.evaluate;
    const z = "complex | infinity";
    ce.declare(head, {
      signature: `(${z}, (${z})${secondRequired ? "" : "?"}, (${z})?) -> number`,
      broadcastable,
      evaluate: (ops: readonly BoxedExpression[], options: EvalOptions) =>
        evaluateIncompleteGamma(ce, head, native, ops, options),
    });
  }

  declareSpecialFunctions(ce);
  declareCarlson(ce);
  declareElliptic(ce);
  declareModular(ce);
  declareDerivatives(ce);
}
