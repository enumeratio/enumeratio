import {
  applyFunction,
  type Engine,
  type Expr,
  integerAt,
  operandsOf,
  stringAt,
  symbolNameOf,
  toInputForm,
} from "@enumeratio/engine";

// The Wolfram-frontier expression/pattern/string heads: ToString, MapThread, MatchQ,
// MapIndexed, StringLength, FreeQ, StringTake, Replace, Through, ToCharacterCode,
// FromCharacterCode, Level, Pick, ReplacePart, AssociationThread.
//
// None of these exist on compute-engine under these names — `Match` and `ReplaceAll` do
// (probed via `ce.lookupDefinition`), and MatchQ/FreeQ/Replace are built directly on the
// same pattern-matching primitives those two use (`Expr.match`/`.subs`) rather
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
// ToString prints Epsil (this repo's own syntax, via `@enumeratio/engine`'s
// `toInputForm`), not Wolfram InputForm — there is no Wolfram-syntax printer in this repo,
// and Epsil is InputForm's counterpart here (round-trips through `parseExpression` the same
// way InputForm round-trips through Wolfram's own parser). Documented as a divergence on
// the reference entry.
//
// Slot (`#`, `#1`) is NOT declared here: Epsil's own pure-function literals already lower
// `#`/`#1` to compute-engine's `Function`/parameter-symbol representation at parse time (see
// `https://github.com/enumeratio/enumeratio/wiki/Syntax-and-Formats`), so there is no bare `Slot` head left to give meaning to
// on this engine — declaring one would just shadow that lowering.

/** Wolfram 1-based position, negative counting from the end, to a positive 1-based index. */
const normalizePosition = (position: number, length: number): number =>
  position < 0 ? length + position + 1 : position;

/** Whether `pattern` holds a blank this grammar can't read: a head-restricted blank
 *  (`_Integer`) or Wolfram's trailing-underscore name (`x_`, `x_Integer`). Matching one as
 *  an ordinary symbol would answer wrongly, so the heads that match patterns hold the call. */
function hasUnsupportedBlank(pattern: Expr): boolean {
  const name = symbolNameOf(pattern);
  if (name !== undefined) return /^_{1,3}[A-Z]/.test(name) || /^[^_]\w*_/.test(name);
  return operandsOf(pattern).some(hasUnsupportedBlank);
}

/** Whether `expr` matches `pattern` at the top level — the same one-line test `MatchQ` and
 *  `FreeQ` both build on. Exported so later waves (`misc-frontier.ts`'s `DeleteCases`) reuse
 *  this instead of re-deriving it from `Expr.match`. */
export function matches(expr: Expr, pattern: Expr): boolean {
  return expr.match(pattern) !== null;
}

/** Whether `expr` matches `pattern` anywhere in its tree (itself, or any subexpression). */
function containsMatch(expr: Expr, pattern: Expr): boolean {
  if (matches(expr, pattern)) return true;
  return partsOf(expr).some((op) => containsMatch(op, pattern));
}

/** The parts a structural search looks into: an Association's values only (its keys aren't
 *  parts in Wolfram), else the operands. */
function partsOf(expr: Expr): readonly Expr[] {
  const operands = operandsOf(expr);
  if (expr.operator !== "Association") return operands;
  return operands.map((pair) =>
    pair.operator === "Rule" || pair.operator === "KeyValuePair" ? (operandsOf(pair)[1] ?? pair) : pair,
  );
}

/** A level-spec bound: a plain integer, or `Infinity` for `PositiveInfinity` — which
 *  compute-engine boxes straight to a numeric infinity value (`.isInfinity`), not a symbol,
 *  so `symbolNameOf` alone wouldn't catch it. */
function levelBound(expr: Expr): number | undefined {
  if (expr.isInfinity === true && (expr.re ?? 0) > 0) return Number.POSITIVE_INFINITY;
  if (symbolNameOf(expr) === "PositiveInfinity") return Number.POSITIVE_INFINITY;
  return integerAt(expr);
}

/** The levels a spec selects, as signed bounds: a negative bound counts from the leaves (a
 *  subexpression's depth is 1 for an atom, else 1 more than its deepest operand). */
interface LevelSpec {
  readonly lo: number;
  readonly hi: number;
}

/**
 * Parse a Wolfram `levelspec`: bare `n` is levels 1 through n; `{n}` is level n alone;
 * `{n1, n2}` is levels n1 through n2; `Infinity` (bare or as a bound) reaches every level.
 * A negative bound counts depth from the leaves: `{-1}` is the leaves, bare `-1` (levels 1
 * through -1) every proper subexpression.
 */
function parseLevelSpec(spec: Expr): LevelSpec | undefined {
  if (spec.operator === "List") {
    const items = operandsOf(spec).map(levelBound);
    if (items.some((n) => n === undefined)) return undefined;
    if (items.length === 1) return { lo: items[0]!, hi: items[0]! };
    if (items.length === 2) return { lo: items[0]!, hi: items[1]! };
    return undefined;
  }
  const n = levelBound(spec);
  return n === undefined ? undefined : { lo: 1, hi: n };
}

/** Whether a node at `level` (the root is 0) with the given `depth` lies in `spec`. */
const inLevels = ({ lo, hi }: LevelSpec, level: number, depth: number): boolean =>
  (lo >= 0 ? level >= lo : depth <= -lo) && (hi >= 0 ? level <= hi : depth >= -hi);

/** Every subexpression of `expr` in `spec`, in Wolfram's own POST-ORDER: a node's own
 *  children (recursively) come before the node itself, so `Level({1, {2, 3}, 4}, 2)` is
 *  `{1, 2, 3, {2, 3}, 4}` — `{2, 3}` printed AFTER its own parts `2, 3`, not before them.
 *  Siblings still keep their original left-to-right order; only each node's position
 *  relative to its OWN descendants moves. */
function levelsInRange(expr: Expr, spec: LevelSpec): Expr[] {
  const results: Expr[] = [];
  const walk = (node: Expr, level: number): number => {
    const depth = 1 + Math.max(0, ...operandsOf(node).map((op) => walk(op, level + 1)));
    if (inLevels(spec, level, depth)) results.push(node);
    return depth;
  };
  walk(expr, 0);
  return results;
}

/** Read a `ReplacePart` position — a plain (possibly negative) integer, or a `{i, j, …}`
 *  path drilling into nested operands — as a top-down list of 1-based-or-negative indices. */
function positionPath(expr: Expr): number[] | undefined {
  if (expr.operator === "List") {
    const items = operandsOf(expr).map(integerAt);
    return items.some((n) => n === undefined) ? undefined : (items as number[]);
  }
  const n = integerAt(expr);
  return n === undefined ? undefined : [n];
}

/** Rebuild `expr` with the operand at `path` replaced by `value`; `undefined` if `path`
 *  doesn't resolve (out of range, or drills into a leaf). */
function replaceAtPath(ce: Engine, expr: Expr, path: readonly number[], value: Expr): Expr | undefined {
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
export function declareExpressionOps(ce: Engine): void {
  // ToString(expr): Epsil, not Wolfram InputForm — see module doc.
  ce.declare("ToString", {
    signature: "(any) -> string",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const expr = ops[0];
      return expr === undefined ? undefined : ce.string(toInputForm(expr.json));
    },
  });

  // MapThread(f, {{a, b}, {c, d}}) = {f(a, c), f(b, d)}: `f` applied across the CORRESPONDING
  // elements of each row, not each row in turn (that's plain `Map`). Every row must be the
  // same length; a ragged input is left unevaluated. The 3-argument (level-spec) Wolfram
  // form isn't implemented.
  ce.declare("MapThread", {
    signature: "(function: any, lists: list<any>) -> list<any>",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const [fn, listsExpr] = ops;
      if (fn === undefined || listsExpr === undefined || listsExpr.operator !== "List") return undefined;
      const rows = operandsOf(listsExpr).map(operandsOf);
      if (rows.length === 0) return ce.box(["List"]);
      const n = rows[0]!.length;
      if (!rows.every((row) => row.length === n)) return undefined;
      const results: Expr[] = [];
      for (let i = 0; i < n; i++)
        results.push(
          applyFunction(
            ce,
            fn,
            rows.map((row) => row[i]!),
          ),
        );
      return ce.box(["List", ...results]);
    },
  });

  // MapIndexed(f, {a, b}) = {f(a, {1}), f(b, {2})} — the index is the part's position path,
  // a LIST (`{i}` at the top level), not a bare integer. With a level spec, `f` goes on every
  // part in those levels, innermost first (so `f` sees the rebuilt children), as in `Level`.
  ce.declare("MapIndexed", {
    signature: "(function: any, list<any>, any?) -> list<any>",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const [fn, listExpr, specExpr] = ops;
      if (fn === undefined || listExpr === undefined) return undefined;
      const spec = specExpr === undefined ? { lo: 1, hi: 1 } : parseLevelSpec(specExpr);
      if (spec === undefined) return undefined;
      const path = (indices: readonly number[]): Expr => ce.box(["List", ...indices]);
      // Depth (from the leaves) is only read by a negative bound; otherwise stop at `hi`.
      const needsDepth = spec.lo < 0 || spec.hi < 0;
      const walk = (node: Expr, indices: readonly number[]): { value: Expr; depth: number } => {
        const operands = operandsOf(node);
        const children =
          needsDepth || indices.length < spec.hi ? operands.map((op, i) => walk(op, [...indices, i + 1])) : [];
        const depth = 1 + Math.max(0, ...children.map((c) => c.depth));
        const changed = children.some((c, i) => c.value !== operands[i]);
        const rebuilt = changed
          ? ce.function(
              node.operator,
              children.map((c) => c.value),
            )
          : node;
        const value = inLevels(spec, indices.length, depth) ? applyFunction(ce, fn, [rebuilt, path(indices)]) : rebuilt;
        return { value, depth };
      };
      return walk(listExpr, []).value;
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
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const applyExpr = ops[0];
      if (applyExpr === undefined || applyExpr.operator !== "Apply") return undefined;
      const [headOperand, ...args] = operandsOf(applyExpr);
      if (headOperand === undefined || (headOperand.operator !== "List" && headOperand.operator !== "Add")) {
        return undefined;
      }
      const results = operandsOf(headOperand).map((fn) => applyFunction(ce, fn, args));
      return ce.box([headOperand.operator, ...results] as never).evaluate();
    },
  });

  // MatchQ(expr, pattern): built directly on `Expr.match` — see module doc for
  // which Wolfram pattern constructs its wildcard grammar covers. `lazy` so the pattern
  // operand reaches `match` exactly as written (a wildcard symbol like `_a` evaluates to
  // itself anyway, but a compound pattern shouldn't risk canonicalization reordering it).
  ce.declare("MatchQ", {
    signature: "(any, any) -> boolean",
    lazy: true,
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const exprRaw = ops[0];
      const pattern = ops[1];
      if (exprRaw === undefined || pattern === undefined || hasUnsupportedBlank(pattern)) return undefined;
      return matches(exprRaw.evaluate(), pattern) ? ce.True : ce.False;
    },
  });

  // FreeQ(expr, pattern): True unless `pattern` matches `expr` itself or some subexpression,
  // at any depth (Wolfram's own scope for FreeQ — not just the top level).
  ce.declare("FreeQ", {
    signature: "(any, any) -> boolean",
    lazy: true,
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const exprRaw = ops[0];
      const pattern = ops[1];
      if (exprRaw === undefined || pattern === undefined || hasUnsupportedBlank(pattern)) return undefined;
      return containsMatch(exprRaw.evaluate(), pattern) ? ce.False : ce.True;
    },
  });

  // Replace(expr, lhs -> rhs): TOP LEVEL ONLY, unlike `ReplaceAll` (compute-engine's own
  // `/.`-equivalent, which recurses) — `expr` is replaced only if the WHOLE expression
  // matches; a rule that only matches some subexpression leaves `expr` untouched. `rule` may
  // also be a `List` of rules, tried in order; the first that matches at the top level wins.
  // Built on `.match` + `.subs` rather than compute-engine's own `.replace`, which (probed)
  // silently no-ops on a literal (non-wildcard) match target through the `Rule`-expression
  // form `evaluate()` sees here. A list of rule SETS (`{{x -> a}, {x -> b}}`) threads: each
  // set is tried on its own and the answers come back as a list.
  ce.declare("Replace", {
    signature: "(any, expression<Rule> | list<expression<Rule>> | list<list<expression<Rule>>>) -> any",
    lazy: true,
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const exprRaw = ops[0];
      const ruleSpec = ops[1];
      if (exprRaw === undefined || ruleSpec === undefined) return undefined;
      const lefts = (
        ruleSpec.operator === "List"
          ? operandsOf(ruleSpec).flatMap((r) => (r.operator === "List" ? operandsOf(r) : [r]))
          : [ruleSpec]
      ).map((rule) => operandsOf(rule)[0]);
      if (lefts.some((lhs) => lhs !== undefined && hasUnsupportedBlank(lhs))) return undefined;
      const expr = exprRaw.evaluate();
      const replaceWith = (rules: readonly Expr[]): Expr => {
        for (const rule of rules) {
          if (rule.operator !== "Rule") continue;
          const [lhs, rhs] = operandsOf(rule);
          if (lhs === undefined || rhs === undefined) continue;
          const subst = expr.match(lhs);
          if (subst !== null) return rhs.subs(subst, { canonical: true }).evaluate();
        }
        return expr;
      };
      if (ruleSpec.operator !== "List") return replaceWith([ruleSpec]);
      const sets = operandsOf(ruleSpec);
      if (sets.length > 0 && sets.every((set) => set.operator === "List"))
        return ce.function(
          "List",
          sets.map((set) => replaceWith(operandsOf(set))),
        );
      return replaceWith(sets);
    },
  });

  // ReplacePart(expr, i -> new): Wolfram 1-based positions, negative counting from the end;
  // a `{i, j, …}` position drills into nested operands. `rule` may also be a `List` of rules,
  // applied in order (a later rule's position is resolved against the result of the earlier
  // ones — harmless here since only values change, never the shape).
  ce.declare("ReplacePart", {
    signature: "(any, expression<Rule> | list<expression<Rule>>) -> any",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
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
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const [expr, specExpr] = ops;
      if (expr === undefined || specExpr === undefined) return undefined;
      const spec = parseLevelSpec(specExpr);
      if (spec === undefined) return undefined;
      return ce.box(["List", ...levelsInRange(expr, spec)]);
    },
  });

  // Pick(list, sel, patt?): elements of `list` whose corresponding `sel` element matches
  // `patt` — default `True`, Wolfram's own 2-argument reading (keep where `sel` is True).
  // A `sel` element that is itself a list, against a list element, picks inside it
  // (`Pick({{a,b},{c,d}}, {{0,0},{1,1}}, 1)` is `{{}, {c,d}}`); mismatched lengths decline.
  ce.declare("Pick", {
    signature: "(list<any>, list<any>, any?) -> list<any>",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const [listExpr, selExpr, pattExpr] = ops;
      if (listExpr === undefined || selExpr === undefined) return undefined;
      const pattern = pattExpr ?? ce.True;
      const pick = (list: Expr, sel: Expr): Expr | undefined => {
        const items = operandsOf(list);
        const sels = operandsOf(sel);
        if (items.length !== sels.length) return undefined;
        const picked: Expr[] = [];
        for (let i = 0; i < items.length; i++) {
          if (sels[i]!.match(pattern) !== null) picked.push(items[i]!);
          else if (sels[i]!.operator === "List" && items[i]!.operator === "List") {
            const inner = pick(items[i]!, sels[i]!);
            if (inner === undefined) return undefined;
            picked.push(inner);
          }
        }
        return ce.box(["List", ...picked]);
      };
      return pick(listExpr, selExpr);
    },
  });

  // AssociationThread(keys, values) / AssociationThread(keys -> values): builds the SAME
  // `Association` (Rule-pair) head as `list-functional.ts` — see module doc.
  ce.declare("AssociationThread", {
    signature: "(collection<any> | expression<Rule>, collection<any>?) -> any",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      let keysExpr: Expr | undefined;
      let valuesExpr: Expr | undefined;
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
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const text = stringAt(ops[0]);
      return text === undefined ? undefined : ce.number(Array.from(text).length);
    },
  });

  // StringTake(s, n): first n characters (n < 0: last |n|). StringTake(s, {n}): the nth
  // character alone. StringTake(s, {m, n}): characters m through n, inclusive, 1-based,
  // negative counting from the end.
  ce.declare("StringTake", {
    signature: "(string, integer | list<integer>) -> string",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
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
      // More characters than the string has: held, as Wolfram does.
      if (Math.abs(n) > len) return undefined;
      return ce.string(n >= 0 ? chars.slice(0, n).join("") : chars.slice(len + n).join(""));
    },
  });

  ce.declare("ToCharacterCode", {
    signature: "(string) -> list<integer>",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const text = stringAt(ops[0]);
      if (text === undefined) return undefined;
      return ce.box(["List", ...Array.from(text).map((ch) => ce.number(ch.codePointAt(0)!))]);
    },
  });

  // FromCharacterCode(n): the single character with code point n. FromCharacterCode({n…}):
  // the string of all of them, in order — the inverse of ToCharacterCode either way.
  ce.declare("FromCharacterCode", {
    signature: "(integer | list<integer>) -> string",
    evaluate: (ops: readonly Expr[]): Expr | undefined => {
      const codesExpr = ops[0];
      if (codesExpr === undefined) return undefined;
      const codes = (codesExpr.operator === "List" ? operandsOf(codesExpr) : [codesExpr]).map(integerAt);
      if (codes.some((c) => c === undefined)) return undefined;
      return ce.string(codes.map((c) => String.fromCodePoint(c!)).join(""));
    },
  });
}
