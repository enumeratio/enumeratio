import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { integerAt, operandsOf, stringAt, symbolNameOf } from "@enumeratio/boxed";
import { toInputForm } from "@enumeratio/formats";

// The Wolfram-frontier expression/pattern/string heads: ToString, MapThread, MatchQ,
// MapIndexed, StringLength, FreeQ, StringTake, Replace, Through, ToCharacterCode,
// FromCharacterCode, Level, Pick, ReplacePart, AssociationThread.
//
// None of these exist on compute-engine under these names — `Match` and `ReplaceAll` do
// (probed via `ce.lookupDefinition`), and MatchQ/FreeQ/Replace are built directly on the
// same pattern-matching primitives those two use (`BoxedExpression.match`/`.subs`) rather
// than on `Match`/`ReplaceAll` themselves, so every head here is a fresh `ce.declare`.
//
// Pattern matching: compute-engine's own wildcard grammar (`PatternMatchOptions`, see
// `match.d.ts`) is `_`/`_name` (one element), `__`/`__name` (one-or-more), `___`/`___name`
// (zero-or-more) — Wolfram's Blank/BlankSequence/BlankNullSequence, unnamed or named. There
// is no head-restricted blank (Wolfram's `_Integer`): a boxed symbol `_n` binds to whatever
// it lands on, with no type filter, so `_Integer`-style patterns don't map — write the
// pattern loosely and check the binding's type after the fact instead. `Pattern`/`Optional`
// (`x_:default`) and condition patterns (`_?test`) aren't implemented either; document as
// you hit them.
//
// AssociationThread builds the SAME `Association` head as `list-functional.ts` (Rule pairs,
// not compute-engine's string-keyed `Dictionary`) — see that file's own module doc for why.
//
// ToString prints NOTATIO (this repo's own syntax, via `@enumeratio/formats`'s
// `toInputForm`), not Wolfram InputForm — there is no Wolfram-syntax printer in this repo,
// and notatio is InputForm's counterpart here (round-trips through `parseNotatio` the same
// way InputForm round-trips through Wolfram's own parser). Documented as a divergence on
// the reference entry.
//
// Slot (`#`, `#1`) is NOT declared here: notatio's own pure-function literals already lower
// `#`/`#1` to compute-engine's `Function`/parameter-symbol representation at parse time (see
// `design/syntax-and-formats.md`), so there is no bare `Slot` head left to give meaning to
// on this engine — declaring one would just shadow that lowering.

/** Call a (possibly `Function`-headed) expression as an operator over `args` — same
 *  technique as `list-frontier.ts`'s own `invoke`, duplicated locally per that file's own
 *  precedent (each wave keeps its own copy rather than reaching across files). */
const invoke = (ce: ComputeEngine, f: BoxedExpression, args: readonly BoxedExpression[]): BoxedExpression =>
  ce.box([f, ...args] as never).evaluate();

/** Wolfram 1-based position, negative counting from the end, to a positive 1-based index. */
const normalizePosition = (position: number, length: number): number =>
  position < 0 ? length + position + 1 : position;

/** Whether `expr` matches `pattern` anywhere in its tree (itself, or any subexpression). */
function containsMatch(expr: BoxedExpression, pattern: BoxedExpression): boolean {
  if (expr.match(pattern) !== null) return true;
  return operandsOf(expr).some((op) => containsMatch(op, pattern));
}

/** A level-spec bound: a plain integer, or `Infinity` for `PositiveInfinity` — which
 *  compute-engine boxes straight to a numeric infinity value (`.isInfinity`), not a symbol,
 *  so `symbolNameOf` alone wouldn't catch it. */
function levelBound(expr: BoxedExpression): number | undefined {
  if (expr.isInfinity === true && (expr.re ?? 0) > 0) return Number.POSITIVE_INFINITY;
  if (symbolNameOf(expr) === "PositiveInfinity") return Number.POSITIVE_INFINITY;
  return integerAt(expr);
}

type LevelSpec = { readonly leaves: true } | { readonly lo: number; readonly hi: number };

/**
 * Parse a Wolfram `levelspec`: bare `n` is levels 1 through n; `{n}` is level n alone;
 * `{n1, n2}` is levels n1 through n2; `Infinity` (bare or as a bound) reaches every level.
 * `{-1}` (or bare `-1`) is Wolfram's "leaves" shorthand, handled separately — no other
 * negative level is supported (Wolfram's general negative-level-from-the-leaves counting is
 * left undone; only the all-leaves case appears in the reference examples).
 */
function parseLevelSpec(spec: BoxedExpression): LevelSpec | undefined {
  if (spec.operator === "List") {
    const items = operandsOf(spec).map(levelBound);
    if (items.some((n) => n === undefined)) return undefined;
    if (items.length === 1) {
      const [n] = items as number[];
      if (n === -1) return { leaves: true };
      return n < 0 ? undefined : { lo: n, hi: n };
    }
    if (items.length === 2) {
      const [lo, hi] = items as [number, number];
      return lo < 0 || hi < 0 ? undefined : { lo, hi };
    }
    return undefined;
  }
  const n = levelBound(spec);
  if (n === undefined) return undefined;
  if (n === -1) return { leaves: true };
  return n < 0 ? undefined : { lo: 1, hi: n };
}

/** Every subexpression of `expr` whose depth from the root (root = 0) falls in `[lo, hi]`. */
function levelsInRange(expr: BoxedExpression, lo: number, hi: number): BoxedExpression[] {
  const results: BoxedExpression[] = [];
  const walk = (node: BoxedExpression, depth: number): void => {
    if (depth >= lo && depth <= hi) results.push(node);
    if (depth < hi) for (const op of operandsOf(node)) walk(op, depth + 1);
  };
  walk(expr, 0);
  return results;
}

/** Every leaf (an operand-free subexpression) of `expr`, Wolfram's `Level[expr, {-1}]`. */
function leavesOf(expr: BoxedExpression): BoxedExpression[] {
  const ops = operandsOf(expr);
  if (ops.length === 0) return [expr];
  return ops.flatMap(leavesOf);
}

/** Read a `ReplacePart` position — a plain (possibly negative) integer, or a `{i, j, …}`
 *  path drilling into nested operands — as a top-down list of 1-based-or-negative indices. */
function positionPath(expr: BoxedExpression): number[] | undefined {
  if (expr.operator === "List") {
    const items = operandsOf(expr).map(integerAt);
    return items.some((n) => n === undefined) ? undefined : (items as number[]);
  }
  const n = integerAt(expr);
  return n === undefined ? undefined : [n];
}

/** Rebuild `expr` with the operand at `path` replaced by `value`; `undefined` if `path`
 *  doesn't resolve (out of range, or drills into a leaf). */
function replaceAtPath(
  ce: ComputeEngine,
  expr: BoxedExpression,
  path: readonly number[],
  value: BoxedExpression,
): BoxedExpression | undefined {
  const [head, ...rest] = path;
  if (head === undefined) return value;
  const ops = operandsOf(expr);
  const index = normalizePosition(head, ops.length) - 1;
  if (index < 0 || index >= ops.length) return undefined;
  const child = replaceAtPath(ce, ops[index]!, rest, value);
  if (child === undefined) return undefined;
  const nextOps = [...ops];
  nextOps[index] = child;
  return ce.box([expr.operator, ...nextOps] as never);
}

/** Declare the Wolfram-frontier expression, pattern and string heads new to this backlog
 *  wave. See the module doc for what each diverges on. */
export function declareExpressionOps(ce: ComputeEngine): void {
  // ToString(expr): notatio, not Wolfram InputForm — see module doc.
  ce.declare("ToString", {
    signature: "(any) -> string",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const expr = ops[0];
      return expr === undefined ? undefined : ce.string(toInputForm(expr.json));
    },
  });

  // MapThread(f, {{a, b}, {c, d}}) = {f(a, c), f(b, d)}: `f` applied across the CORRESPONDING
  // elements of each row, not each row in turn (that's plain `Map`). Every row must be the
  // same length; a ragged input is left unevaluated. The 3-argument (level-spec) Wolfram
  // form isn't implemented.
  ce.declare("MapThread", {
    signature: "(function: any, lists: any) -> list<any>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [fn, listsExpr] = ops;
      if (fn === undefined || listsExpr === undefined || listsExpr.operator !== "List") return undefined;
      const rows = operandsOf(listsExpr).map(operandsOf);
      if (rows.length === 0) return ce.box(["List"]);
      const n = rows[0]!.length;
      if (!rows.every((row) => row.length === n)) return undefined;
      const results: BoxedExpression[] = [];
      for (let i = 0; i < n; i++)
        results.push(
          invoke(
            ce,
            fn,
            rows.map((row) => row[i]!),
          ),
        );
      return ce.box(["List", ...results]);
    },
  });

  // MapIndexed(f, {a, b}) = {f(a, {1}), f(b, {2})} — the index is a ONE-ELEMENT LIST
  // (Wolfram's `{i}`, since `MapIndexed` nests over levels; only the top level is done
  // here), not a bare integer.
  ce.declare("MapIndexed", {
    signature: "(function: any, list<any>) -> list<any>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [fn, listExpr] = ops;
      if (fn === undefined || listExpr === undefined) return undefined;
      const items = operandsOf(listExpr);
      const results = items.map((item, i) => invoke(ce, fn, [item, ce.box(["List", ce.number(i + 1)])]));
      return ce.box(["List", ...results]);
    },
  });

  // Through(h(f, g)(x)) = h(f(x), g(x)): compute-engine canonicalizes a call with a
  // compound head (`(f + g)(x)`, `{f, g}(x)`) to `Apply(head, x)` — see the probe in this
  // file's history — so a call with `h` = `List` or `Add` at the head reaches here as
  // `Apply(List(f, g), x)` / `Apply(Add(f, g), x)`, BEFORE `Apply`'s own (eager) evaluate
  // has a chance to mangle it. `Through` must stay `lazy` for that: a non-lazy declaration
  // gets the operand pre-evaluated, and `Apply(List(...), x)` does not evaluate to anything
  // usable (`List` isn't callable). Only the `List`/`Add` head forms are supported — an
  // arbitrary head `h(f, g)(x) = h(f(x), g(x))` (Wolfram's general case) is not.
  ce.declare("Through", {
    signature: "(any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const applyExpr = ops[0];
      if (applyExpr === undefined || applyExpr.operator !== "Apply") return undefined;
      const [headOperand, ...args] = operandsOf(applyExpr);
      if (headOperand === undefined || (headOperand.operator !== "List" && headOperand.operator !== "Add")) {
        return undefined;
      }
      const results = operandsOf(headOperand).map((fn) => invoke(ce, fn, args));
      return ce.box([headOperand.operator, ...results] as never).evaluate();
    },
  });

  // MatchQ(expr, pattern): built directly on `BoxedExpression.match` — see module doc for
  // which Wolfram pattern constructs its wildcard grammar covers. `lazy` so the pattern
  // operand reaches `match` exactly as written (a wildcard symbol like `_a` evaluates to
  // itself anyway, but a compound pattern shouldn't risk canonicalization reordering it).
  ce.declare("MatchQ", {
    signature: "(any, any) -> boolean",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const exprRaw = ops[0];
      const pattern = ops[1];
      if (exprRaw === undefined || pattern === undefined) return undefined;
      return exprRaw.evaluate().match(pattern) !== null ? ce.True : ce.False;
    },
  });

  // FreeQ(expr, pattern): True unless `pattern` matches `expr` itself or some subexpression,
  // at any depth (Wolfram's own scope for FreeQ — not just the top level).
  ce.declare("FreeQ", {
    signature: "(any, any) -> boolean",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const exprRaw = ops[0];
      const pattern = ops[1];
      if (exprRaw === undefined || pattern === undefined) return undefined;
      return containsMatch(exprRaw.evaluate(), pattern) ? ce.False : ce.True;
    },
  });

  // Replace(expr, lhs -> rhs): TOP LEVEL ONLY, unlike `ReplaceAll` (compute-engine's own
  // `/.`-equivalent, which recurses) — `expr` is replaced only if the WHOLE expression
  // matches; a rule that only matches some subexpression leaves `expr` untouched. `rule` may
  // also be a `List` of rules, tried in order; the first that matches at the top level wins.
  // Built on `.match` + `.subs` rather than compute-engine's own `.replace`, which (probed)
  // silently no-ops on a literal (non-wildcard) match target through the `Rule`-expression
  // form `evaluate()` sees here.
  ce.declare("Replace", {
    signature: "(any, any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const exprRaw = ops[0];
      const ruleSpec = ops[1];
      if (exprRaw === undefined || ruleSpec === undefined) return undefined;
      const expr = exprRaw.evaluate();
      const rules = ruleSpec.operator === "List" ? operandsOf(ruleSpec) : [ruleSpec];
      for (const rule of rules) {
        if (rule.operator !== "Rule") continue;
        const [lhs, rhs] = operandsOf(rule);
        if (lhs === undefined || rhs === undefined) continue;
        const subst = expr.match(lhs);
        if (subst !== null) return rhs.subs(subst, { canonical: true }).evaluate();
      }
      return expr;
    },
  });

  // ReplacePart(expr, i -> new): Wolfram 1-based positions, negative counting from the end;
  // a `{i, j, …}` position drills into nested operands. `rule` may also be a `List` of rules,
  // applied in order (a later rule's position is resolved against the result of the earlier
  // ones — harmless here since only values change, never the shape).
  ce.declare("ReplacePart", {
    signature: "(any, any) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [expr, ruleSpec] = ops;
      if (expr === undefined || ruleSpec === undefined) return undefined;
      const rules =
        ruleSpec.operator === "Rule" ? [ruleSpec] : ruleSpec.operator === "List" ? operandsOf(ruleSpec) : undefined;
      if (rules === undefined) return undefined;
      let result = expr;
      for (const rule of rules) {
        if (rule.operator !== "Rule") return undefined;
        const [posExpr, value] = operandsOf(rule);
        if (posExpr === undefined || value === undefined) return undefined;
        const path = positionPath(posExpr);
        if (path === undefined) return undefined;
        const next = replaceAtPath(ce, result, path, value);
        if (next === undefined) return undefined;
        result = next;
      }
      return result;
    },
  });

  // Level(expr, n | {n} | {n1, n2}): see `parseLevelSpec` for the supported level specs.
  // Level 0 is `expr` itself.
  ce.declare("Level", {
    signature: "(any, any) -> list<any>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [expr, specExpr] = ops;
      if (expr === undefined || specExpr === undefined) return undefined;
      const spec = parseLevelSpec(specExpr);
      if (spec === undefined) return undefined;
      const parts = "leaves" in spec ? leavesOf(expr) : levelsInRange(expr, spec.lo, spec.hi);
      return ce.box(["List", ...parts]);
    },
  });

  // Pick(list, sel, patt?): elements of `list` whose corresponding `sel` element matches
  // `patt` — default `True`, Wolfram's own 2-argument reading (keep where `sel` is True).
  ce.declare("Pick", {
    signature: "(list<any>, list<any>, any?) -> list<any>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [listExpr, selExpr, pattExpr] = ops;
      if (listExpr === undefined || selExpr === undefined) return undefined;
      const items = operandsOf(listExpr);
      const sels = operandsOf(selExpr);
      if (items.length !== sels.length) return undefined;
      const pattern = pattExpr ?? ce.True;
      const picked = items.filter((_, i) => sels[i]!.match(pattern) !== null);
      return ce.box(["List", ...picked]);
    },
  });

  // AssociationThread(keys, values) / AssociationThread(keys -> values): builds the SAME
  // `Association` (Rule-pair) head as `list-functional.ts` — see module doc.
  ce.declare("AssociationThread", {
    signature: "(any, any?) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      let keysExpr: BoxedExpression | undefined;
      let valuesExpr: BoxedExpression | undefined;
      if (ops.length === 1) {
        if (ops[0]?.operator !== "Rule") return undefined;
        [keysExpr, valuesExpr] = operandsOf(ops[0]);
      } else {
        [keysExpr, valuesExpr] = ops;
      }
      if (keysExpr === undefined || valuesExpr === undefined) return undefined;
      const keys = operandsOf(keysExpr);
      const values = operandsOf(valuesExpr);
      if (keys.length !== values.length) return undefined;
      return ce.box(["Association", ...keys.map((k, i) => ce.box(["Rule", k, values[i]!]))]);
    },
  });

  // StringLength/StringTake/ToCharacterCode/FromCharacterCode all count Unicode CODE
  // POINTS, not UTF-16 units — same convention compute-engine's own `Characters` already
  // uses (probed: `Characters("a😀b")` is 3 elements, not 4), so an astral character
  // (outside the BMP) counts as one.

  ce.declare("StringLength", {
    signature: "(string) -> integer",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const text = stringAt(ops[0]);
      return text === undefined ? undefined : ce.number(Array.from(text).length);
    },
  });

  // StringTake(s, n): first n characters (n < 0: last |n|). StringTake(s, {n}): the nth
  // character alone. StringTake(s, {m, n}): characters m through n, inclusive, 1-based,
  // negative counting from the end.
  ce.declare("StringTake", {
    signature: "(string, any) -> string",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const text = stringAt(ops[0]);
      const spec = ops[1];
      if (text === undefined || spec === undefined) return undefined;
      const chars = Array.from(text);
      const len = chars.length;
      if (spec.operator === "List") {
        const items = operandsOf(spec).map(integerAt);
        if (items.some((n) => n === undefined)) return undefined;
        if (items.length === 1) {
          const p = normalizePosition(items[0]!, len);
          return p < 1 || p > len ? undefined : ce.string(chars[p - 1]!);
        }
        if (items.length === 2) {
          const a = normalizePosition(items[0]!, len);
          const b = normalizePosition(items[1]!, len);
          return a < 1 || b > len || a > b ? undefined : ce.string(chars.slice(a - 1, b).join(""));
        }
        return undefined;
      }
      const n = integerAt(spec);
      if (n === undefined) return undefined;
      if (n >= 0) return ce.string(chars.slice(0, Math.min(n, len)).join(""));
      return ce.string(chars.slice(Math.max(len + n, 0)).join(""));
    },
  });

  ce.declare("ToCharacterCode", {
    signature: "(string) -> list<integer>",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const text = stringAt(ops[0]);
      if (text === undefined) return undefined;
      return ce.box(["List", ...Array.from(text).map((ch) => ce.number(ch.codePointAt(0)!))]);
    },
  });

  // FromCharacterCode(n): the single character with code point n. FromCharacterCode({n…}):
  // the string of all of them, in order — the inverse of ToCharacterCode either way.
  ce.declare("FromCharacterCode", {
    signature: "(any) -> string",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const codesExpr = ops[0];
      if (codesExpr === undefined) return undefined;
      const codes = (codesExpr.operator === "List" ? operandsOf(codesExpr) : [codesExpr]).map(integerAt);
      if (codes.some((c) => c === undefined)) return undefined;
      return ce.string(codes.map((c) => String.fromCodePoint(c!)).join(""));
    },
  });
}
