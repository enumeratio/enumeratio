import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, symbolNameOf, wrapOperator } from "@enumeratio/boxed";

// Wolfram folds Floor/Ceil/Round of an exact numeric constant expression -- Pi, E, a
// sum/product/logarithm of them -- by evaluating it to enough precision and rounding;
// compute-engine's native handlers only fold at a plain float or exact rational and
// leave a symbolic constant like Pi as is. Floor/Ceil/Round are also idempotent, Max
// and Min drop an exactly-repeated argument (and compare a list of exact constants
// numerically), and IsOdd is False at a non-integer exact constant. Declared by
// `declareAnalytic`.

const KNOWN_CONSTANTS = new Set([
  "Pi",
  "ExponentialE",
  "EulerGamma",
  "GoldenRatio",
  "Catalan",
  "MachineEpsilon",
]);

// Operators an exact-constant expression can be built from. Compute-engine has already
// evaluated every purely-numeric subexpression by the time a wrapped operator's `evaluate`
// runs, so a surviving Add/Multiply/etc. means some operand didn't reduce to a number --
// either a free variable or one of these irrational constants. The cheap check below
// (operator, and for a bare symbol its name) can't tell those apart; the handler settles
// it with a single N() and declines (returns undefined, same as the native handler would)
// when that isn't finite.
const CONSTANT_HEADS = new Set([
  "Negate",
  "Add",
  "Subtract",
  "Multiply",
  "Divide",
  "Power",
  "Sqrt",
  "Log",
]);

/** O(1): reads only `operator`, and for a bare symbol its `symbol` name. */
function looksConstant(op: BoxedExpression): boolean {
  if (op.operator === "Symbol") return KNOWN_CONSTANTS.has(symbolNameOf(op) ?? "");
  return CONSTANT_HEADS.has(op.operator ?? "");
}

function declareRoundingHead(
  ce: ComputeEngine,
  name: "Floor" | "Ceil" | "Round",
  round: (x: number) => number,
): void {
  // Idempotent: Floor(Floor(x)) = Floor(x), for whatever x -- the inner value is
  // already an integer (or stays symbolic, in which case nothing changes either way).
  wrapOperator(
    ce,
    [name, 1],
    (ops) => ops.length === 1 && ops[0]?.operator === name,
    () => (ops) => ops[0],
  );
  // An exact constant expression: evaluate it numerically and round that.
  wrapOperator(
    ce,
    [name, 1],
    (ops) => ops.length === 1 && ops[0] !== undefined && looksConstant(ops[0]),
    () => (ops) => {
      const n = ops[0]!.N();
      if (n.im !== 0 || !Number.isFinite(n.re)) return undefined;
      return ce.number(round(n.re));
    },
  );
}

/** Round half away from zero, matching this reference's own Round convention. */
const roundHalfAway = (x: number): number => (x >= 0 ? Math.floor(x + 0.5) : Math.ceil(x - 0.5));

/** The pool Max/Min compare: a single List argument's elements, or the bare arguments. */
function pool(ops: readonly BoxedExpression[]): readonly BoxedExpression[] {
  return ops.length === 1 && ops[0]?.operator === "List" ? operandsOf(ops[0]) : ops;
}

function declareExtremum(
  ce: ComputeEngine,
  name: "Max" | "Min",
  better: (a: number, b: number) => boolean,
): void {
  // Idempotent: repeated identical arguments collapse to one, e.g. Max(x, x) = x.
  // `isSame` is a structural (non-evaluating) compare, cheap on the common case of
  // two distinct numbers or symbols.
  wrapOperator(
    ce,
    [name, 2],
    (ops) => ops.length >= 2 && ops.every((op) => op === ops[0] || op.isSame(ops[0])),
    () => (ops) => ops[0],
  );
  // A pool of exact constants (Pi, E, ...): compare numerically, keep the exact form.
  wrapOperator(
    ce,
    [name, 1],
    (ops) => {
      const items = pool(ops);
      return items.length >= 2 && items.some(looksConstant);
    },
    () => (ops) => {
      const items = pool(ops);
      let best: { op: BoxedExpression; v: number } | undefined;
      for (const op of items) {
        const n = op.N();
        if (n.im !== 0 || !Number.isFinite(n.re)) return undefined;
        if (best === undefined || better(n.re, best.v)) best = { op, v: n.re };
      }
      return best?.op;
    },
  );
}

export function declareConstantRounding(ce: ComputeEngine): void {
  declareRoundingHead(ce, "Floor", Math.floor);
  declareRoundingHead(ce, "Ceil", Math.ceil);
  declareRoundingHead(ce, "Round", roundHalfAway);
  declareExtremum(ce, "Max", (a, b) => a > b);
  declareExtremum(ce, "Min", (a, b) => a < b);

  // IsOdd(Pi) etc: a non-integer exact constant is never odd.
  wrapOperator(
    ce,
    ["IsOdd", 1],
    (ops) => ops.length === 1 && ops[0] !== undefined && looksConstant(ops[0]),
    () => (ops) => {
      const n = ops[0]!.N();
      if (n.im !== 0 || !Number.isFinite(n.re) || Number.isInteger(n.re)) return undefined;
      return ce.False;
    },
  );
}
