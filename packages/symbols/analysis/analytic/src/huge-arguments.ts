import { type BoxedExpression, type ComputeEngine, isNumber } from "@cortex-js/compute-engine";
import { wrapOperator } from "@enumeratio/boxed";
import type { Json } from "./bernoulli.ts";
import { type BoxInput, wantsNumber } from "./box.ts";
import { withGuardDigits } from "./precise.ts";

// ln Γ(x) and ln G(x) for a real x past a double's range, where the double kernels have
// nothing to work with. Both asymptotic series converge absurdly fast out here, so a few
// terms carry every digit the engine asks for, in its own decimal arithmetic.

const isHuge = (op: BoxedExpression | undefined): boolean =>
  op !== undefined &&
  isNumber(op) &&
  op.im === 0 &&
  op.re === Infinity &&
  op.bignumRe?.isFinite() === true;

/** lnΓ(x) = (x − ½)ln x − x + ½ln 2π + 1/(12x) − 1/(360x³) + 1/(1260x⁵). */
const logGammaSeries = (x: Json): Json => [
  "Add",
  ["Multiply", ["Subtract", x, ["Rational", 1, 2]], ["Ln", x]],
  ["Negate", x],
  ["Divide", ["Ln", ["Multiply", 2, "Pi"]], 2],
  ["Divide", 1, ["Multiply", 12, x]],
  ["Negate", ["Divide", 1, ["Multiply", 360, ["Power", x, 3]]]],
  ["Divide", 1, ["Multiply", 1260, ["Power", x, 5]]],
];

/** ln G(z + 1) = (z²/2 − 1/12)ln z − 3z²/4 + (z/2)ln 2π + 1/12 − ln A, to O(1/z²). */
const logBarnesGSeries = (x: Json): Json => {
  const z: Json = ["Subtract", x, 1];
  return [
    "Add",
    ["Multiply", ["Subtract", ["Divide", ["Power", z, 2], 2], ["Rational", 1, 12]], ["Ln", z]],
    ["Multiply", ["Rational", -3, 4], ["Power", z, 2]],
    ["Multiply", ["Divide", z, 2], ["Ln", ["Multiply", 2, "Pi"]]],
    ["Rational", 1, 12],
    ["Negate", ["Ln", "ConstGlaisher"]],
  ];
};

const SERIES: Readonly<Record<string, (x: Json) => Json>> = {
  LogGamma: logGammaSeries,
  GammaLn: logGammaSeries,
  LogBarnesG: logBarnesGSeries,
};

export function declareHugeArguments(ce: ComputeEngine): void {
  for (const [head, series] of Object.entries(SERIES)) {
    wrapOperator(
      ce,
      [head, 1],
      (ops) => isHuge(ops[0]),
      (native) => (ops, options) => {
        if (!wantsNumber(ops, options)) return native?.(ops, options);
        const expr = ce.box(series(ops[0]!.json as unknown as Json) as unknown as BoxInput);
        return withGuardDigits(ce, () => expr.N());
      },
      1,
    );
  }
}
