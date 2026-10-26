import {
  applyFunction,
  type Engine,
  type Expr,
  integerAt,
  operandsOf,
  symbolNameOf,
  wrapOperator,
} from "@enumeratio/engine";

// Heads that take or build with a FUNCTION argument (Nest, NestList, FixedPoint, Outer,
// RecurrenceTable), two heads that generate exact recurrence sequences (LinearRecurrence,
// RecurrenceTable), a minimal Association, and two means that are Power/Divide in a coat.
//
// None of these exist on compute-engine except FixedPoint, which `wrapOperator` extends.

/** Compute-engine answers a handful of heads (`Most`, `Rest`, `Take`, `Drop`, `Range`, …)
 *  entirely through the operator's lazy COLLECTION protocol, never through a value-returning
 *  `evaluate` — `.json` on the result of `Most(list).evaluate()` is still the unevaluated
 *  `Most(list)` call, even though it iterates, counts and prints correctly on its own.
 *  Reusing such a result as an operand of a NEW `ce.function`/`ce.box` call (exactly what
 *  `nestValue`/`nestListValues` below do, feeding one step's answer into the next, or into
 *  the accumulated `List`) rebuilds from that stale `.json` and reverts it right back to the
 *  unevaluated call. Forcing materialization here is the fix. */
function materialize(result: Expr): Expr {
  return result.isLazyCollection ? result.evaluate({ materialization: true }) : result;
}

/** `fn(args...)`, materialized: a lazy-collection result would revert to its unevaluated call
 *  when fed back in as an operand (see `materialize`). */
const callFn = (ce: Engine, fn: Expr, args: readonly Expr[]): Expr => materialize(applyFunction(ce, fn, args));

function nestValue(ce: Engine, fn: Expr, x: Expr, n: number): Expr {
  let current = x;
  for (let i = 0; i < n; i++) current = callFn(ce, fn, [current]);
  return current;
}

function nestListValues(ce: Engine, fn: Expr, x: Expr, n: number): Expr {
  // Materialize a lazy seed (e.g. `Range`) before it goes in the list — otherwise the
  // first element stays a `Range` recipe (`.ops` = its bounds) while every later element,
  // built by evaluating `fn`, is a real `List`, and anything reading the whole result
  // (`Transpose`, …) sees a ragged/mixed shape and bails.
  const seed = x.evaluate({ materialization: true });
  const items: Expr[] = [seed];
  let current = seed;
  for (let i = 0; i < n; i++) {
    current = callFn(ce, fn, [current]);
    items.push(current);
  }
  return ce.box(["List", ...items]);
}

/** Digits an inexact iteration carries past the engine's precision. The last step's error is a
 *  few times the stopping gap, so without them the last digit or two of the answer are wrong;
 *  rounding back from this many leaves every printed digit right. */
const FIXED_POINT_GUARD_DIGITS = 10;

const isInexact = (x: Expr): boolean => (x as unknown as { isExact?: boolean }).isExact === false;

/** Compute-engine's own `FixedPoint`, run with guard digits and rounded back to the engine's. */
function fixedPointValue(ce: Engine, native: () => Expr | undefined): Expr | undefined {
  const digits = ce.precision;
  if (typeof digits !== "number") return native();
  ce.precision = digits + FIXED_POINT_GUARD_DIGITS;
  let answer: Expr | undefined;
  try {
    answer = native();
  } finally {
    ce.precision = digits;
  }
  const big = answer?.bignumRe;
  // An exact, non-real or unevaluated answer needs no rounding; an inexact real is cut to the engine's digits.
  return answer === undefined || big === undefined || !isInexact(answer) || answer.im !== 0 || !big.isFinite()
    ? answer
    : ce.box({ num: big.toPrecision(digits).toString() } as never);
}

/** The sequence a_1, a_2, … up to (at least) index `upTo`, given `kernel` (c_1 .. c_k, so
 *  a_i = c_1 a_{i-1} + … + c_k a_{i-k} for i past the seed) and `init` (a_1 .. a_k). Every
 *  step goes through compute-engine's own Add/Multiply, so an exact rational seed and
 *  kernel stay exact all the way out — never floating point. */
function linearRecurrenceValues(ce: Engine, kernel: readonly Expr[], init: readonly Expr[], upTo: number): Expr[] {
  const seq: Expr[] = [...init];
  const k = kernel.length;
  for (let i = seq.length; i < upTo; i++) {
    let term: Expr = ce.Zero;
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
function mentionsSymbol(expr: Expr, name: string): boolean {
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
  ce: Engine,
  expr: Expr,
  nSym: string,
  nVal: number,
  headName: string,
  computeAt: (index: number) => Expr,
): Expr {
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
export function declareListFunctional(ce: Engine): void {
  ce.declare("Nest", {
    signature: "(function: any, x: any, n: integer) -> any",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const [fn, x, nOp] = ops;
      const n = integerAt(nOp);
      if (fn === undefined || x === undefined || n === undefined || n < 0) return undefined;
      return nestValue(ce, fn, x, n);
    },
  });

  ce.declare("NestList", {
    signature: "(function: any, x: any, n: integer) -> list<any>",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const [fn, x, nOp] = ops;
      const n = integerAt(nOp);
      if (fn === undefined || x === undefined || n === undefined || n < 0) return undefined;
      return nestListValues(ce, fn, x, n);
    },
  });

  // compute-engine iterates; this only gives an inexact iteration guard digits.
  wrapOperator(
    ce,
    ["FixedPoint", 1, 1],
    () => true,
    (native) => (ops, options) => fixedPointValue(ce, () => native?.(ops, options) ?? undefined),
    { min: 2, max: 3 },
  );

  ce.declare("Outer", {
    signature: "(function: any, list<any>, list<any>) -> list<any>",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const [fn, list1, list2] = ops;
      if (fn === undefined || list1 === undefined || list2 === undefined) return undefined;
      // A bare symbol isn't a list — `operandsOf` returning `[]` for it must not read as an
      // empty one (see `Accumulate`'s note in list-frontier.ts): `Outer(f, s1, s2)` for free
      // `s1`/`s2` stays unevaluated instead of answering `List()`.
      if (symbolNameOf(list1) !== undefined || symbolNameOf(list2) !== undefined) return undefined;
      // Down to the atoms of both, first operand's indices first: two matrices give a rank-4 array.
      const outer = (a: Expr, b: Expr): Expr =>
        a.operator === "List"
          ? ce.box(["List", ...operandsOf(a).map((x) => outer(x, b))])
          : b.operator === "List"
            ? ce.box(["List", ...operandsOf(b).map((y) => outer(a, y))])
            : callFn(ce, fn, [a, b]);
      return outer(list1, list2);
    },
  });

  ce.declare("LinearRecurrence", {
    signature: "(kernel: list<any>, init: list<any>, n: integer | list<integer>) -> list<any>",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
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
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
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

      let general: { indexExpr: Expr; rhs: Expr } | undefined;
      const initial = new Map<number, Expr>();
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

        const memo = new Map<number, Expr>(initial);
        const computeAt = (index: number): Expr => {
          const cached = memo.get(index);
          if (cached !== undefined) return cached;
          const value = resolveAt(ce, rhs, nSym, index - offset, headName, computeAt);
          memo.set(index, value);
          return value;
        };

        const values: Expr[] = [];
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
    signature: "(rules: expression<Rule>*) -> any",
    evaluate: (ops: readonly Expr[]): Expr => ce.box(["Association", ...ops]),
  });

  const isAssociation = (ops: readonly Expr[]): boolean => ops[0]?.operator === "Association";

  wrapOperator(
    ce,
    ["Length", 1],
    (ops) => isAssociation(ops),
    () => (ops) => ce.number(operandsOf(ops[0]).length),
    1,
  );

  // 1 or 2 arguments only: `First`/`Last` were widened (see list-heads.ts) to accept a
  // second, default-on-empty argument. Without the explicit length check here, isAssociation
  // alone would also swallow that 2-arg form but ignore the default, always answering with
  // the (nonexistent, on an empty association) first/last entry. The default can't just be
  // left to the generic `native` fallback the way the plain-List case is (list-heads.ts):
  // that fallback's non-empty branch re-invokes compute-engine's own First/Last, which
  // rejects an Association outright (`indexed_collection` typed, not `Association`) — so
  // the default logic is handled here instead, alongside the Association-specific read.
  wrapOperator(
    ce,
    ["First", 1, 1],
    (ops) => isAssociation(ops),
    () => (ops) => {
      const first = operandsOf(ops[0])[0];
      if (first !== undefined) return operandsOf(first)[1];
      return ops.length === 2 ? ops[1] : undefined;
    },
    { min: 1, max: 2 },
  );

  wrapOperator(
    ce,
    ["Last", 1, 1],
    (ops) => isAssociation(ops),
    () => (ops) => {
      const rules = operandsOf(ops[0]);
      const last = rules[rules.length - 1];
      if (last !== undefined) return operandsOf(last)[1];
      return ops.length === 2 ? ops[1] : undefined;
    },
    { min: 1, max: 2 },
  );

  wrapOperator(
    ce,
    ["Join", 1, 1],
    (ops) => ops.every((op) => op.operator === "Association"),
    () => (ops) => {
      const order: string[] = [];
      const keyExprs = new Map<string, Expr>();
      const values = new Map<string, Expr>();
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
    { min: 2 },
  );

  // Ascending order BY VALUE, the way Wolfram's Sort orders an Association — plain
  // `isLess`/`isGreater`, which is all the (numeric) examples need.
  wrapOperator(
    ce,
    ["Sort", 1],
    (ops) => isAssociation(ops),
    () => (ops) => {
      const sorted = [...operandsOf(ops[0])];
      sorted.sort((ruleA, ruleB) => {
        const valueA = operandsOf(ruleA)[1];
        const valueB = operandsOf(ruleB)[1];
        if (valueA === undefined || valueB === undefined) return 0;
        if (valueA.isLess(valueB) === true) return -1;
        if (valueA.isGreater(valueB) === true) return 1;
        return 0;
      });
      return ce.box(["Association", ...sorted]);
    },
    1,
  );

  // Total(list): the sum of the elements; a matrix totals column by column, as Wolfram's does.
  ce.declare("Total", {
    signature: "(collection<any>) -> any",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const list = ops[0];
      if (list === undefined || list.operator !== "List") return undefined;
      const items = operandsOf(list);
      const rows = items.every((item) => item.operator === "List") ? items.map(operandsOf) : undefined;
      if (rows !== undefined && rows.length > 0 && rows.every((row) => row.length === rows[0]!.length)) {
        const columns = rows[0]!.map((_, j) =>
          ce
            .function(
              "Add",
              rows.map((row) => row[j]!),
            )
            .evaluate(),
        );
        return ce.function("List", columns);
      }
      return ce.function("Add", items as Expr[]).evaluate();
    },
  });

  ce.declare("GeometricMean", {
    signature: "(collection<any>) -> number",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const items = operandsOf(ops[0]);
      if (items.length === 0) return undefined;
      const product = ce.function("Multiply", items).evaluate();
      return ce.function("Power", [product, ce.function("Rational", [1, items.length])]).evaluate();
    },
  });

  ce.declare("HarmonicMean", {
    signature: "(collection<any>) -> number",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
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
