import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf } from "@enumeratio/engine";
import { dividedByT, fractionFactors } from "./transforms.ts";

// HankelTransform(f, r, s[, n]) = ∫_0^∞ f(r) J_n(s r) r dr, matching Wolfram's own
// normalisation exactly (no extra prefactor — confirmed directly against
// `wolframscript`, e.g. `HankelTransform[1/r, r, s]` is `1/s`, not `1/s` times some
// constant). `n` defaults to Wolfram's own default order 0 when omitted.
//
// Order-0 table (f(r) -> F(s), each confirmed with `GenerateConditions -> True`; every
// strip below also needs `s >= 0`, the transform's own domain, left as a documentation
// note rather than a runtime check since `s` is the free output variable, exactly like
// this file's Laplace/Fourier/Mellin siblings):
//   e^(-a*r)          -> a/(a^2+s^2)^(3/2)              Re(a) > 0
//   e^(-a*r^2)        -> 1/(2a) * e^(-s^2/(4a))          Re(a) > 0 (no strip beyond it)
//   1/r               -> 1/s                             (no strip beyond it)
//   1/sqrt(r^2+a^2)   -> e^(-a*s)/s                       Re(a) > 0 (`a` read off a literal
//                                                          a^2 term, so `a > 0` is required,
//                                                          not just `a^2 > 0`)
// Two further orders Wolfram's own examples state explicitly (verified the same way):
//   n = 1: e^(-a*r) -> s/(a^2+s^2)^(3/2)                 Re(a) > 0
//   any n: 1/r -> 1/s (n-independent identity)            n > -1/2
//
// Two more order-0 pairs, f(r)/r with a Bessel-function answer:
//   e^(-a*r)/r        -> 1/sqrt(a^2+s^2)                Re(a) > 0   (DLMF 10.22.49, nu = 0)
//   e^(-A*r^2)/r      -> sqrt(pi)/(2 sqrt(A)) * e^(-s^2/(8A)) * I_0(s^2/(8A))
//                                                         A > 0, or A a square (Gradshteyn-Ryzhik 6.618.1, nu = 0)
//
// Four more order-0 pairs from the usual tables (Gradshteyn and Ryzhik, Erdélyi's Tables of Integral Transforms), each confirmed
// against `wolframscript` and a numerical integral:
//   erfc(k*r)/r            -> erf(s/(2k))/s                  k > 0
//   E_1(k*r)/r             -> asinh(s/k)/s                   k > 0
//   (1 - e^(-m*r))/r^2     -> asinh(m/s)                     m > 0
//   ln(1 + a^2/r^2)        -> 2(1 - |a|s K_1(|a|s))/s^2
// (the first two by the scaling rule from the k = 1 pair; the third is the Laplace transform of J_0
// integrated over the decay rate, ∫_0^m da/sqrt(a^2+s^2); the last is ∂/∂a of it, 2a K_0(as) integrated.)
//
// Two more order-0 pairs, sin and cos over r (G&R 6.671.7 and 6.671.2, ν = 0), each piecewise in
// s because the integral is conditionally convergent and jumps where s crosses a (k = |a|):
//   sin(a*r)/r             -> sgn(a)/sqrt(a^2-s^2) for s < |a|,  0 for s > |a|
//   cos(a*r)/r             -> 0 for s < |a|,  1/sqrt(s^2-a^2) for s > |a|
// A symbolic s leaves a Piecewise that settles once s is known; s = |a| diverges (Indeterminate).
// Wolfram answers a MeijerG in s^-2 that equals these on each side, and holds the call at s = |a|.
//
// Declined: any other function, any other stated order (Wolfram's own closed forms for
// e^(-a*r)/e^(-a*r^2) at a general order `n` involve `Hypergeometric2F1Regularized` /
// `Hypergeometric1F1Regularized` — not elementary, not chased), and an unknown-sign `a`.

const opAt = (expr: BoxedExpression, i: number): BoxedExpression => operandsOf(expr)[i];
const isSym = (x: BoxedExpression, name: string): boolean => symbolNameOf(x) === name;
const isE = (x: BoxedExpression): boolean => isSym(x, "ExponentialE");
const hasVar = (expr: BoxedExpression, name: string): boolean => expr.has(name);

/** `expr` as `a*x` (any sign; `Negate` folds through, mirroring `mellin-transform.ts`'s
 * `linearCoeff`) — bare `x` gives `a = 1`. */
function linearCoeffSigned(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression | undefined {
  if (isSym(expr, name)) return ce.One;
  if (expr.operator === "Negate") {
    const inner = linearCoeffSigned(ce, opAt(expr, 0), name);
    return inner === undefined ? undefined : ce.function("Negate", [inner]).evaluate();
  }
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const xFactors = ops.filter((o) => isSym(o, name));
    const rest = ops.filter((o) => !isSym(o, name));
    if (xFactors.length !== 1 || rest.some((o) => hasVar(o, name))) return undefined;
    return rest.length === 1 ? rest[0] : ce.function("Multiply", rest).evaluate();
  }
  return undefined;
}

/** `expr` as `b*x^2` (any sign — mirrors `mellin-transform.ts`'s `quadraticCoeffSigned`). */
function quadraticCoeffSigned(ce: ComputeEngine, expr: BoxedExpression, name: string): BoxedExpression | undefined {
  const isXSq = (o: BoxedExpression) => o.operator === "Power" && isSym(opAt(o, 0), name) && opAt(o, 1).re === 2;
  if (isXSq(expr)) return ce.One;
  if (expr.operator === "Negate") {
    const inner = quadraticCoeffSigned(ce, opAt(expr, 0), name);
    return inner === undefined ? undefined : ce.function("Negate", [inner]).evaluate();
  }
  if (expr.operator === "Multiply") {
    const ops = operandsOf(expr);
    const sqFactors = ops.filter(isXSq);
    const rest = ops.filter((o) => !isXSq(o));
    if (sqFactors.length !== 1 || rest.some((o) => hasVar(o, name))) return undefined;
    return rest.length === 1 ? rest[0] : ce.function("Multiply", rest).evaluate();
  }
  return undefined;
}

/** `1/sqrt(r^2 + a^2)`: `Divide[1, Sqrt[Add[Power[r,2], Power[X,2]]]]` (either order in
 * the `Add`), reading `a = X` (requires `X` to be a LITERAL square, and `isPositive`). */
function radialInverseDistance(ce: ComputeEngine, expr: BoxedExpression, r: string): BoxedExpression | undefined {
  if (expr.operator !== "Divide" || !(opAt(expr, 0).re === 1 && opAt(expr, 0).im === 0)) return undefined;
  const den = opAt(expr, 1);
  if (den.operator !== "Sqrt") return undefined;
  const radicand = opAt(den, 0);
  if (radicand.operator !== "Add") return undefined;
  const ops = operandsOf(radicand);
  if (ops.length !== 2) return undefined;
  const isRSq = (o: BoxedExpression) => o.operator === "Power" && isSym(opAt(o, 0), r) && opAt(o, 1).re === 2;
  const rTerm = ops.find(isRSq);
  const aTerm = ops.find((o) => o !== rTerm);
  if (rTerm === undefined || aTerm === undefined) return undefined;
  if (aTerm.operator !== "Power" || opAt(aTerm, 1).re !== 2 || hasVar(opAt(aTerm, 0), r)) return undefined;
  return opAt(aTerm, 0);
}

/** `1/r` exactly (`Divide[1, r]`). */
const isReciprocalOfR = (expr: BoxedExpression, r: string): boolean =>
  expr.operator === "Divide" && opAt(expr, 0).re === 1 && opAt(expr, 0).im === 0 && isSym(opAt(expr, 1), r);

function atomicHankelOrder0(
  ce: ComputeEngine,
  expr: BoxedExpression,
  r: string,
  s: BoxedExpression,
): BoxedExpression | undefined {
  if (isReciprocalOfR(expr, r)) return ce.function("Power", [s, -1]).evaluate();
  if (expr.operator === "Power" && isE(opAt(expr, 0))) {
    const exponent = opAt(expr, 1);
    const k = linearCoeffSigned(ce, exponent, r);
    if (k !== undefined && k.isNegative === true) {
      const a = ce.function("Negate", [k]).evaluate();
      const denom = ce.function("Power", [
        ce.function("Add", [ce.function("Power", [a, 2]), ce.function("Power", [s, 2])]),
        ce.number([3, 2]),
      ]);
      return ce.function("Divide", [a, denom]).evaluate();
    }
    const m = quadraticCoeffSigned(ce, exponent, r);
    if (m !== undefined && m.isNegative === true) {
      const a = ce.function("Negate", [m]).evaluate();
      const gaussExp = ce.function("Negate", [
        ce.function("Divide", [ce.function("Power", [s, 2]), ce.function("Multiply", [4, a])]),
      ]);
      return ce
        .function("Multiply", [
          ce.function("Divide", [1, ce.function("Multiply", [2, a])]),
          ce.function("Exp", [gaussExp]),
        ])
        .evaluate();
    }
    return undefined;
  }
  const a = radialInverseDistance(ce, expr, r);
  if (a !== undefined && a.isPositive === true) {
    return ce
      .function("Divide", [ce.function("Exp", [ce.function("Negate", [ce.function("Multiply", [a, s])])]), s])
      .evaluate();
  }
  return undefined;
}

/** Order 1's one stated closed form: `e^(-a*r) -> s/(a^2+s^2)^(3/2)`. */
function atomicHankelOrder1(
  ce: ComputeEngine,
  expr: BoxedExpression,
  r: string,
  s: BoxedExpression,
): BoxedExpression | undefined {
  if (expr.operator !== "Power" || !isE(opAt(expr, 0))) return undefined;
  const k = linearCoeffSigned(ce, opAt(expr, 1), r);
  if (k === undefined || k.isNegative !== true) return undefined;
  const a = ce.function("Negate", [k]).evaluate();
  const denom = ce.function("Power", [
    ce.function("Add", [ce.function("Power", [a, 2]), ce.function("Power", [s, 2])]),
    ce.number([3, 2]),
  ]);
  return ce.function("Divide", [s, denom]).evaluate();
}

/** `g(r)/r` for the two `g` above: the Laplace transform of J_0 (DLMF 10.22.49), and G&R 6.618.1's Gaussian. */
function hankelOverR(
  ce: ComputeEngine,
  expr: BoxedExpression,
  r: string,
  s: BoxedExpression,
): BoxedExpression | undefined {
  const g = dividedByT(ce, expr, r);
  if (g === undefined || g.operator !== "Power" || !isE(opAt(g, 0))) return undefined;
  const exponent = opAt(g, 1);
  const k = linearCoeffSigned(ce, exponent, r);
  if (k !== undefined && k.isNegative === true) {
    const a = ce.function("Negate", [k]).evaluate();
    const radicand = ce.function("Add", [ce.function("Power", [a, 2]), ce.function("Power", [s, 2])]);
    return ce.function("Power", [radicand, ce.number([-1, 2])]).evaluate();
  }
  const m = quadraticCoeffSigned(ce, exponent, r);
  if (m === undefined) return undefined;
  const bigA = ce.function("Negate", [m]).evaluate();
  const root =
    bigA.isPositive === true
      ? ce.function("Sqrt", [bigA])
      : bigA.operator === "Power" && opAt(bigA, 1).re === 2
        ? ce.function("Abs", [opAt(bigA, 0)])
        : undefined;
  if (root === undefined) return undefined;
  const z = ce.function("Divide", [ce.function("Power", [s, 2]), ce.function("Multiply", [8, bigA])]);
  return ce
    .function("Multiply", [
      ce.function("Divide", [ce.function("Sqrt", [ce.Pi]), ce.function("Multiply", [2, root])]),
      ce.function("Exp", [ce.function("Negate", [z])]),
      ce.function("BesselI", [0, z]),
    ])
    .evaluate();
}

/** The scaling `k` of `Erfc(kr)` / `E_1(kr)`, when `expr` is `g(kr)/r` with that `g` and `k > 0`. */
function scaledOverR(ce: ComputeEngine, expr: BoxedExpression, r: string, head: "Erfc" | "ExpIntegralE") {
  const g = dividedByT(ce, expr, r);
  if (g === undefined || g.operator !== head) return undefined;
  const ops = operandsOf(g);
  if (head === "ExpIntegralE" && !(ops.length === 2 && ops[0]!.re === 1 && ops[0]!.im === 0)) return undefined;
  const k = linearCoeffSigned(ce, ops[ops.length - 1]!, r);
  return k !== undefined && k.isPositive === true ? k : undefined;
}

/** `(1 - e^(-m r)) / r^2` for m > 0: returns m. */
function decayDefectOverRSquared(ce: ComputeEngine, expr: BoxedExpression, r: string): BoxedExpression | undefined {
  const { numer, denom } = fractionFactors(expr);
  const isR = (f: { base: BoxedExpression }) => isSym(f.base, r);
  const rFactors = [...numer.filter(isR).map((f) => -f.power), ...denom.filter(isR).map((f) => f.power)];
  const rest = [...numer.filter((f) => !isR(f)), ...denom.filter((f) => !isR(f))];
  if (
    rFactors.length !== 1 ||
    rFactors[0] !== 2 ||
    numer.filter((f) => !isR(f)).length !== 1 ||
    denom.some((f) => !isR(f))
  ) {
    return undefined;
  }
  const bracket = rest[0]!;
  if (bracket.power !== 1 || bracket.base.operator !== "Add") return undefined;
  const terms = operandsOf(bracket.base);
  const one = terms.find((o) => o.re === 1 && o.im === 0);
  const decay = terms.find((o) => o !== one);
  if (terms.length !== 2 || one === undefined || decay === undefined) return undefined;
  const e = decay.operator === "Negate" ? opAt(decay, 0) : undefined;
  if (e === undefined || e.operator !== "Power" || !isE(opAt(e, 0))) return undefined;
  const k = linearCoeffSigned(ce, opAt(e, 1), r);
  if (k === undefined || k.isNegative !== true) return undefined;
  return ce.function("Negate", [k]).evaluate();
}

/** `ln(1 + a^2/r^2)`: returns `a`. */
function logOnePlusRatio(ce: ComputeEngine, expr: BoxedExpression, r: string): BoxedExpression | undefined {
  if (expr.operator !== "Ln" || opAt(expr, 0).operator !== "Add") return undefined;
  const terms = operandsOf(opAt(expr, 0));
  const one = terms.find((o) => o.re === 1 && o.im === 0);
  const ratio = terms.find((o) => o !== one);
  if (terms.length !== 2 || one === undefined || ratio === undefined) return undefined;
  const { numer, denom } = fractionFactors(ratio);
  const free = numer.filter((f) => !hasVar(f.base, r));
  const onlyR = denom.length === 1 && isSym(denom[0]!.base, r) && denom[0]!.power === 2 && numer.length === 1;
  if (!onlyR || free.length !== 1 || free[0]!.power !== 2) return undefined;
  return free[0]!.base;
}

/** `sin(a r)/r` or `cos(a r)/r` for a real, nonzero `a`: a `Piecewise` in `s`, on either side of `|a|`. */
function trigOverR(
  ce: ComputeEngine,
  expr: BoxedExpression,
  r: string,
  s: BoxedExpression,
): BoxedExpression | undefined {
  const g = dividedByT(ce, expr, r);
  if (g === undefined || (g.operator !== "Sin" && g.operator !== "Cos")) return undefined;
  const a = linearCoeffSigned(ce, opAt(g, 0), r);
  if (a === undefined || (a.isPositive !== true && a.isNegative !== true)) return undefined;
  const k = a.isPositive === true ? a : ce.function("Negate", [a]).evaluate();
  const kSquared = ce.function("Power", [k, 2]);
  const sSquared = ce.function("Power", [s, 2]);
  const below = ce.function("Less", [s, k]);
  const above = ce.function("Greater", [s, k]);
  const root = (radicand: BoxedExpression) => ce.function("Power", [radicand, ce.number([-1, 2])]);
  const signed = (value: BoxedExpression) => (a.isPositive === true ? value : ce.function("Negate", [value]));
  const clauses =
    g.operator === "Sin"
      ? [
          [signed(root(ce.function("Subtract", [kSquared, sSquared]))), below],
          [ce.Zero, above],
        ]
      : [
          [ce.Zero, below],
          [root(ce.function("Subtract", [sSquared, kSquared])), above],
        ];
  const value = ce
    .function("Piecewise", [
      ce.function(
        "List",
        clauses.map(([value, condition]) => ce.function("List", [value!, condition!])),
      ),
      ce.symbol("Indeterminate"),
    ])
    .evaluate();
  // s = |a| diverges; hold the call there, as Wolfram does, rather than answer Indeterminate.
  return value.operator === "Indeterminate" ? undefined : value;
}

function hankelPairs(
  ce: ComputeEngine,
  expr: BoxedExpression,
  r: string,
  s: BoxedExpression,
): BoxedExpression | undefined {
  const erfcK = scaledOverR(ce, expr, r, "Erfc");
  if (erfcK !== undefined) {
    const half = ce.function("Divide", [s, ce.function("Multiply", [2, erfcK])]);
    return ce.function("Divide", [ce.function("Erf", [half]), s]).evaluate();
  }
  const e1K = scaledOverR(ce, expr, r, "ExpIntegralE");
  if (e1K !== undefined) {
    return ce.function("Divide", [ce.function("Arsinh", [ce.function("Divide", [s, e1K])]), s]).evaluate();
  }
  const m = decayDefectOverRSquared(ce, expr, r);
  if (m !== undefined && m.isPositive === true) {
    return ce.function("Arsinh", [ce.function("Divide", [m, s])]).evaluate();
  }
  const a = logOnePlusRatio(ce, expr, r);
  if (a !== undefined) {
    const u = ce.function("Multiply", [a.isPositive === true ? a : ce.function("Abs", [a]), s]);
    const bracket = ce.function("Add", [
      1,
      ce.function("Negate", [ce.function("Multiply", [u, ce.function("BesselK", [1, u])])]),
    ]);
    return ce.function("Divide", [ce.function("Multiply", [2, bracket]), ce.function("Power", [s, 2])]).evaluate();
  }
  return undefined;
}

export function matchHankel(
  ce: ComputeEngine,
  expr: BoxedExpression,
  r: BoxedExpression,
  s: BoxedExpression,
  order: BoxedExpression | undefined,
): BoxedExpression | undefined {
  const rName = symbolNameOf(r);
  if (rName === undefined || !hasVar(expr, rName)) return undefined;
  if (order === undefined || (order.re === 0 && order.im === 0)) {
    return (
      atomicHankelOrder0(ce, expr, rName, s) ??
      hankelOverR(ce, expr, rName, s) ??
      trigOverR(ce, expr, rName, s) ??
      hankelPairs(ce, expr, rName, s)
    );
  }
  if (order.re === 1 && order.im === 0) return atomicHankelOrder1(ce, expr, rName, s);
  // Any other order: only the n-independent `1/r -> 1/s` identity is elementary
  // (needs n > -1/2 for convergence — checked when `order` carries enough sign
  // information; a fully unconstrained symbolic order declines).
  if (isReciprocalOfR(expr, rName) && (order.isPositive === true || order.isNonNegative === true)) {
    return ce.function("Power", [s, -1]).evaluate();
  }
  return undefined;
}

export function declareHankelTransform(ce: ComputeEngine): void {
  ce.declare("HankelTransform", {
    signature: "(expression, expression, expression, number?) -> expression",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [f, r, s, n] = ops;
      if (f === undefined || r === undefined || s === undefined || ops.length > 4) return undefined;
      return matchHankel(ce, f, r, s, n);
    },
  });
}
