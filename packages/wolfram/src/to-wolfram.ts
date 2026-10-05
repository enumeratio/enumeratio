// MathJSON → Wolfram Language source. Wolfram's uniform `Head[args]` syntax
// means most of the work is a name map (compute-engine head → WL symbol) plus a
// handful of structural forms; unmapped heads fall through as `Head[args]`, so
// coverage degrades gracefully. Pure (MathJSON in, string out): no compute-engine
// dependency, so it ports cleanly into a compute-engine LanguageTarget later.

import { isSystemName } from "./system-names.ts";
import { ATTRIBUTE_NAMES, FORM_NAMES, OPTION_NAMES } from "./vocabulary.ts";
import { WOLFRAM_NAMES } from "./wolfram-names-data.ts";

export type MathJson =
  | number
  | string
  | boolean
  | { num: string; precision?: number; accuracy?: number }
  | { str: string }
  | { sym: string }
  | { fn: MathJson[] }
  | MathJson[];

/** The number sets, as `Element(x, …)` and assumptions name them: ours → Wolfram's spelling. */
export const NUMBER_SETS: Record<string, string> = {
  Integers: "Integers",
  RationalNumbers: "Rationals",
  RealNumbers: "Reals",
  ComplexNumbers: "Complexes",
  Primes: "Primes",
};

/** compute-engine symbol constants whose Wolfram spelling differs. Exported so
 * `fromWolfram` can build the reverse mapping from the same source. */
export const SYMBOLS: Record<string, string> = {
  Pi: "Pi",
  ExponentialE: "E",
  ImaginaryUnit: "I",
  MachineEpsilon: "$MachineEpsilon",
  GoldenRatio: "GoldenRatio",
  EulerGamma: "EulerGamma",
  CatalanConstant: "Catalan",
  True: "True",
  False: "False",
  // Both our NaN (a floating-point result) and our Indeterminate (an exact indeterminate
  // form, e.g. 0/0) print as Wolfram's one Indeterminate; the reverse map (fromWolfram) needs
  // a single choice back, so Indeterminate is listed after NaN here -- last entry for a given
  // Wolfram spelling wins the reverse lookup (see REVERSE_SYMBOLS in from-wolfram.ts).
  NaN: "Indeterminate",
  Indeterminate: "Indeterminate",
  PositiveInfinity: "Infinity",
  NegativeInfinity: "-Infinity",
  ComplexInfinity: "ComplexInfinity",
  Nothing: "Null",
  ...NUMBER_SETS,
  // @enumeratio/evaluation's own marker, under Wolfram's `$`-prefixed spelling — compute-engine's
  // symbol grammar rejects a leading `$` (see evaluation/src/declare.ts).
  Aborted: "$Aborted",
};

/** compute-engine head → Wolfram head, generated from every head's `names.wolfram` /
 * `names.wolframIdentity` field (https://github.com/enumeratio/enumeratio/wiki/Speculative-Symbol-Metadata step 4;
 * `packages/reference/scripts/collect-wolfram-names.ts`, pinned current by
 * `wolfram-heads-migration.test.ts`). Identity entries are kept on purpose: the map doubles
 * as the registry of heads the transpiler vouches for (`isWolframHead`), as opposed to heads
 * that merely fall through by name. Exported so `fromWolfram` can build the reverse mapping
 * from the same source. */
export const HEADS: Record<string, string> = WOLFRAM_NAMES;

/** Wolfram heads we answer under one of our own heads, but only in a particular CALL
 *  SHAPE rather than as a straight rename — so they cannot live in `HEADS`, which maps
 *  one Wolfram spelling per compute-engine head. `Total[list]` is our `Sum[list]` with
 *  no iterator (see the `Sum` case in `SPECIAL`, and its reverse in `fromWolfram`); a
 *  `Sum` WITH an iterator is Wolfram's own `Sum`, which already occupies that spelling
 *  in `HEADS`. Exported so the frontier generator can exclude these from the gap list
 *  the same way it excludes a plain rename. */
export const STRUCTURAL: Record<string, string> = {
  Total: "Sum",
  Clip: "Clamp",
};

/** Wolfram vocabulary: attributes, option keys and format symbols, as the kernel lists them. */
const VOCABULARY: ReadonlySet<string> = new Set([...ATTRIBUTE_NAMES, ...OPTION_NAMES, ...FORM_NAMES]);

/** The infinities' own spellings, which `fromWolfram` reads back (`DirectedInfinity[1]`). */
const INFINITIES: ReadonlySet<string> = new Set(["Infinity", "DirectedInfinity"]);

/**
 * Whether a name ours does not define still means Wolfram's own thing, so it is not a free variable
 * that merely shares the spelling (`E`, `K`). The tests are what our own mappings already say, and
 * what the kernel says is vocabulary: the Wolfram side of a `STRUCTURAL` pair (`Total`, `Clip`), the
 * formatting head of a box we vouch for (`Superscript` for `SuperscriptBox`), the infinities, and an
 * attribute, option key or format symbol.
 */
export const isWolframOwnName = (name: string): boolean =>
  Object.hasOwn(STRUCTURAL, name) ||
  INFINITIES.has(name) ||
  VOCABULARY.has(name) ||
  (isSystemName(name) && Object.hasOwn(HEADS, `${name}Box`));

/** The context our heads emit into when Wolfram has the name for something else.
 *
 *  Wolfram's own answer to a name clash, and the reason it has contexts at all. An
 *  `` enumeratio`Area `` is an inert symbol in a context the kernel owns nothing in, so it
 *  cannot be mistaken for `System`Area` — where falling through by NAME would be, silently
 *  and with a plausible-looking result. */
export const CONTEXT = "enumeratio`";

/**
 * Our heads whose Wolfram spelling is taken by an unrelated function, mapped to what
 * Wolfram means by the name. Renaming our side is the wrong fix — a statistic is scoped to
 * its carrier, so sharing a name is an overload — but emitting it as the Wolfram symbol is
 * a wrong answer rather than a missing one, which is worse than either.
 */
export const FOREIGN: Record<string, string> = {
  // Ours is literal text inside boxes (https://github.com/enumeratio/enumeratio/wiki/Boxes); Wolfram writes that as a quoted
  // string, and its own TextBox is undocumented.
  TextBox: "an undocumented front-end box whose meaning Wolfram does not publish",
  // Ours holds a hole's Epsil as written, for the environment to parse; Wolfram's holds the
  // expression itself.
  TemplateExpression: "a template hole holding an expression, evaluated when the template is applied",
  Area: "the area of a geometric region",
  Perimeter: "the perimeter of a geometric region",
  Depth: "the number of indices needed to reach any part of an expression",
  Order: "the canonical-order comparison Order[a, b]",
  Composition: "a composition of functions, Composition[f, g]",
  Word: "the token specification used by Read and Find",
  Restricted: "an Interpreter form narrowed by a condition",
  // Ours is the carrier's plural type-space symbol (https://github.com/enumeratio/enumeratio/wiki/Domains §2 — Element(x,
  // GaussianIntegers) checks x's carrier); Wolfram's is an option flag (IsPrime[n,
  // GaussianIntegers -> True]), never a value on its own.
  GaussianIntegers: "the GaussianIntegers -> True/False option several number-theory functions take",
  // Nearly ours, which is the trap: Wolfram's is a raster image built from a pixel array or
  // a graphics object, never from a URI, so `Image["data:image/png;…"]` is not an image over
  // there — it is an Image of a string.
  Image: "a raster image built from a pixel array or a graphics object",
  // Not unrelated like the rest of this list -- same graph, same vertex-list call shape --
  // but ours ALSO accepts a bare integer (PathGraph(n), our own convenience extension) that
  // real Wolfram's PathGraph rejects outright. HEADS can't map conditionally on call shape,
  // and a plain rename would "vouch for" (isWolframHead) the call that errors, so every
  // PathGraph(...) emits into our context instead -- conservative over precise, since the
  // alternative risks handing a kernel oracle a call it doesn't accept.
  PathGraph: "a path graph over an explicit vertex list only -- unlike ours, no bare-integer form",
};

/** `Over -> R` as Wolfram's own `GaussianIntegers -> True/False`, for the rings it has one for. */
export const ringOption = (key: MathJson, value: MathJson): string | undefined =>
  key === "Over" && (value === "GaussianIntegers" || value === "Integers")
    ? `Rule[GaussianIntegers, ${value === "GaussianIntegers" ? "True" : "False"}]`
    : undefined;

/** Heads that need a bespoke emission rather than a plain rename. */
const SPECIAL: Record<string, (args: MathJson[]) => string> = {
  // Apply(f, ...args) is compute-engine's own "call f with these arguments" (confirmed
  // against its own crosswalk description, "Apply a function to a list of arguments" —
  // NOT Wolfram's Apply, which replaces an expression's head instead), so it maps to a
  // direct Wolfram call `f[...args]`, not `Apply[f, {...args}]`. This is what
  // `D(y(x), x, x)` boxes to (`Apply(Derivative(y, 2), x)`), and combined with the
  // `Derivative` entry below round-trips it to Wolfram's own `Derivative[2][y][x]`
  // (printed `y''[x]`) — DSolveValue's `y'`/`y''` notation.
  Apply: (a) =>
    `${toWolfram(a[0])}[${a
      .slice(1)
      .map((x) => toWolfram(x))
      .join(", ")}]`,
  // A named slot, `Slot("age")`, is Wolfram's `#age`: the same Slot head, so the transpiler vouches
  // for it instead of leaving the emitter to treat it as an unknown name (and context it).
  Slot: (a) => `Slot[${a.map((x) => toWolfram(x)).join(", ")}]`,
  // Derivative(f, n): compute-engine's own order (function first, order second) — same
  // as Wolfram's `Derivative[n][f]`, just swapped; a partial `Derivative(f, 0, 1)` is
  // `Derivative[0, 1][f]`.
  Derivative: (a) =>
    `Derivative[${a
      .slice(1)
      .map((x) => toWolfram(x))
      .join(", ")}][${toWolfram(a[0])}]`,
  // LambertW(z) / LambertW(z, k) is compute-engine's own order (branch index second, checked
  // directly: `LambertW(-0.14, -1)` is the k = -1 branch); Wolfram's `ProductLog` puts the
  // branch first: `ProductLog[z]` / `ProductLog[k, z]`.
  LambertW: (a) =>
    a.length === 1 ? `ProductLog[${toWolfram(a[0])}]` : `ProductLog[${toWolfram(a[1])}, ${toWolfram(a[0])}]`,
  // compute-engine `Log` is base-10 in the 1-arg form and value-first in the
  // 2-arg form (`Log(value, base)`); Wolfram's `Log` is natural and base-first
  // (`Log[base, value]`), so map and swap.
  Log: (a) => (a.length === 1 ? `Log[10, ${toWolfram(a[0])}]` : `Log[${toWolfram(a[1])}, ${toWolfram(a[0])}]`),
  // Root(x, n) is the n-th root; Wolfram `Root` means a polynomial root object.
  Root: (a) => `Power[${toWolfram(a[0])}, Divide[1, ${toWolfram(a[1])}]]`,
  // Wolfram has no `Square`; it is x^2.
  Square: (a) => `Power[${toWolfram(a[0])}, 2]`,
  // compute-engine `Mode` returns the value; Wolfram's `Commonest` returns a list.
  Mode: (a) => `First[Commonest[${toWolfram(a[0])}]]`,
  // Sign(x) is overloaded (A-126 farm survey, #495): a `complex`/`signed_infinity` argument
  // is Wolfram's own Sign[x] (x/|x|, same meaning, safe to pass through verbatim below) --
  // but a `Permutation` argument is our permutation-parity statistic ("+1 when the inversion
  // count is even, -1 when odd"), which Wolfram calls Signature[perm], NOT Sign[perm] (a
  // name collision `isWolframHead` would otherwise pass straight through as Wolfram's own,
  // unrelated, numeric-only Sign -- see Order's identical trap, handled via FOREIGN since it
  // has no single-arity Wolfram equivalent to rename to, unlike this one).
  Sign: (a) => {
    if (a.length !== 1 || !Array.isArray(a[0]) || a[0][0] !== "Permutation" || a[0].length !== 2)
      return call("Sign", a);
    // Unwrap the carrier the same way the generic CARRIER_NAMES fallback would (oracle's
    // emit.ts) for the common bare one-line-notation case; the cycle-notation-composed case
    // (`Permutation(CycleDecomposition(...))`) needs the same `Cycles[...]` conversion the
    // `Permutation`/`CycleDecomposition` SPECIAL cases above already do -- Wolfram's own
    // Signature takes either a plain list or a Cycles[...] object.
    const content = a[0][1];
    const parts = headArgs(content);
    if (parts?.head === "CycleDecomposition") return `Signature[Cycles[${toWolfram(parts.args[0])}]]`;
    return `Signature[${toWolfram(content)}]`;
  },
  // compute-engine's `Reduce(collection, f, x0)` is a fold (confirmed: `Reduce([1,2,3,4],
  // Add, 0)` is 10, same as `Fold(Add, 0, [1,2,3,4])`) -- an unrelated NAME COLLISION with
  // Wolfram's OWN `Reduce` (equation/inequality solving), which `isWolframHead` otherwise
  // passes straight through verbatim (A-126 farm scan: `Reduce[{a,b,c,d}, List, x]` is not
  // even the right SHAPE of call for Wolfram's Reduce, let alone the right answer). Map to
  // Wolfram's actual fold, `Fold[f, x0, list]`, reordered from ours only when a genuine
  // 3-ary fold call reaches here — a 2-ary or n-ary `Reduce` (Wolfram's own signature) falls
  // through to the generic pass-through below unchanged.
  Reduce: (a) =>
    a.length === 3 ? `Fold[${toWolfram(a[1])}, ${toWolfram(a[2])}, ${toWolfram(a[0])}]` : call("Reduce", a),
  // Round(x, n) rounds to n decimal places; Wolfram's second argument is a step
  // to round to a multiple of, so n digits is the step 10^-n.
  Round: (a) =>
    a.length === 2
      ? `Round[${toWolfram(a[0])}, Power[10, ${typeof a[1] === "number" ? toWolfram(-a[1]) : `Minus[${toWolfram(a[1])}]`}]]`
      : call("Round", a),
  // Wolfram has no set type; `Union` of one list is the sorted, deduplicated list,
  // which is the closest thing to a canonical set — and what `Intersection` et al
  // return, so set identities still compare Equal.
  Set: (a) => `Union[${call("List", a)}]`,
  // Clamp(x, lo, hi) is Clip[x, {lo, hi}]; the 1-arg form clips to [-1, 1] in both. The
  // 5-arg form adds replacement values for outside the range, Clip's own third argument
  // `{vlo, vhi}` -- also a pair, not the two flat trailing operands a plain rename would give.
  Clamp: (a) =>
    a.length === 5
      ? `Clip[${toWolfram(a[0])}, List[${toWolfram(a[1])}, ${toWolfram(a[2])}], List[${toWolfram(a[3])}, ${toWolfram(a[4])}]]`
      : a.length === 3
        ? `Clip[${toWolfram(a[0])}, List[${toWolfram(a[1])}, ${toWolfram(a[2])}]]`
        : call("Clip", a),
  // Wolfram's Sum/Product only take an iterator; the 1-arg list form is Total /
  // Times-apply. With an iterator the names agree and `Tuple` becomes `{k, a, b}`.
  Sum: (a) => (a.length === 1 ? `Total[${toWolfram(a[0])}]` : call("Sum", a)),
  Product: (a) => (a.length === 1 ? `Apply[Times, ${toWolfram(a[0])}]` : call("Product", a)),
  // A definite integral's `Limits(x, a, b)` is Wolfram's iterator `{x, a, b}`.
  Integrate: (a) =>
    call(
      "Integrate",
      a.map((it) => (Array.isArray(it) && it[0] === "Limits" ? ["List", ...it.slice(1)] : it)),
    ),
  // `Solve(eqs, x, y)` lists its unknowns as arguments; Wolfram takes them as one list, and
  // reads `Solve[eqs, x, y]` as a solve for `x` over the domain `y`.
  Solve: (a) =>
    a.length > 2 && a.slice(1).every((unknown) => typeof unknown === "string")
      ? `Solve[${toWolfram(a[0])}, ${toWolfram(["List", ...a.slice(1)])}]`
      : call("Solve", a),
  // Wolfram's interval is closed and takes its bounds as a list: `Interval[{a, b}]`.
  Interval: (a) =>
    a.length === 2 && !a.some((b) => Array.isArray(b) && b[0] === "Open")
      ? `Interval[${call("List", a)}]`
      : call("Interval", a),
  // IndexOf returns 0 when absent; FirstPosition returns Missing unless given a default. And
  // IndexOf is a TOP-LEVEL scan only (the collection's own elements, like Array.indexOf) —
  // FirstPosition without a level spec searches every depth, so `IndexOf({{a,a,b},…}, b)`
  // would find `b` nested inside a sublist instead of correctly reporting 0 (found scanning
  // #A-72 phase 2's newly-emitting rows: `First[FirstPosition[{{a,a,b},…}, b, {0}]]` gave 1).
  IndexOf: (a) => `First[FirstPosition[${toWolfram(a[0])}, ${toWolfram(a[1])}, List[0], List[1]]]`,
  // Degrees(x) is the angle x° — Wolfram multiplies by the `Degree` constant.
  Degrees: (a) => `Times[${toWolfram(a[0])}, Degree]`,
  // Divides(a, b) is "a divides b"; Divisible(n, m) is "n is divisible by m" — the
  // same relation with divisor and multiple swapped.
  Divides: (a) => `Divisible[${toWolfram(a[1])}, ${toWolfram(a[0])}]`,
  // Tabulate(f, n) is Array[f, n]; Tabulate(f, n1, n2, ...) needs the dims collected into
  // a list for Wolfram's multi-dimensional Array[f, {n1, n2, ...}].
  Tabulate: (a) =>
    a.length >= 3
      ? `Array[${toWolfram(a[0])}, List[${a
          .slice(1)
          .map((d) => toWolfram(d))
          .join(", ")}]]`
      : call("Array", a),
  // Scan(xs, f) is same-length as xs, matching Wolfram's no-seed FoldList[f, list] with
  // the args reordered. Scan(xs, f, init) is ALSO same-length while FoldList[f, x, list]
  // is length+1, so only the 2-arg form maps; the seeded form goes out in our context,
  // since Wolfram's Scan is an unrelated side-effecting map.
  Scan: (a) => (a.length === 2 ? `FoldList[${toWolfram(a[1])}, ${toWolfram(a[0])}]` : call(`${CONTEXT}Scan`, a)),
  // PositionalNumerals(b) is ordinary base b wrapped as a system value (see
  // packages/symbols/arithmetic/numerals) — the same digits Wolfram's own bare integer base already gives in
  // IntegerDigits[n, b]/FromDigits[digits, b], so it unwraps to the plain number rather than
  // a head call. One-way: a bare Wolfram base comes back bare, not rewrapped as this.
  PositionalNumerals: (a) => toWolfram(a[0]),
  // Arccot(x) has range (0, π) on compute-engine's side; Wolfram's ArcCot has range
  // (-π/2, π/2], which disagrees at negative x (Arccot(-1) = 3π/4, ArcCot[-1] = -π/4). The
  // two agree everywhere via this identity, so emit the equivalent that matches our range
  // rather than the (sometimes wrong) rename. One-way: Wolfram's ArcCot does not reverse to
  // this — see REVERSE_HEADS, built from HEADS, which no longer lists Arccot at all.
  Arccot: (a) => `Subtract[Divide[Pi, 2], ArcTan[${toWolfram(a[0])}]]`,
  // Hypergeometric3F2Regularized(a1,a2,a3,b1,b2,z) has no dedicated Wolfram head — it is the
  // 3,2 case of the generic HypergeometricPFQRegularized[{a1,a2,a3},{b1,b2},z], which takes
  // its upper and lower parameters as lists rather than flat arguments.
  // BigO(x^n) is Wolfram's `O[x]^n` — the exponent sits OUTSIDE `O[...]` there, not
  // inside it, so this is a restructuring, not a rename. `BigO(x)` alone (n = 1) is the
  // bare `O[x]`, since `Power[O[x], 1]` is how Wolfram would print it anyway.
  BigO: (a) => {
    const arg = a[0];
    if (Array.isArray(arg) && arg[0] === "Power") {
      return `Power[O[${toWolfram(arg[1])}], ${toWolfram(arg[2])}]`;
    }
    return `O[${toWolfram(arg)}]`;
  },
  Hypergeometric3F2Regularized: (a) =>
    `HypergeometricPFQRegularized[List[${a
      .slice(0, 3)
      .map((x) => toWolfram(x))
      .join(", ")}], List[${a
      .slice(3, 5)
      .map((x) => toWolfram(x))
      .join(", ")}], ${toWolfram(a[5])}]`,
  // FunctionContinuous(f, x, domain) puts the domain restriction as a third argument;
  // Wolfram's own FunctionContinuous[{f, domain}, x] embeds it in a list alongside f
  // instead (confirmed directly: `FunctionContinuous[f, cond]` itself errors
  // `isvar`) — a restructuring, not a rename. The 2-arg form (no domain) is a plain call.
  // Midpoint(p, q) takes the two points; Wolfram's Midpoint[{p, q}] takes them as a list
  // (`Midpoint[p, q]` stays unevaluated there).
  Midpoint: (a) => (a.length === 2 ? `Midpoint[List[${toWolfram(a[0]!)}, ${toWolfram(a[1]!)}]]` : call("Midpoint", a)),
  FunctionContinuous: (a) =>
    a.length === 3
      ? `FunctionContinuous[List[${toWolfram(a[0])}, ${toWolfram(a[2])}], ${toWolfram(a[1])}]`
      : call("FunctionContinuous", a),
  // compute-engine's `Function` is `[body, ...params]`, canonicalized with `body` wrapped in
  // its own scoping `Block` (see function-utils.d.ts) — CE-internal, not something Wolfram's
  // own `Function` ever shows, so it's unwrapped here. Wolfram's shape is `Function[{params},
  // body]` (or bare `Function[body]` for the anonymous-parameter case, 0 params). Needed for
  // any multi-parameter Function literal, holonomic reductions included.
  // A single parameter is Wolfram's own bare form (its FullForm agrees: `Function[x, x^2]`,
  // not `Function[{x}, x^2]` — both parse, but the bare form is canonical there); 2+ needs the
  // list.
  Function: (a) => {
    const [rawBody, ...params] = a;
    const body = Array.isArray(rawBody) && rawBody[0] === "Block" ? rawBody[1] : rawBody;
    // Slot parameters (`_1`, or `Slot[1]` from an emitter that has already written them) are
    // the anonymous form: `Function[f[#]]`, not `Function[#, f[#]]`.
    if (params.every((p) => typeof p === "string" && /^(_\d*|Slot\[\d+\])$/.test(p)))
      return `Function[${toWolfram(body)}]`;
    if (params.length === 1) return `Function[${toWolfram(params[0])}, ${toWolfram(body)}]`;
    return `Function[List[${params.map((p) => toWolfram(p)).join(", ")}], ${toWolfram(body)}]`;
  },
  // Module(vars, body)/With(vars, body): compute-engine spells a local's initial value
  // `Equal(n, 10)` (`n == 10`, a mathematical equality) — the same head an actual equation
  // uses. Wolfram's Module/With need an ASSIGNMENT there (`Set[n, 10]`, its FullForm for
  // `n = 10`); left as `Equal`, Wolfram reads a boolean test where it expects a binding, so
  // the vars list isn't a valid local-variable spec at all and the whole call stays
  // unevaluated. Only a binding's own `Equal` is rewritten, not one deeper in the body.
  Module: (a) => localScope("Module", a),
  With: (a) => localScope("With", a),
  // Limit(Function(body[, x]), point[, dir]): our `Function` argument stays a pure function
  // (Slot-based `body&`, or `x |-> body`) all the way through -- Wolfram's `Limit` instead
  // wants the plain expression and a `Rule` binding the point (`Limit[body, x -> point]`),
  // never a Function it would apply. `unwrapFunctionArg` gives the (variable, body) pair,
  // minting a fresh `x` and substituting it for the anonymous form's Slot refs when the
  // function has no named parameter. `dir` is our own +1/-1 (checked directly: `Limit(1/x,
  // 0, 1)` is PositiveInfinity, the RIGHT-hand limit -- `x` approaching 0 from values ABOVE
  // it), which is `Direction -> "FromAbove"` in Wolfram's current (string, not signed-number)
  // spelling; -1 is `"FromBelow"`.
  Limit: (a) => {
    const [fn, point, dir] = a;
    const { variable, body } = unwrapFunctionArg(fn, "x");
    const binding = `Rule[${variable}, ${toWolfram(point)}]`;
    if (dir === undefined) return `Limit[${toWolfram(body)}, ${binding}]`;
    const dirValue = typeof dir === "number" ? dir : typeof dir === "string" ? Number(dir) : undefined;
    const direction = dirValue === 1 ? `"FromAbove"` : dirValue === -1 ? `"FromBelow"` : toWolfram(dir);
    return `Limit[${toWolfram(body)}, ${binding}, Rule[Direction, ${direction}]]`;
  },
  // Map(f, xs) is Wolfram's own Map[f, xs]; Map(f, xs, ys, …) with MORE than one collection
  // zips them elementwise instead (confirmed against compute-engine's own description,
  // "apply a function to each element" -- for several collections, element-wise together) --
  // Wolfram's Map never takes more than one collection, so that shape is MapThread[f, {xs,
  // ys, …}] there.
  Map: (a) => {
    const [f, ...collections] = a;
    if (collections.length <= 1) return call("Map", a);
    return `MapThread[${toWolfram(f)}, List[${collections.map((c) => toWolfram(c)).join(", ")}]]`;
  },
  // Table(body, iterator) with an actual iterator (Set/Limits/Tuple -- `i` from `a` to `b`)
  // is a plain rename (falls through via HEADS). Table(f, n) -- OUR OWN Tabulate-shaped
  // overload, `f` applied to each of the first `n` naturals -- has no such Wolfram overload
  // (`Table[f, n]` there is `n` copies of the plain SYMBOL `f`, not `n` calls to it); Wolfram
  // needs the same `body, {i, n}` shape as any other Table, so `f`/`Function(body[, i])` is
  // unwrapped the same way `Limit` above does, and wrapped in a fresh iterator.
  Table: (a) => {
    const [fn, spec] = a;
    const isIteratorSpec =
      (Array.isArray(spec) && ["Set", "Limits", "Tuple"].includes(spec[0] as string)) ||
      (typeof spec === "string" && /^(Set|Limits|Tuple)\[/.test(spec));
    if (a.length !== 2 || isIteratorSpec) return call("Table", a);
    const { variable, body } = unwrapFunctionArg(fn, "i");
    return `Table[${toWolfram(body)}, List[${variable}, ${toWolfram(spec)}]]`;
  },
  // `Over -> R` is our own ring-selection option (never a Wolfram key -- a key is never a
  // domain/collection name, #417's retirement of `GaussianIntegers -> True`); Wolfram's
  // IsPrime/FactorInteger/Divisors/… spell the same choice of ring as their own
  // `GaussianIntegers -> True/False` option instead. Recognised ring VALUES translate to
  // that; anything else falls through to the generic `Rule[key, value]` rename (which
  // `Over` itself, having no Wolfram counterpart, would emit unhelpfully -- there is no
  // other ring to translate yet).
  KeyValuePair: (a) => {
    const [key, value] = a;
    return ringOption(key, value) ?? `Rule[${toWolfram(key)}, ${toWolfram(value)}]`;
  },
  // Count(collection) -- no value/predicate, our own collection's cardinality -- is Wolfram's
  // Length, not a bare Count[collection]: Wolfram's Count always needs a pattern argument, so
  // the 1-arg call has no counterpart there and stays unevaluated as written.
  //
  // Count(list, predicate) is a PREDICATE test; Wolfram's Count[list, pattern] takes a
  // pattern instead, so a bare rename (`Count[list, pred]`) asks Wolfram to match `pred`
  // LITERALLY rather than call it -- the pattern that DOES call it is `_?pred`
  // (`PatternTest[Blank[], pred]` in full form). Count(list, value) -- a plain value, not a
  // `Function` -- is already exact-equality, which is what a bare rename gives correctly, so
  // only the `Function`-literal predicate form is rewritten.
  Count: (a) => {
    if (a.length === 1) return `Length[${toWolfram(a[0])}]`;
    if (a.length === 2) {
      const parts = headArgs(a[1]);
      if (parts?.head === "Function") {
        return `Count[${toWolfram(a[0])}, PatternTest[Blank[], ${toWolfram(a[1])}]]`;
      }
    }
    return call("Count", a);
  },
  // IsArray(a, test) checks `test` holds of every LEAF; Wolfram's ArrayQ[array, patt, test]
  // takes the same test as its THIRD argument, with a level pattern (`_`, any depth) in
  // between -- our 2-arg call has no slot for that pattern, so a bare rename hands `test`
  // to ArrayQ's PATTERN position instead, where it means something else entirely.
  IsArray: (a) => (a.length === 2 ? `ArrayQ[${toWolfram(a[0])}, Blank[], ${toWolfram(a[1])}]` : call("ArrayQ", a)),
  // Thread(Equal(l1, l2)): Wolfram evaluates the argument to Thread BEFORE Thread ever sees
  // it, and `Equal` on two same-length lists is a whole-list equality test (a single
  // Boolean), not an elementwise one -- so by the time Thread runs, its argument has already
  // collapsed to `True`/`False` and there is nothing left to thread over.
  // `Unevaluated[...]` defers that evaluation to Thread itself, which is what our own
  // `Thread` always meant (matches Wolfram unchanged when the scalar-broadcast case leaves
  // `Equal` unevaluated on its own -- Unevaluated is a no-op there, not a behavior change).
  Thread: (a) => {
    const parts = a.length === 1 ? headArgs(a[0]) : undefined;
    if (parts?.head === "Equal") return `Thread[Unevaluated[${toWolfram(a[0])}]]`;
    return call("Thread", a);
  },
  // Random(domain, n) draws n times WITH replacement (engine/random.ts's ARMS: every draw
  // is an independent uniform-index sample) -- Wolfram's population sampler for that is
  // RandomChoice[list, n], not RandomReal (the identity rename, right only for the no-domain
  // and interval/distribution forms). A distribution or `Interval` domain keeps the identity
  // rename; anything else array-shaped is a finite collection to draw from.
  Random: (a) => {
    if (a.length === 0) return call("RandomReal", a);
    const domain = a[0];
    const parts = headArgs(domain);
    const isDistribution = typeof parts?.head === "string" && parts.head.endsWith("Distribution");
    if (parts === undefined || isDistribution || parts.head === "Interval") return call("RandomReal", a);
    const shape = a[1];
    return shape === undefined
      ? `RandomChoice[${toWolfram(domain)}]`
      : `RandomChoice[${toWolfram(domain)}, ${toWolfram(shape)}]`;
  },
  // Subsets(n, spec)/Tuples(n, k): our own carrier-sized overload, `n` standing for the
  // first `n` naturals rather than an explicit collection -- Wolfram's Subsets/Tuples take
  // only an actual collection, so a bare integer first argument becomes `Range[n]`.
  Subsets: (a) =>
    a.length >= 1 && isIntegerLiteral(a[0])
      ? `Subsets[${[`Range[${toWolfram(a[0])}]`, ...a.slice(1).map((x) => toWolfram(x))].join(", ")}]`
      : call("Subsets", a),
  Tuples: (a) =>
    a.length === 2 && isIntegerLiteral(a[0])
      ? `Tuples[Range[${toWolfram(a[0])}], ${toWolfram(a[1])}]`
      : call("Tuples", a),
  // CycleDecomposition(Permutation(...))/Permutation(CycleDecomposition(...)) is a FORMAT
  // CONVERSION (cycle notation <-> one-line notation) -- `PermutationCycles`/
  // `PermutationList∘Cycles` are Wolfram's own conversions between the two. OUTSIDE that
  // composition, neither head gets a SPECIAL case here: a bare `Permutation(list)` (no
  // Wolfram head of its own) stays the literal, unmapped `Permutation[List[...]]` this
  // transpiler always gave it -- the oracle's own bare-contents unwrap (`emit.ts`'s
  // CARRIER_NAMES fallback) already turns that into Wolfram's plain list for the "wolfram"
  // reference column; only the COMPOSED case needs help, and only `emit.ts` (which sees the
  // raw, unwalked tree) can tell composed from bare apart -- see its own CycleDecomposition/
  // Permutation special case.
  CycleDecomposition: (a) => {
    const parts = headArgs(a[0]);
    if (parts?.head === "Permutation") return `PermutationCycles[${toWolfram(parts.args[0])}]`;
    return call("CycleDecomposition", a);
  },
  Permutation: (a) => {
    const parts = headArgs(a[0]);
    if (parts?.head === "CycleDecomposition") return `PermutationList[Cycles[${toWolfram(parts.args[0])}]]`;
    return call("Permutation", a);
  },
  // ClosenessCentrality(g, v) selects one vertex's value; Wolfram's ClosenessCentrality has
  // no such 2-argument form (only `ClosenessCentrality[g]`, a list over every vertex in
  // `VertexList[g]` order) -- `Part[...]` picks the same position out of that list. Exact
  // for a graph whose vertex labels already run `1..n` in `VertexList` order (every call
  // this maps today), not a general vertex-name lookup.
  ClosenessCentrality: (a) =>
    a.length === 2
      ? `Part[ClosenessCentrality[${toWolfram(a[0])}], ${toWolfram(a[1])}]`
      : call("ClosenessCentrality", a),
};

/** `x` is a plain integer literal, in whichever of the two forms a `SPECIAL` case may see it
 * (see `unwrapFunctionArg`'s doc comment): raw MathJson, or an already-rendered Wolfram
 * source string (from `@enumeratio/oracle`'s pre-walked `emit`). */
function isIntegerLiteral(x: MathJson): boolean {
  if (typeof x === "number") return Number.isInteger(x);
  if (typeof x === "string") return /^-?\d+$/.test(x);
  if (typeof x === "object" && x !== null && "num" in x) return /^-?\d+$/.test(x.num);
  return false;
}

/**
 * Unwraps a `Limit`/`Table` function argument into its bound variable and body, for the
 * Wolfram forms (`Limit[body, x -> point]`, `Table[body, {i, n}]`) that take the two apart
 * rather than a pure function. A `Function` literal with a named parameter (`Function(body,
 * x)`) uses that name; the anonymous, Slot-based form (`Function(body)`, no params, `_1`/`_`
 * inside) mints `fallback` as a fresh variable and substitutes it for the slot. A bare,
 * non-`Function` argument (`f` itself, our own Tabulate-shaped `Table(f, n)` overload) is
 * treated as a callable applied to the fresh variable: `f[i]`.
 *
 * `fn` arrives one of two ways, and this handles both: raw MathJSON (array or `{fn:[...]}`),
 * when `toWolfram` is called directly (the `fullform` reference column, this package's own
 * tests); or an ALREADY-RENDERED Wolfram source string, when it's reached through
 * `@enumeratio/oracle`'s `emit` -- which pre-walks every operand (to collect its own
 * `missing`/free-variable bookkeeping) before calling `toWolfram` with the walked, now
 * string, results. The rest of this file's SPECIAL cases dodge that distinction for free:
 * `toWolfram` on an already-rendered string is the identity (nothing here matches its own
 * Slot/subscript/quote syntax), so wrapping one in more Wolfram source is transparent. This
 * one has to look INSIDE the argument (the variable name, the Slot substitution), so it
 * can't just forward blindly -- the string form gets its own textual `Function[...]` parse.
 */
function unwrapFunctionArg(fn: MathJson, fallback: string): { variable: string; body: MathJson } {
  if (typeof fn === "string") {
    const m = /^Function\[([\s\S]*)\]$/.exec(fn);
    if (m === null) return { variable: fallback, body: `${fn}[${fallback}]` };
    const parts = splitTopLevel(m[1]);
    if (parts.length >= 2) return { variable: parts[0], body: parts.slice(1).join(", ") };
    return { variable: fallback, body: parts[0].replace(/Slot\[1\]/g, fallback) };
  }
  const parts = headArgs(fn);
  if (parts && parts.head === "Function") {
    const [rawBody, ...params] = parts.args;
    const rawBodyParts = headArgs(rawBody);
    const body = rawBodyParts?.head === "Block" ? rawBodyParts.args[0] : rawBody;
    if (params.length >= 1) return { variable: toWolfram(params[0]), body };
    return { variable: fallback, body: substituteSlot(body, fallback) };
  }
  return { variable: fallback, body: [fn, fallback] };
}

/** `node`'s head and arguments, whichever of the THREE shapes it may arrive in (see
 * `unwrapFunctionArg`'s doc comment, the same distinction): a bare array, the `{fn:[...]}`
 * object form, or an ALREADY-RENDERED Wolfram source string (`@enumeratio/oracle`'s `emit`
 * pre-walks every operand before a `SPECIAL` case ever sees it, so a nested call reaches
 * here as `"Head[a, b]"` text, not a tree) -- `undefined` for anything else (an atom, or a
 * string that doesn't parse as one call). The args of the string form are themselves
 * Wolfram source text, not raw MathJson, but every caller only ever re-`toWolfram`s them
 * (identity on already-rendered text) or checks their own head recursively, so that's fine. */
function headArgs(node: MathJson): { head: MathJson; args: MathJson[] } | undefined {
  if (Array.isArray(node)) return { head: node[0], args: node.slice(1) };
  if (node && typeof node === "object" && "fn" in node) return { head: node.fn[0], args: node.fn.slice(1) };
  if (typeof node === "string") {
    const m = /^([A-Za-z][A-Za-z0-9]*)\[([\s\S]*)\]$/.exec(node);
    if (m === null) return undefined;
    const inside = m[2].trim();
    return { head: m[1], args: inside === "" ? [] : splitTopLevel(inside) };
  }
  return undefined;
}

/** `s` split at its top-level commas -- ones outside any `[...]` nesting -- the way a
 * `Head[a, b, c]`'s own argument list would be, given just its inside (`a, b, c`). */
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "[") depth++;
    else if (c === "]") depth--;
    else if (c === "," && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts.map((p) => p.trim());
}

/** `_n`/`_` (Slot 1) replaced by `fresh`, everywhere in `node` except inside a nested
 * `Function`'s own body -- that function has its own, separately-scoped slots. */
function substituteSlot(node: MathJson, fresh: string): MathJson {
  if (typeof node === "string") return /^_(\d*)$/.test(node) ? fresh : node;
  if (Array.isArray(node)) {
    if (node[0] === "Function") return node;
    return node.map((child) => substituteSlot(child, fresh));
  }
  if (node && typeof node === "object") {
    if ("sym" in node) return /^_(\d*)$/.test(node.sym) ? { sym: fresh } : node;
    if ("fn" in node)
      return node.fn[0] === "Function" ? node : { fn: node.fn.map((child) => substituteSlot(child, fresh)) };
  }
  return node;
}

function localScope(head: string, args: MathJson[]): string {
  const [vars, body] = args;
  const rewrite = (v: MathJson): string =>
    Array.isArray(v) && v[0] === "Equal" ? `Set[${toWolfram(v[1])}, ${toWolfram(v[2])}]` : toWolfram(v);
  const varsSource =
    Array.isArray(vars) && vars[0] === "List" ? `List[${vars.slice(1).map(rewrite).join(", ")}]` : rewrite(vars);
  return `${head}[${varsSource}, ${toWolfram(body)}]`;
}

/** Whether the transpiler vouches for a head — as opposed to passing it through by name. */
export const isWolframHead = (head: string): boolean => head in HEADS || head in SPECIAL;

const call = (head: string, args: MathJson[]): string => `${head}[${args.map((a) => toWolfram(a)).join(", ")}]`;

/** Serialise a MathJSON value to a Wolfram Language expression string. */
export function toWolfram(node: MathJson): string {
  if (typeof node === "number") return numberToWolfram(node);
  if (typeof node === "boolean") return node ? "True" : "False";
  if (typeof node === "string") return symbolToWolfram(node);

  if (Array.isArray(node)) return applyHead(node[0], node.slice(1));

  if (typeof node === "object") {
    if ("num" in node) return numberToWolfram(node.num);
    if ("str" in node) return JSON.stringify(node.str);
    if ("sym" in node) return symbolToWolfram(node.sym);
    if ("fn" in node) return applyHead(node.fn[0], node.fn.slice(1));
  }
  return "Null";
}

function applyHead(head: MathJson, args: MathJson[]): string {
  if (typeof head !== "string") return call(toWolfram(head), args);
  const special = SPECIAL[head];
  if (special) return special(args);
  if (head in FOREIGN) return call(`${CONTEXT}${head}`, args);
  return call(HEADS[head] ?? head, args);
}

/** A bare MathJSON string is a symbol, a `'quoted'` one a string literal, and
 * `_n` the n-th anonymous-function parameter, which Wolfram spells `Slot[n]` (bare
 * `_` is compute-engine's shorthand for `_1`). An
 * underscore is a pattern in Wolfram, never part of a name, so a subscripted
 * symbol like `e_1` becomes `Subscript[e, 1]`. */
function symbolToWolfram(s: string): string {
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) return JSON.stringify(s.slice(1, -1));
  const slot = /^_(\d*)$/.exec(s);
  if (slot) return `Slot[${slot[1] || 1}]`;
  const subscript = /^([A-Za-z][A-Za-z0-9]*)_([A-Za-z0-9]+)$/.exec(s);
  if (subscript) return `Subscript[${subscript[1]}, ${subscript[2]}]`;
  // `All` bare is Wolfram's own level-spec/wildcard symbol (a `Part`/`At` span, a third
  // `Ordering` argument, an `IntegerPartitions`/`PartitionsQ` "any part" spec) -- genuinely
  // its own thing there, never `AllTrue`. Only the predicate HEAD `All(pred)` means
  // `AllTrue` (`HEADS["All"]`, consulted below); a BARE reference must skip that mapping.
  if (s === "All") return "All";
  // A head passed as a value (`Scan(xs, Add)`) takes its Wolfram name too. FOREIGN is
  // deliberately NOT consulted here: `GaussianIntegers` bare is genuinely ambiguous between
  // our own carrier's type-space symbol and Wolfram's real option flag (`PrimeQ[n,
  // GaussianIntegers -> True]` has to keep the UNPREFIXED name, since that IS the real
  // option) -- `applyHead` below still contextualises a CALL to one of our own heads, which
  // is the case that actually needs it.
  return SYMBOLS[s] ?? HEADS[s] ?? s;
}

function numberToWolfram(n: number | string): string {
  const s = String(n).replace(/^\+/, "");
  if (s === "Infinity") return "Infinity";
  if (s === "-Infinity") return "-Infinity";
  if (s === "NaN") return "Indeterminate";
  // Wolfram's exponent marker is `*^`; `1.5e3` would parse as `1.5 * e3`.
  return s.replace(/[eE]\+?/, "*^");
}
