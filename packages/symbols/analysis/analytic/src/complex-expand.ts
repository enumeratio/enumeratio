import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import type { EvalOptions } from "./box.ts";

// ComplexExpand(expr) — split `expr` into real and imaginary parts, treating every free
// symbol as real: `ComplexExpand(f(x + iy))` becomes `Re + i·Im` with `x, y` kept symbolic.
// A concrete numeric argument (no free symbols at all) needs none of this: plain evaluation
// already gives the same real/imaginary split (`Exp(iπ/5)` is already the exact radical form
// — see the last example), so this only has real work to do on a symbolic argument.
//
// `splitRI` walks the expression bottom-up, tracking a `{re, im}` pair at every node:
//  - a concrete complex number (including `ImaginaryUnit`, whose value is 0+1i) is atomic;
//  - `Add` and `Multiply` combine child `{re, im}` pairs the way complex addition and
//    multiplication do (`Negate` and integer `Power` fall out of those two);
//  - `Sin(a+bi) = sin(a)cosh(b) + i·cos(a)sinh(b)`, `Exp(a+bi) = e^a cos(b) + i·e^a sin(b)`
//    (`Exp` canonicalizes to `Power(E, ·)`, so that's what's actually matched), and
//    `Abs(a+bi) = sqrt(a²+b²)` are the transcendental identities the backlog's examples need;
//  - anything else is assumed real (`{re: expr, im: 0}`) — the same default Wolfram's own
//    `ComplexExpand` takes for a symbol with no declared domain.
//
// Only these heads are covered; `Cos`, the hyperbolic functions, and general non-integer
// powers of a complex argument have no rule here and fall through to "assumed real", which is
// wrong for them specifically — out of scope beyond what the backlog examples exercise.

interface RealImaginary {
  readonly re: BoxedExpression;
  readonly im: BoxedExpression;
}

const add = (ce: ComputeEngine, a: BoxedExpression, b: BoxedExpression) =>
  ce.function("Add", [a, b]).evaluate();
const sub = (ce: ComputeEngine, a: BoxedExpression, b: BoxedExpression) =>
  ce.function("Subtract", [a, b]).evaluate();
const mul = (ce: ComputeEngine, a: BoxedExpression, b: BoxedExpression) =>
  ce.function("Multiply", [a, b]).evaluate();

/** (a+bi)(c+di) = (ac−bd) + (ad+bc)i. */
const complexMul = (ce: ComputeEngine, a: RealImaginary, b: RealImaginary): RealImaginary => ({
  re: sub(ce, mul(ce, a.re, b.re), mul(ce, a.im, b.im)),
  im: add(ce, mul(ce, a.re, b.im), mul(ce, a.im, b.re)),
});

function splitRI(ce: ComputeEngine, e: BoxedExpression): RealImaginary {
  // A concrete PURE-IMAGINARY number is atomic — no `.ops` to recurse into — but it can be an
  // exact irrational (`Complex(0, √2/4)`, from folding a literal `i` factor into a numeric
  // coefficient; see exp-to-trig.ts for the same fold). Divide back out by `ImaginaryUnit`
  // rather than reading `.im` as a float, which would lose that exactness.
  if (e.re === 0 && e.im !== 0 && Number.isFinite(e.im)) {
    return { re: ce.Zero, im: ce.function("Divide", [e, ce.symbol("ImaginaryUnit")]).evaluate() };
  }
  // A fully general atomic complex number (both parts nonzero) has no exact-preserving split
  // available generically; no example needs one, so this is the one place a float is used.
  if (Number.isFinite(e.re) && Number.isFinite(e.im) && e.im !== 0) {
    return { re: ce.number(e.re), im: ce.number(e.im) };
  }
  const ops = operandsOf(e);
  if (e.operator === "Add" && ops.length > 0) {
    return ops.reduce<RealImaginary>(
      (acc, op) => {
        const p = splitRI(ce, op);
        return { re: add(ce, acc.re, p.re), im: add(ce, acc.im, p.im) };
      },
      { re: ce.Zero, im: ce.Zero },
    );
  }
  if (e.operator === "Negate" && ops.length > 0) {
    const p = splitRI(ce, ops[0]);
    return {
      re: ce.function("Negate", [p.re]).evaluate(),
      im: ce.function("Negate", [p.im]).evaluate(),
    };
  }
  if (e.operator === "Multiply" && ops.length > 0) {
    return ops.reduce<RealImaginary>((acc, op) => complexMul(ce, acc, splitRI(ce, op)), {
      re: ce.One,
      im: ce.Zero,
    });
  }
  // Exp(z) canonicalizes to Power(E, z) before any hook sees an "Exp" head (see around.ts and
  // matrix-function.ts for the same gotcha): e^(a+bi) = e^a·cos(b) + i·e^a·sin(b).
  if (e.operator === "Power" && ops.length === 2 && ops[0].isSame(ce.E)) {
    const { re: a, im: b } = splitRI(ce, ops[1]);
    const ea = ce.function("Exp", [a]).evaluate();
    return {
      re: mul(ce, ea, ce.function("Cos", [b]).evaluate()),
      im: mul(ce, ea, ce.function("Sin", [b]).evaluate()),
    };
  }
  if (
    e.operator === "Power" &&
    ops.length === 2 &&
    ops[1].im === 0 &&
    Number.isInteger(ops[1].re)
  ) {
    const n = ops[1].re;
    if (n >= 0) {
      const base = splitRI(ce, ops[0]);
      let acc: RealImaginary = { re: ce.One, im: ce.Zero };
      for (let i = 0; i < n; i++) acc = complexMul(ce, acc, base);
      return acc;
    }
  }
  if (e.operator === "Sin" && ops.length > 0) {
    const { re: a, im: b } = splitRI(ce, ops[0]);
    return {
      re: mul(ce, ce.function("Sin", [a]).evaluate(), ce.function("Cosh", [b]).evaluate()),
      im: mul(ce, ce.function("Cos", [a]).evaluate(), ce.function("Sinh", [b]).evaluate()),
    };
  }
  if (e.operator === "Abs" && ops.length > 0) {
    const { re: a, im: b } = splitRI(ce, ops[0]);
    return {
      re: ce.function("Sqrt", [add(ce, mul(ce, a, a), mul(ce, b, b))]).evaluate(),
      im: ce.Zero,
    };
  }
  return { re: e, im: ce.Zero }; // assumed real — see the file header
}

export function evaluateComplexExpand(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
): BoxedExpression | undefined {
  const expr = ops[0];
  if (expr === undefined) return undefined;
  // An argument with no free structure (a concrete number, possibly already the exact
  // radical form a numeric Exp/Sin/etc. reduced to on its own) has nothing left to split —
  // splitRI's `.re`/`.im` numeric round trip would just lose exactness on an irrational one.
  if (operandsOf(expr).length === 0) return expr;
  const { re, im } = splitRI(ce, expr);
  if (im.isSame(0)) return re;
  return ce
    .function("Add", [re, ce.function("Multiply", [ce.symbol("ImaginaryUnit"), im])])
    .evaluate();
}

export function declareComplexExpand(ce: ComputeEngine): void {
  ce.declare("ComplexExpand", {
    signature: "(value) -> value",
    evaluate: (ops: readonly BoxedExpression[], _options: EvalOptions) =>
      evaluateComplexExpand(ce, ops),
  });
}
