import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  integerAt,
  operandsOf,
  symbolNameOf,
  widenSignature,
  wrapOperator,
} from "@enumeratio/boxed";

// Heads that take or build with a FUNCTION argument (Nest, NestList, FixedPoint, Outer,
// RecurrenceTable), two heads that generate exact recurrence sequences (LinearRecurrence,
// RecurrenceTable), a minimal Association, and two means that are Power/Divide in a coat.
//
// None of these exist on compute-engine except FixedPoint, which it declares as a 1-ary
// stub with no `evaluate` (any call to it errors) — `widenSignature` + `wrapOperator` extend
// that definition in place rather than redeclaring it, per the rule for a head CE already
// has under the same name.

/** `f(args...)`, via compute-engine's own `Apply` head — which, unlike Wolfram's `Apply`,
 *  treats every trailing operand as its own positional argument rather than unpacking a
 *  single list: `Apply(f, a, b)` is `f(a, b)`, not `f @@ {a, b}`. Works for an undeclared
 *  symbol `f` too (stays an unevaluated call), a `Function` literal, or anything else
 *  `Apply` already knows how to invoke. */
const applyFn = (
  ce: ComputeEngine,
  fn: BoxedExpression,
  args: readonly BoxedExpression[],
): BoxedExpression => ce.function("Apply", [fn, ...args]).evaluate();

function nestValue(
  ce: ComputeEngine,
  fn: BoxedExpression,
  x: BoxedExpression,
  n: number,
): BoxedExpression {
  let current = x;
  for (let i = 0; i < n; i++) current = applyFn(ce, fn, [current]);
  return current;
}

function nestListValues(
  ce: ComputeEngine,
  fn: BoxedExpression,
  x: BoxedExpression,
  n: number,
): BoxedExpression {
  const items: BoxedExpression[] = [x];
  let current = x;
  for (let i = 0; i < n; i++) {
    current = applyFn(ce, fn, [current]);
    items.push(current);
  }
  return ce.box(["List", ...items]);
}

/** Caps a `FixedPoint` that never settles — an infinite loop otherwise, since nothing else
 *  bounds the iteration. Wolfram's own default cap is $MaxIterations (a much larger,
 *  configurable number); ours is fixed and unconfigurable, which is the scope this backlog
 *  entry asked for. */
const FIXED_POINT_MAX_ITERATIONS = 10_000;

function fixedPointValue(
  ce: ComputeEngine,
  fn: BoxedExpression,
  x: BoxedExpression,
): BoxedExpression {
  let current = x;
  for (let i = 0; i < FIXED_POINT_MAX_ITERATIONS; i++) {
    const next = applyFn(ce, fn, [current]);
    if (next.isEqual(current) === true) return next;
    current = next;
  }
  return current;
}

/** The sequence a_1, a_2, … up to (at least) index `upTo`, given `kernel` (c_1 .. c_k, so
 *  a_i = c_1 a_{i-1} + … + c_k a_{i-k} for i past the seed) and `init` (a_1 .. a_k). Every
 *  step goes through compute-engine's own Add/Multiply, so an exact rational seed and
 *  kernel stay exact all the way out — never floating point. */
function linearRecurrenceValues(
  ce: ComputeEngine,
  kernel: readonly BoxedExpression[],
  init: readonly BoxedExpression[],
  upTo: number,
): BoxedExpression[] {
  const seq: BoxedExpression[] = [...init];
  const k = kernel.length;
  for (let i = seq.length; i < upTo; i++) {
    let term: BoxedExpression = ce.Zero;
    for (let j = 0; j < k; j++) {
      const prev = seq[i - 1 - j];
      if (prev === undefined) break;
      term = ce.function("Add", [term, ce.function("Multiply", [kernel[j], prev])]).evaluate();
    }
    seq.push(term);
  }
  return seq;
}

/** Whether `expr` mentions the symbol `name` anywhere in its tree. */
function mentionsSymbol(expr: BoxedExpression, name: string): boolean {
  if (symbolNameOf(expr) === name) return true;
  return operandsOf(expr).some((op) => mentionsSymbol(op, name));
}

/**
 * Rewrite `expr` with the iteration symbol `nSym` replaced by the number `nVal`, and every
 * call to `headName` (the recurrence's function, e.g. `a`) replaced by `computeAt` of its
 * (by-then-numeric) index — recursively resolving the recurrence rather than leaving it as
 * an inert symbolic call, which is the whole reason RecurrenceTable can't just be
 * `ce.box(expr).subs(...).evaluate()`: `a` is never a declared compute-engine head.
 */
function resolveAt(
  ce: ComputeEngine,
  expr: BoxedExpression,
  nSym: string,
  nVal: number,
  headName: string,
  computeAt: (index: number) => BoxedExpression,
): BoxedExpression {
  const operands = operandsOf(expr);
  if (expr.operator === headName && operands.length === 1) {
    const indexValue = resolveAt(ce, operands[0], nSym, nVal, headName, computeAt);
    const index = integerAt(indexValue);
    if (index === undefined) {
      throw new Error(`RecurrenceTable: non-integer index into ${headName}`);
    }
    return computeAt(index);
  }
  if (symbolNameOf(expr) === nSym) return ce.number(nVal);
  if (operands.length === 0) return expr;
  return ce
    .function(
      expr.operator,
      operands.map((op) => resolveAt(ce, op, nSym, nVal, headName, computeAt)),
    )
    .evaluate();
}

/** Declare the function-taking, recurrence, association and mean heads new to this backlog
 *  wave: Nest, NestList, FixedPoint (extended, not redeclared — see module doc), Outer,
 *  LinearRecurrence, RecurrenceTable, Association, GeometricMean, HarmonicMean. */
export function declareListFunctional(ce: ComputeEngine): void {
  ce.declare("Nest", {
    signature: "(function: any, x: any, n: integer) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [fn, x, nOp] = ops;
      const n = integerAt(nOp);
      if (fn === undefined || x === undefined || n === undefined || n < 0) return undefined;
      return nestValue(ce, fn, x, n);
    },
  });

  ce.declare("NestList", {
    signature: "(function: any, x: any, n: integer) -> list<any>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [fn, x, nOp] = ops;
      const n = integerAt(nOp);
      if (fn === undefined || x === undefined || n === undefined || n < 0) return undefined;
      return nestListValues(ce, fn, x, n);
    },
  });

  // FixedPoint(f, x): compute-engine already declares the head (a lazy 1-ary stub with no
  // `evaluate`, so any call to it errors) — widen its signature to the 2-ary form and wrap
  // it with the actual iteration, rather than redeclaring and losing whatever else its
  // definition carries.
  widenSignature(ce, "FixedPoint", "(function: any, x: any) -> any");
  wrapOperator(
    ce,
    ["FixedPoint", 1, 1],
    (ops) => ops.length === 2,
    () => (ops) => fixedPointValue(ce, ops[0], ops[1]),
  );

  ce.declare("Outer", {
    signature: "(function: any, list<any>, list<any>) -> list<list<any>>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [fn, list1, list2] = ops;
      if (fn === undefined || list1 === undefined || list2 === undefined) return undefined;
      const rows2 = operandsOf(list2);
      const rows = operandsOf(list1).map((a) =>
        ce.box(["List", ...rows2.map((b) => applyFn(ce, fn, [a, b]))]),
      );
      return ce.box(["List", ...rows]);
    },
  });

  ce.declare("LinearRecurrence", {
    signature: "(kernel: list<any>, init: list<any>, n: any) -> list<any>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const kernel = operandsOf(ops[0]);
      const init = operandsOf(ops[1]);
      const nSpec = ops[2];
      if (kernel.length === 0 || init.length === 0 || nSpec === undefined) return undefined;

      if (nSpec.operator === "List") {
        const specOps = operandsOf(nSpec);
        if (specOps.length === 1) {
          const m = integerAt(specOps[0]);
          if (m === undefined || m < 1) return undefined;
          const seq = linearRecurrenceValues(ce, kernel, init, m);
          return ce.box(["List", seq[m - 1]]);
        }
        if (specOps.length === 2) {
          const start = integerAt(specOps[0]);
          const end = integerAt(specOps[1]);
          if (start === undefined || end === undefined || start < 1 || end < start) {
            return undefined;
          }
          const seq = linearRecurrenceValues(ce, kernel, init, end);
          return ce.box(["List", ...seq.slice(start - 1, end)]);
        }
        return undefined;
      }

      const n = integerAt(nSpec);
      if (n === undefined || n < 0) return undefined;
      const seq = linearRecurrenceValues(ce, kernel, init, n);
      return ce.box(["List", ...seq.slice(0, n)]);
    },
  });

  // RecurrenceTable(eqns, a, [n, nmin, nmax]): `eqns` is a mix of literal-index equations
  // (initial conditions, `a(1) = 7`) and exactly one generic equation whose index mentions
  // `n` (`a(n + 1) = 3 a(n)`, or plainly `a(n) = a(n - 1) + a(n - 2)`) — only one generic
  // equation is supported, which is every case in the examples and the common one in
  // practice (a single recurrence order, not a piecewise definition).
  ce.declare("RecurrenceTable", {
    signature: "(eqns: list<any>, a: any, spec: list<any>) -> list<any>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const eqns = operandsOf(ops[0]);
      const headName = symbolNameOf(ops[1]);
      const spec = ops[2];
      if (headName === undefined || spec === undefined || spec.operator !== "List") {
        return undefined;
      }
      const specOps = operandsOf(spec);
      const nSym = symbolNameOf(specOps[0]);
      const nMin = integerAt(specOps[1]);
      const nMax = integerAt(specOps[2]);
      if (nSym === undefined || nMin === undefined || nMax === undefined) return undefined;

      let general: { indexExpr: BoxedExpression; rhs: BoxedExpression } | undefined;
      const initial = new Map<number, BoxedExpression>();
      for (const eqn of eqns) {
        if (eqn.operator !== "Equal") return undefined;
        const [lhs, rhs] = operandsOf(eqn);
        if (lhs === undefined || rhs === undefined || lhs.operator !== headName) return undefined;
        const indexExpr = operandsOf(lhs)[0];
        if (indexExpr === undefined) return undefined;
        if (mentionsSymbol(indexExpr, nSym)) {
          if (general !== undefined) return undefined; // more than one generic equation
          general = { indexExpr, rhs };
        } else {
          const index = integerAt(indexExpr.evaluate());
          if (index === undefined) return undefined;
          initial.set(index, rhs.evaluate());
        }
      }
      if (general === undefined) return undefined;
      const { indexExpr, rhs } = general;

      try {
        // The offset between the equation's own index and the plain iteration count: for
        // `a(n + 1) = …` that's 1 (evaluate the index expression at n = 0); for `a(n) = …`
        // it's 0.
        const offset = integerAt(resolveAt(ce, indexExpr, nSym, 0, headName, () => ce.Zero));
        if (offset === undefined) return undefined;

        const memo = new Map<number, BoxedExpression>(initial);
        const computeAt = (index: number): BoxedExpression => {
          const cached = memo.get(index);
          if (cached !== undefined) return cached;
          const value = resolveAt(ce, rhs, nSym, index - offset, headName, computeAt);
          memo.set(index, value);
          return value;
        };

        const values: BoxedExpression[] = [];
        for (let i = nMin; i <= nMax; i++) values.push(computeAt(i));
        return ce.box(["List", ...values]);
      } catch {
        return undefined;
      }
    },
  });

  // Association(k1 -> v1, …): a minimal key -> value map, kept as its own operator over
  // `Rule` pairs rather than compute-engine's `Dictionary` — Dictionary's keys are strings
  // only (`Record<string, DictionaryValue>`, boxed from `["Dictionary", ["KeyValuePair",
  // ...], ...]`), and every example here keys on a plain number. First/Last/Length/Join/Sort
  // are extended for it below, each falling through to its list handling otherwise.
  ce.declare("Association", {
    signature: "(rules: any*) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression => ce.box(["Association", ...ops]),
  });

  const isAssociation = (ops: readonly BoxedExpression[]): boolean =>
    ops[0]?.operator === "Association";

  wrapOperator(
    ce,
    ["Length", 1],
    (ops) => ops.length === 1 && isAssociation(ops),
    () => (ops) => ce.number(operandsOf(ops[0]).length),
  );

  wrapOperator(ce, ["First", 1, 1], isAssociation, () => (ops) => {
    const first = operandsOf(ops[0])[0];
    return first === undefined ? undefined : operandsOf(first)[1];
  });

  wrapOperator(ce, ["Last", 1, 1], isAssociation, () => (ops) => {
    const rules = operandsOf(ops[0]);
    const last = rules[rules.length - 1];
    return last === undefined ? undefined : operandsOf(last)[1];
  });

  wrapOperator(
    ce,
    ["Join", 1, 1],
    (ops) => ops.length >= 2 && ops.every((op) => op.operator === "Association"),
    () => (ops) => {
      const order: string[] = [];
      const keyExprs = new Map<string, BoxedExpression>();
      const values = new Map<string, BoxedExpression>();
      for (const assoc of ops) {
        for (const rule of operandsOf(assoc)) {
          const [key, value] = operandsOf(rule);
          if (key === undefined || value === undefined) continue;
          const keyId = JSON.stringify(key.json);
          if (!values.has(keyId)) order.push(keyId);
          keyExprs.set(keyId, key);
          values.set(keyId, value);
        }
      }
      return ce.box([
        "Association",
        ...order.map((keyId) => ce.box(["Rule", keyExprs.get(keyId)!, values.get(keyId)!])),
      ]);
    },
  );

  // Ascending order BY VALUE, the way Wolfram's Sort orders an Association — plain
  // `isLess`/`isGreater`, which is all the (numeric) examples need.
  wrapOperator(
    ce,
    ["Sort", 1],
    (ops) => ops.length === 1 && isAssociation(ops),
    () => (ops) => {
      const sorted = [...operandsOf(ops[0])].sort((ruleA, ruleB) => {
        const valueA = operandsOf(ruleA)[1];
        const valueB = operandsOf(ruleB)[1];
        if (valueA === undefined || valueB === undefined) return 0;
        if (valueA.isLess(valueB) === true) return -1;
        if (valueA.isGreater(valueB) === true) return 1;
        return 0;
      });
      return ce.box(["Association", ...sorted]);
    },
  );

  ce.declare("GeometricMean", {
    signature: "(collection<any>) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const items = operandsOf(ops[0]);
      if (items.length === 0) return undefined;
      const product = ce.function("Multiply", items).evaluate();
      return ce.function("Power", [product, ce.function("Rational", [1, items.length])]).evaluate();
    },
  });

  ce.declare("HarmonicMean", {
    signature: "(collection<any>) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const items = operandsOf(ops[0]);
      if (items.length === 0) return undefined;
      const reciprocalSum = ce
        .function(
          "Add",
          items.map((x) => ce.function("Divide", [ce.number(1), x])),
        )
        .evaluate();
      return ce.function("Divide", [ce.number(items.length), reciprocalSum]).evaluate();
    },
  });
}
