// MathJSON → Wolfram Language source. Wolfram's uniform `Head[args]` syntax
// means most of the work is a name map (compute-engine head → WL symbol) plus a
// handful of structural forms; unmapped heads fall through as `Head[args]`, so
// coverage degrades gracefully. Pure (MathJSON in, string out): no compute-engine
// dependency, so it ports cleanly into a compute-engine LanguageTarget later.

import { WOLFRAM_NAMES } from "./wolfram-names-data.ts";

export type MathJson =
  | number
  | string
  | boolean
  | { num: string }
  | { str: string }
  | { sym: string }
  | { fn: MathJson[] }
  | MathJson[];

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
  // Our analytic library declares `Catalan` under Wolfram's own spelling, so the constant
  // reaches here by two names. The reverse map keeps `CatalanConstant`, which is the one
  // compute-engine ships.
  Catalan: "Catalan",
  True: "True",
  False: "False",
  NaN: "Indeterminate",
  PositiveInfinity: "Infinity",
  NegativeInfinity: "-Infinity",
  ComplexInfinity: "ComplexInfinity",
  Nothing: "Null",
  // @enumeratio/aestimatio's own marker, under Wolfram's `$`-prefixed spelling — compute-engine's
  // symbol grammar rejects a leading `$` (see aestimatio/src/declare.ts).
  Aborted: "$Aborted",
};

/** compute-engine head → Wolfram head, generated from every head's `names.wolfram` /
 * `names.wolframIdentity` field (design/speculative/symbol-metadata.md step 4;
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
  Area: "the area of a geometric region",
  Perimeter: "the perimeter of a geometric region",
  Depth: "the number of indices needed to reach any part of an expression",
  Order: "the canonical-order comparison Order[a, b]",
  Composition: "a composition of functions, Composition[f, g]",
  Word: "the token specification used by Read and Find",
  Restricted: "an Interpreter form narrowed by a condition",
  // Ours is the carrier's plural type-space symbol (design/domains.md §2 — Element(x,
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
  // Derivative(f, n): compute-engine's own order (function first, order second) — same
  // as Wolfram's `Derivative[n][f]`, just swapped.
  Derivative: (a) => `Derivative[${toWolfram(a[1])}][${toWolfram(a[0])}]`,
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
  // Clamp(x, lo, hi) is Clip[x, {lo, hi}]; the 1-arg form clips to [-1, 1] in both.
  Clamp: (a) =>
    a.length === 3 ? `Clip[${toWolfram(a[0])}, List[${toWolfram(a[1])}, ${toWolfram(a[2])}]]` : call("Clip", a),
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
  // Wolfram's interval is closed and takes its bounds as a list: `Interval[{a, b}]`.
  Interval: (a) =>
    a.length === 2 && !a.some((b) => Array.isArray(b) && b[0] === "Open")
      ? `Interval[${call("List", a)}]`
      : call("Interval", a),
  // IndexOf returns 0 when absent; FirstPosition returns Missing unless given a default.
  IndexOf: (a) => `First[FirstPosition[${toWolfram(a[0])}, ${toWolfram(a[1])}, List[0]]]`,
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
    if (params.length === 0) return `Function[${toWolfram(body)}]`;
    if (params.length === 1) return `Function[${toWolfram(params[0])}, ${toWolfram(body)}]`;
    return `Function[List[${params.map((p) => toWolfram(p)).join(", ")}], ${toWolfram(body)}]`;
  },
};

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
