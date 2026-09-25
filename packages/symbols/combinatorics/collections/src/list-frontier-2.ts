import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, stringAt, symbolNameOf } from "@enumeratio/boxed";

// A second wave of Wolfram-frontier heads compute-engine has no answer for: list/array
// utilities (Thread, MapAt, MovingMap, HankelMatrix), the discrete-math pair
// FactorialPower/Surd, LetterNumber, PascalBinomial's Pascal's-identity-preserving
// extension of Binomial to all integers, and an elementary (k=2, r=1) CellularAutomaton.
// (DeleteDuplicates isn't here: compute-engine already ships it under our own name
// `Unique`, already mapped to Wolfram's `DeleteDuplicates` in to-wolfram.ts — see
// list-stats.ts.) Each covers the call forms Wolfram documents most; richer forms (nested
// MapAt paths, non-English LetterNumber alphabets, totalistic/multi-color
// CellularAutomaton) are left unevaluated rather than guessed at.

/** Call a (possibly `Function`-headed) expression as an operator over `args` — same
 *  technique as `list-frontier.ts`'s own `invoke`, duplicated locally. */
const invoke = (
  ce: ComputeEngine,
  f: BoxedExpression,
  args: readonly BoxedExpression[],
): BoxedExpression => ce.box([f, ...args] as never).evaluate();

// --- Thread ------------------------------------------------------------------------------------

/** `Thread[f[a1, …, an]]` / `Thread[f[…], h]`: `f` applied elementwise across every operand
 *  headed by `h` (default `List`), non-`h` operands broadcast. Left unevaluated when the
 *  `h`-headed operands disagree on length, or there are none to thread over. */
function declareThread(ce: ComputeEngine): void {
  ce.declare("Thread", {
    signature: "(any, symbol?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const expr = ops[0];
      if (expr === undefined) return undefined;
      const headName = ops[1] !== undefined ? symbolNameOf(ops[1]) : "List";
      if (headName === undefined) return undefined;
      const f = expr.operator;
      const args = operandsOf(expr);
      const threadAt = args.map((a, i) => (a.operator === headName ? i : -1)).filter((i) => i >= 0);
      if (threadAt.length === 0) return expr;
      const lengths = new Set(threadAt.map((i) => operandsOf(args[i]!).length));
      if (lengths.size !== 1) return undefined;
      const n = [...lengths][0]!;
      const rows: BoxedExpression[] = [];
      for (let k = 0; k < n; k++)
        rows.push(
          ce.function(
            f,
            args.map((a, i) => (threadAt.includes(i) ? operandsOf(a)[k]! : a)),
          ),
        );
      return ce.function(headName, rows);
    },
  });
}

// --- MapAt -------------------------------------------------------------------------------------

/** A single 1-based, possibly-negative top-level position, resolved against `length`. */
const resolvePosition = (n: number, length: number): number | undefined => {
  if (n > 0) return n <= length ? n - 1 : undefined;
  if (n < 0) return -n <= length ? length + n : undefined;
  return undefined;
};

/** `MapAt[f, expr, n]`: `f` applied to the part at (1-based, negative-from-end) position `n`.
 *  `MapAt[f, expr, {{n1}, {n2}, …}]`: applied at each position independently. Only top-level
 *  positions are supported — a multi-element path (`{i, j}`, into a nested part) is left
 *  unevaluated rather than followed. */
function declareMapAt(ce: ComputeEngine): void {
  ce.declare("MapAt", {
    signature: "((any) -> any, any, any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const f = ops[0];
      const expr = ops[1]?.evaluate();
      const spec = ops[2];
      if (f === undefined || expr === undefined || spec === undefined) return undefined;
      const items = operandsOf(expr);
      const positions: number[] = [];
      const n = integerAt(spec);
      if (n !== undefined) {
        const resolved = resolvePosition(n, items.length);
        if (resolved === undefined) return undefined;
        positions.push(resolved);
      } else if (spec.operator === "List") {
        for (const entry of operandsOf(spec)) {
          if (entry.operator !== "List" || operandsOf(entry).length !== 1) return undefined;
          const p = integerAt(operandsOf(entry)[0]!);
          const resolved = p === undefined ? undefined : resolvePosition(p, items.length);
          if (resolved === undefined) return undefined;
          positions.push(resolved);
        }
      } else return undefined;
      const chosen = new Set(positions);
      return ce.function(
        expr.operator,
        items.map((item, i) => (chosen.has(i) ? invoke(ce, f, [item]) : item)),
      );
    },
  });
}

// --- Normalize -----------------------------------------------------------------------------

/** `Normalize[v]`: `v / Norm(v)` (Euclidean norm), the zero vector unchanged.
 *  `Normalize[v, f]`: `v / f(v)` for a custom norm function `f`. */
function declareNormalize(ce: ComputeEngine): void {
  ce.declare("Normalize", {
    signature: "(collection<any>, ((any) -> any)?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const v = ops[0]?.evaluate();
      if (v === undefined) return undefined;
      const items = operandsOf(v);
      if (items.length === 0) return v;
      const norm =
        ops[1] !== undefined
          ? invoke(ce, ops[1], [v])
          : ce
              .function("Sqrt", [
                ce.function(
                  "Add",
                  items.map((x) => ce.function("Power", [ce.function("Abs", [x]), ce.number(2)])),
                ),
              ])
              .evaluate();
      if (norm.isEqual(ce.Zero) === true) return v;
      return ce.function(
        "List",
        items.map((x) => ce.function("Divide", [x, norm]).evaluate()),
      );
    },
  });
}

// --- Surd ----------------------------------------------------------------------------------

/** `Surd[x, n]`: the real `n`th root of a real `x` — unlike `Power(x, 1/n)`, stays real for
 *  negative `x` with odd `n` (`Surd(-8, 3) = -2`, not a complex cube root). An even `n` with
 *  negative `x` has no real root and is left unevaluated. */
function declareSurd(ce: ComputeEngine): void {
  ce.declare("Surd", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const x = ops[0];
      const nExpr = ops[1];
      if (x === undefined || nExpr === undefined) return undefined;
      const n = integerAt(nExpr);
      if (n === undefined || n === 0) return undefined;
      const exponent = ce.function("Divide", [ce.One, ce.number(n)]);
      if (x.isNegative !== true) return ce.function("Power", [x, exponent]).evaluate();
      if (((n % 2) + 2) % 2 !== 1) return undefined; // even root of a negative: no real value
      const magnitude = ce.function("Power", [ce.function("Negate", [x]), exponent]).evaluate();
      return ce.function("Negate", [magnitude]).evaluate();
    },
  });
}

// --- LetterNumber --------------------------------------------------------------------------

const ENGLISH_ALPHABET = "abcdefghijklmnopqrstuvwxyz";

/** 1-based position of `ch` in the English alphabet, case-insensitive; 0 for a non-letter. */
const englishLetterNumber = (ch: string): number => {
  const idx = ENGLISH_ALPHABET.indexOf(ch.toLowerCase());
  return idx === -1 ? 0 : idx + 1;
};

/** `LetterNumber[c]`: `c`'s 1-based position in the English alphabet (0 if not a letter).
 *  `LetterNumber[s]`: a list, one per character of string `s`. The `LetterNumber[c, alphabet]`
 *  form is only answered for `"English"`; any other named alphabet is left unevaluated. */
function declareLetterNumber(ce: ComputeEngine): void {
  ce.declare("LetterNumber", {
    signature: "(string, string?) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const s = stringAt(ops[0]);
      if (s === undefined || s.length === 0) return undefined;
      if (ops[1] !== undefined && stringAt(ops[1]) !== "English") return undefined;
      if (s.length === 1) return ce.number(englishLetterNumber(s));
      return ce.function(
        "List",
        s.split("").map((ch) => ce.number(englishLetterNumber(ch))),
      );
    },
  });
}

// --- FactorialPower --------------------------------------------------------------------------

/** True for an actual number literal (Integer/Rational/Real/Complex) — the concrete-value
 *  case `FactorialPower` expands. A symbolic `x` is left unevaluated instead: Wolfram itself
 *  doesn't expand `FactorialPower(x, 3)` into a product (only `FunctionExpand` does), so
 *  matching it means NOT expanding here either. */
const isNumberLiteral = (x: BoxedExpression): boolean =>
  (x as unknown as { isNumberLiteral?: boolean }).isNumberLiteral === true;

/** `FactorialPower[x, n]`: the falling factorial `x(x-1)…(x-n+1)` (`n` factors), for a
 *  concrete-number `x` only — a symbolic `x` is left unevaluated, matching Wolfram (which
 *  needs `FunctionExpand` to open the product out).
 *  `FactorialPower[x, n, h]`: step `h` instead of 1 — `x(x-h)…(x-(n-1)h)`.
 *  A negative integer `n` inverts: `1 / ((x+h)(x+2h)…(x+|n|h))`. A non-integer `n` (step 1
 *  only) generalizes via `Gamma(x+1)/Gamma(x-n+1)`. */
function declareFactorialPower(ce: ComputeEngine): void {
  ce.declare("FactorialPower", {
    signature: "(any, any, any?) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const xExpr = ops[0];
      const nExpr = ops[1];
      if (xExpr === undefined || nExpr === undefined) return undefined;
      const h = ops[2] ?? ce.One;
      const n = integerAt(nExpr.evaluate());
      if (n === 0) return ce.One; // the empty product is 1 regardless of x
      const x = xExpr.evaluate();
      if (!isNumberLiteral(x)) return undefined; // symbolic x: leave unevaluated, like Wolfram
      if (n === undefined) {
        if (h.isEqual(ce.One) !== true) return undefined;
        return ce
          .function("Divide", [
            ce.function("Gamma", [ce.function("Add", [x, ce.One])]),
            ce.function("Gamma", [
              ce.function("Add", [ce.function("Subtract", [x, nExpr]), ce.One]),
            ]),
          ])
          .evaluate();
      }
      const m = Math.abs(n);
      const factors: BoxedExpression[] = [];
      for (let k = 0; k < m; k++) {
        const shift = ce.function("Multiply", [ce.number(k), h]);
        factors.push(
          n > 0
            ? ce.function("Subtract", [x, shift]).evaluate()
            : ce.function("Add", [x, ce.function("Multiply", [ce.number(k + 1), h])]).evaluate(),
        );
      }
      const product = ce.function("Multiply", factors).evaluate();
      return n > 0 ? product : ce.function("Divide", [ce.One, product]).evaluate();
    },
  });
}

// --- HankelMatrix ----------------------------------------------------------------------------

/** `HankelMatrix[c]`: the `n×n` Hankel matrix (constant on anti-diagonals) with first column
 *  and first row `c`, zero-padded past `c`'s reach. `HankelMatrix[c, r]`: `n×m` (`n = Length(c)`,
 *  `m = Length(r)`), with `r` as the LAST ROW of the matrix (`r[1]` coincides with `c[n]`, the
 *  shared corner, so `r[1]` itself never surfaces elsewhere: `M(i,j) = c(i+j-1)` while
 *  `i+j-1 ≤ n`, else `r(i+j-n)`). */
function declareHankelMatrix(ce: ComputeEngine): void {
  ce.declare("HankelMatrix", {
    signature: "(collection<any>, collection<any>?) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const c = ops[0];
      if (c === undefined) return undefined;
      const col = operandsOf(c);
      const n = col.length;
      if (n === 0) return ce.function("List", []);
      const rowSpec = ops[1] !== undefined ? operandsOf(ops[1]) : undefined;
      const m = rowSpec !== undefined ? rowSpec.length : n;
      const at = (i: number, j: number): BoxedExpression => {
        const idx = i + j - 1;
        if (idx <= n) return col[idx - 1]!;
        const k = idx - n + 1;
        return rowSpec !== undefined && k >= 1 && k <= rowSpec.length ? rowSpec[k - 1]! : ce.Zero;
      };
      const rows: BoxedExpression[] = [];
      for (let i = 1; i <= n; i++) {
        const row: BoxedExpression[] = [];
        for (let j = 1; j <= m; j++) row.push(at(i, j));
        rows.push(ce.function("List", row));
      }
      return ce.function("List", rows);
    },
  });
}

// --- MovingMap -------------------------------------------------------------------------------

/** `MovingMap[f, list, w]`: `f` applied to each width-`(w+1)` window of `list`, sliding by 1
 *  with no padding — `Length(list) - w` results, same as `Map(f, Partition(list, w+1, 1))`. */
function declareMovingMap(ce: ComputeEngine): void {
  ce.declare("MovingMap", {
    signature: "((collection<any>) -> any, collection<any>, any) -> collection",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const f = ops[0];
      const list = ops[1]?.evaluate();
      const w = ops[2] !== undefined ? integerAt(ops[2].evaluate()) : undefined;
      if (f === undefined || list === undefined || w === undefined || w < 0) return undefined;
      const items = operandsOf(list);
      const windowSize = w + 1;
      if (windowSize > items.length) return ce.function("List", []);
      const results: BoxedExpression[] = [];
      for (let i = 0; i + windowSize <= items.length; i++) {
        const window = items.slice(i, i + windowSize);
        results.push(invoke(ce, f, [ce.function("List", window)]));
      }
      return ce.function("List", results);
    },
  });
}

// --- PascalBinomial --------------------------------------------------------------------------

/** `PascalBinomial[n, m]`: the binomial coefficient, extended to a negative `n` the way
 *  Pascal's recurrence `P(n, m) = P(n-1, m-1) + P(n-1, m)` requires — the standard
 *  "generalized" binomial coefficient `n(n-1)…(n-m+1) / m!`, which satisfies that recurrence
 *  for every integer `n` (not just `n ≥ m ≥ 0`) as long as `m ≥ 0`. A negative `m` is left
 *  unevaluated: Wolfram's extension there is a documented divergence we haven't cross-checked
 *  against a kernel this session, so it's left as a gap rather than guessed at. */
function pascalBinomial(n: number, m: number): number {
  let result = 1;
  for (let i = 0; i < m; i++) result = (result * (n - i)) / (i + 1);
  return Math.round(result);
}

function declarePascalBinomial(ce: ComputeEngine): void {
  ce.declare("PascalBinomial", {
    signature: "(number, number) -> number",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const n = integerAt(ops[0]);
      const m = integerAt(ops[1]);
      if (n === undefined || m === undefined || m < 0) return undefined;
      if (m > 200) return undefined; // guard against an unreasonably large product
      return ce.number(pascalBinomial(n, m));
    },
  });
}

// --- CellularAutomaton -----------------------------------------------------------------------

/** One elementary-rule (`k = 2` colors, radius 1) step: `next[i]` is bit
 *  `4·row[i-1] + 2·row[i] + row[i+1]` of `rule`, out-of-range neighbors reading as
 *  `background`. */
function elementaryStep(rule: number, row: readonly number[], background: number): number[] {
  const at = (i: number): number => (i < 0 || i >= row.length ? background : row[i]!);
  return row.map((_, i) => (rule >> ((at(i - 1) << 2) | (at(i) << 1) | at(i + 1))) & 1);
}

interface CAInit {
  readonly cells: number[];
  readonly background: number;
}

/** The two initial-condition forms covered: a single seed cell (`1`, Wolfram's shorthand for
 *  one black cell on an otherwise-0 background) or an explicit `{list}` / `{list, background}`. */
function parseCAInit(initExpr: BoxedExpression): CAInit | undefined {
  if (integerAt(initExpr) === 1) return { cells: [1], background: 0 };
  if (initExpr.operator !== "List") return undefined;
  const parts = operandsOf(initExpr);
  if (parts.length === 2 && parts[0]!.operator === "List") {
    const cells = operandsOf(parts[0]!).map(integerAt);
    const background = integerAt(parts[1]!);
    if (background === undefined || cells.some((c) => c === undefined)) return undefined;
    return { cells: cells as number[], background };
  }
  const cells = parts.map(integerAt);
  if (cells.some((c) => c === undefined)) return undefined;
  return { cells: cells as number[], background: 0 };
}

/** `CellularAutomaton[rule, init, t]`: `t+1` generations of the elementary (`k = 2`, radius 1)
 *  rule numbered `rule` (0–255, Wolfram's convention) starting from `init`. Every generation
 *  is the SAME fixed width — `init`'s non-background cells span `[minPos, maxPos]`, and the
 *  displayed window is `[minPos - t, maxPos + t]`, the widest region `t` steps could possibly
 *  reach from there; positions outside `init`'s cells read as `background`. (Cells of `init`
 *  that already equal `background` don't widen that span — a `{{1, 0, 0}, 0}` seed behaves
 *  exactly like a single seed cell at position 0, not like a 3-wide active region.)
 *  Totalistic/multi-color rule specs and nested-list `{{rule, k, r}, …}` forms are left
 *  unevaluated. */
function declareCellularAutomaton(ce: ComputeEngine): void {
  ce.declare("CellularAutomaton", {
    signature: "(any, any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const rule = integerAt(ops[0]);
      const initExpr = ops[1];
      const t = integerAt(ops[2]);
      if (rule === undefined || rule < 0 || rule > 255) return undefined;
      if (initExpr === undefined || t === undefined || t < 0) return undefined;
      const parsed = parseCAInit(initExpr);
      if (parsed === undefined) return undefined;
      const { cells, background } = parsed;
      const activePositions = cells
        .map((c, i) => (c !== background ? i : -1))
        .filter((i) => i >= 0);
      const minPos = activePositions.length > 0 ? Math.min(...activePositions) : 0;
      const maxPos = activePositions.length > 0 ? Math.max(...activePositions) : cells.length - 1;
      const left = minPos - t;
      const right = maxPos + t;
      const at0 = (p: number): number => (p >= 0 && p < cells.length ? cells[p]! : background);
      let row = Array.from({ length: right - left + 1 }, (_, k) => at0(left + k));
      const history: number[][] = [row.slice()];
      for (let step = 0; step < t; step++) {
        row = elementaryStep(rule, row, background);
        history.push(row.slice());
      }
      return ce.function(
        "List",
        history.map((r) =>
          ce.function(
            "List",
            r.map((v) => ce.number(v)),
          ),
        ),
      );
    },
  });
}

export function declareListFrontier2(ce: ComputeEngine): void {
  declareThread(ce);
  declareMapAt(ce);
  declareNormalize(ce);
  declareSurd(ce);
  declareLetterNumber(ce);
  declareFactorialPower(ce);
  declareHankelMatrix(ce);
  declareMovingMap(ce);
  declarePascalBinomial(ce);
  declareCellularAutomaton(ce);
}
