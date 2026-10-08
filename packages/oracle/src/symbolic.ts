// Deciding whether a symbolic answer — one with a free variable in it — agrees with ours.
//
// `compare` (compare.ts) and `compareTrees` (structural.ts) both prove disagreement fine, but
// neither can prove agreement past a spelling difference: `Sqrt[1 - x^2]` and our own
// `Sqrt(1 - x^2)` line up by luck of both sides landing on the same closed form, but
// `Cos[ArcSin[x]]` staying unevaluated where compute-engine's rule already folded it to
// `Sqrt(1 - x^2)` would read as a false disagreement. The real test is whether the
// DIFFERENCE is identically zero, which is what a CAS's simplifier is for — so for a
// symbolic system (SYMBOLIC_SYSTEMS: wolfram, sympy, sage) an example with a free symbol is
// evaluated as one self-contained "does this vanish" query instead of "what is this",
// built here and interpreted by `interpretSymbolicAgreement`. When the simplifier itself
// can't decide (an identity it won't reduce automatically), three fixed rational points
// stand in for a numeric check — not a proof, but enough to catch the arithmetic actually
// being wrong, which is what a disagreement at this scale usually is.
//
// One self-contained kernel source, evaluated inside the ordinary per-system batch
// (run.ts/runIn) like any other example — no second round trip.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { DEFINED_NAMES } from "./defined-names-data.ts";
import { emit, type MathJSON } from "./emit.ts";
import type { SymbolicSystem } from "./systems.ts";
import type { Verdict } from "./compare.ts";

/** Heads whose VALUE carries something other than plain numbers/expressions — an association,
 * a set of rules, a substitution pair. "Is the difference zero" is nonsense for these: a `Rule`
 * isn't a number at all, so subtracting two of them doesn't test the thing this module exists
 * to test, and every one of these found scanning #A-72 phase 2's newly-emitting rows came back
 * `Indeterminate` — not a kernel quirk, a category error in asking the question at all
 * (`Maximize`'s `{value, {x -> argmax}}` pair, and so on). */
const STRUCTURED_HEADS = new Set([
  "Set",
  "Association",
  "Rule",
  "KeyValuePair",
  "Missing",
  // A proposition is not a number either: the difference of two `Equal`s is nothing, and
  // asking for it comes back `Indeterminate` however well the two sides agree.
  "Equal",
  "NotEqual",
  "Less",
  "LessEqual",
  "Greater",
  "GreaterEqual",
  "And",
  "Or",
  "Not",
]);

/** Heads of an answer that states something rather than computes a value: compared as statements. */
const PROPOSITIONS = new Set([
  "Equal",
  "NotEqual",
  "Less",
  "LessEqual",
  "Greater",
  "GreaterEqual",
  "Inequality",
  "And",
  "Or",
  "Not",
]);

/**
 * Whether `expr`'s value is a structure "is the difference zero" can't meaningfully ask about.
 * A bare `STRUCTURED_HEADS` call always is. A `List`/`Tuple` is NOT, on its own (BL-25): a list
 * or matrix answer's elements are ordinarily plain numbers/expressions, so "the difference is
 * zero" is exactly the right question, just asked elementwise — `wolfram`'s branch below does
 * that with `Flatten`, rather than expecting `FullSimplify` of a list difference to collapse to
 * the bare scalar `0` it never will. But `Maximize`'s `{value, {x -> argmax}}` is ALSO a `List`
 * at the top, one that happens to carry a `Rule` a level down — recursing into a `List`/`Tuple`
 * catches that: any genuinely non-arithmetic content anywhere in the nesting still bails,
 * exactly as a bare `Rule`/`Association` at the top would. */
const isStructured = (expr: MathJSON): boolean => {
  if (!Array.isArray(expr) || typeof expr[0] !== "string") return false;
  if (STRUCTURED_HEADS.has(expr[0])) return true;
  if (expr[0] === "List" || expr[0] === "Tuple") return expr.slice(1).some((e) => isStructured(e as MathJSON));
  return false;
};

/** Small fixed rationals, none of them 0/1/-1 and no two equal, so a substitution steers
 * past the roots and poles a real identity is more likely to trip on at a "nice" point.
 * Fixed, not re-randomised per run: a flaky verdict would be worse than a lucky one. */
const RATIONALS: readonly (readonly [number, number])[] = [
  [7, 3],
  [-11, 5],
  [13, 4],
  [-17, 6],
  [19, 8],
  [-23, 9],
];

/** Where a variable over the integers is sampled: distinct, none of 0, 1 or -1. */
const INTEGERS: readonly number[] = [3, 5, 4, 7, 6, 8];

const NUMBER_OF_TRIALS = 3;

/** What the check prints when its samples are not numbers because an answer is no value to sample (a
 * function, a rule, a call the kernel declined): the plain comparison decides instead. */
export const NOT_NUMERIC = "NotNumeric";

const SERIES_HEADS = new Set(["Series", "SeriesData", "BigO"]);

/** Whether `expr` asks for or holds a series. */
const involvesSeries = (expr: MathJSON): boolean =>
  Array.isArray(expr) &&
  typeof expr[0] === "string" &&
  (SERIES_HEADS.has(expr[0]) || expr.slice(1).some((operand) => involvesSeries(operand as MathJSON)));

/** Seconds the kernel may spend simplifying a difference before the numeric trials take over. */
export const SYMBOLIC_SECONDS = 10;

/** Heads that take their second operand's variable as a step over the integers. */
const DISCRETE_STEPS = new Set(["DifferenceDelta", "DiscreteRatio", "DiscreteShift"]);

const bareName = (e: MathJSON | undefined): string | undefined =>
  typeof e === "string" && !/^'.*'$/s.test(e) ? e : undefined;

/** A step call by its definition, for a kernel that holds `DifferenceDelta[f[k], k]` symbolic and
 * would read the call at a number as nothing: `f(k + 1) - f(k)`, `f(k + 1) / f(k)`, `f(k + h)`. */
const STEP_DEFINITIONS =
  "{DifferenceDelta[g_, v_Symbol] :> (g /. v -> v + 1) - g, DiscreteRatio[g_, v_Symbol] :> (g /. v -> v + 1)/g, " +
  "DiscreteShift[g_, {v_Symbol, h_}] :> (g /. v -> v + h), DiscreteShift[g_, v_Symbol] :> (g /. v -> v + 1)}";

/** The variables `expr` steps by one: the second operand of a `DifferenceDelta` or `DiscreteRatio`. */
export function stepVariables(expr: MathJSON, found: Set<string> = new Set()): Set<string> {
  if (!Array.isArray(expr) || typeof expr[0] !== "string") return found;
  const [head, ...operands] = expr as [string, ...MathJSON[]];
  if (DISCRETE_STEPS.has(head)) {
    for (const step of operands.slice(1)) {
      const name = bareName(Array.isArray(step) && (step[0] === "List" || step[0] === "Tuple") ? step[1] : step);
      if (name !== undefined) found.add(name);
    }
  }
  for (const operand of operands) stepVariables(operand, found);
  return found;
}

/** The variables of `expr` that range over the integers: a step variable, and a `Sum`/`Product`
 * index with any bare bound it names. Wolfram's q-functions and `BetaRegularized` have no value at
 * a rational step, so sampling one there decides nothing. */
export function discreteVariables(expr: MathJSON, found: Set<string> = stepVariables(expr)): Set<string> {
  if (!Array.isArray(expr) || typeof expr[0] !== "string") return found;
  const [head, ...operands] = expr as [string, ...MathJSON[]];
  if (head === "Sum" || head === "Product") {
    for (const range of operands.slice(1)) {
      if (!Array.isArray(range) || !["List", "Tuple", "Limits"].includes(range[0] as string)) continue;
      for (const bound of range.slice(1)) {
        const name = bareName(bound as MathJSON);
        if (name !== undefined) found.add(name);
      }
    }
  }
  for (const operand of operands) discreteVariables(operand, found);
  return found;
}

/** Integral transforms: after the function come the variable it is taken in and the variable of
 * the result. */
const TRANSFORMS = new Set([
  "LaplaceTransform",
  "InverseLaplaceTransform",
  "HankelTransform",
  "MellinTransform",
  "InverseMellinTransform",
]);

/** The bare variables a transform call names at `operands[from..to)`. */
function transformVariables(expr: MathJSON, from: number, to: number, found: Set<string> = new Set()): Set<string> {
  if (!Array.isArray(expr) || typeof expr[0] !== "string") return found;
  const [head, ...operands] = expr as [string, ...MathJSON[]];
  if (TRANSFORMS.has(head)) {
    for (const variable of operands.slice(from, to)) {
      const name = bareName(variable);
      if (name !== undefined) found.add(name);
    }
  }
  for (const operand of operands) transformVariables(operand, from, to, found);
  return found;
}

/** The variables a transform integrates over: bound inside the call, so not a point to sample
 * (`LaplaceTransform[f, 2, s]` is not a transform at all), and gone from its answer. */
export const boundVariables = (expr: MathJSON): Set<string> => transformVariables(expr, 1, 2);

/** The variable of a transform's answer: sampled at positive values, since a negative or zero
 * point is outside the domain the transform is defined on and decides nothing. */
export const positiveVariables = (expr: MathJSON): Set<string> => transformVariables(expr, 2, 3);

/** The variables a derivative is taken in (`D(f, x)`, `D(f, [x, 2])`): differentiating at a number
 * raises in SymPy and Sage, so the answer is compared in the variable instead of at a sample. */
export function derivativeVariables(expr: MathJSON, found: Set<string> = new Set()): Set<string> {
  if (!Array.isArray(expr) || typeof expr[0] !== "string") return found;
  const [head, ...operands] = expr as [string, ...MathJSON[]];
  if (head === "D") {
    for (const spec of operands.slice(1)) {
      const name = bareName(Array.isArray(spec) && (spec[0] === "List" || spec[0] === "Tuple") ? spec[1] : spec);
      if (name !== undefined) found.add(name);
    }
  }
  for (const operand of operands) derivativeVariables(operand, found);
  return found;
}

/** The expansion variables of `Series(f, x, x0, n)` (or `Series(f, [x, x0, n])`): bound inside the
 * call, so never a point to sample there (`Series[f, {7/3, x0, n}]` is Series::ivar). */
export function seriesVariables(expr: MathJSON, found: Set<string> = new Set()): Set<string> {
  if (!Array.isArray(expr) || typeof expr[0] !== "string") return found;
  const [head, ...operands] = expr as [string, ...MathJSON[]];
  if (head === "Series") {
    for (const spec of operands.slice(1)) {
      const first = Array.isArray(spec) && (spec[0] === "List" || spec[0] === "Tuple") ? spec[1] : spec;
      const name = bareName(first as MathJSON);
      if (name !== undefined) found.add(name);
      // The bare form names only its first operand; the rest are center and order.
      if (!Array.isArray(spec)) break;
    }
  }
  for (const operand of operands) seriesVariables(operand, found);
  return found;
}

const rationalLiteral = ([n, d]: readonly [number, number]): MathJSON => ["Rational", n, d];

/** `expr` with every occurrence of a name in `subs` replaced by its rational — the head of a
 * call is never substituted, so a free symbol that happened to share a head's name (unlikely,
 * but names are user text) can't corrupt the call shape. */
function substituteFreeSymbols(expr: MathJSON, subs: ReadonlyMap<string, MathJSON>): MathJSON {
  if (typeof expr === "string" && !/^'.*'$/s.test(expr)) return subs.get(expr) ?? expr;
  if (Array.isArray(expr)) {
    const [head, ...rest] = expr;
    if (typeof head === "string" && rest.length > 0) {
      return [head, ...rest.map((e) => substituteFreeSymbols(e as MathJSON, subs))];
    }
    return expr.map((e) => substituteFreeSymbols(e as MathJSON, subs));
  }
  return expr;
}

/** `freeSymbols`, each bound to a distinct rational for trial `n` (0, 1, 2, …) — cycling
 * through `RATIONALS` with a per-trial offset so the same symbol gets a different value each
 * time, and two different symbols in the same trial never get the same value either. */
function trialSubstitution(
  freeSymbols: readonly string[],
  trial: number,
  discrete: ReadonlySet<string> = new Set(),
  positive: ReadonlySet<string> = new Set(),
): ReadonlyMap<string, MathJSON> {
  return new Map(
    freeSymbols.map((name, i) => {
      const at = (i + trial * freeSymbols.length) % RATIONALS.length;
      const [n, d] = RATIONALS[at] as readonly [number, number];
      return [
        name,
        discrete.has(name) ? (INTEGERS[at] as number) : rationalLiteral([positive.has(name) ? Math.abs(n) : n, d]),
      ];
    }),
  );
}

/** `expr` with the `Simplify`/`FullSimplify` calls around it taken off. */
function withoutSimplifiers(expr: MathJSON): MathJSON {
  return Array.isArray(expr) && (expr[0] === "Simplify" || expr[0] === "FullSimplify") && expr.length === 2
    ? withoutSimplifiers(expr[1] as MathJSON)
    : expr;
}

/** One trial's pair of emitted sources (theirs, ours), or `undefined` when the substituted
 * expression no longer emits for `system` (an unrelated mapping gap, not this mechanism's
 * problem — the trial is just skipped, not the whole check). For Wolfram a step variable or a
 * series variable is not substituted into the call (`DifferenceDelta[f[k], k]` and
 * `Series[f, {x, x0, n}]` need their variable): `after` is what to replace in the evaluated
 * difference instead, as Wolfram rules. `stepped` and `series` say which of the two is held. */
function trialSources(
  system: SymbolicSystem,
  expr: MathJSON,
  expected: MathJSON,
  freeSymbols: readonly string[],
  trial: number,
):
  | {
      readonly theirs: string;
      readonly ours: string;
      readonly after: string;
      readonly stepped: boolean;
      readonly series: boolean;
    }
  | undefined {
  const positive = new Set([...positiveVariables(expr), ...positiveVariables(expected)]);
  const all = trialSubstitution(freeSymbols, trial, discreteVariables(expr), positive);
  const steps = system === "wolfram" ? stepVariables(expr) : new Set<string>();
  // Only Wolfram maps `Series`; a variable it expands in stays the call's own, as a step variable does.
  const series =
    system === "wolfram" ? new Set([...seriesVariables(expr), ...seriesVariables(expected)]) : new Set<string>();
  const held = new Set([...steps, ...series]);
  const bound = new Set([
    ...boundVariables(expr),
    ...boundVariables(expected),
    ...(system === "wolfram" ? [] : derivativeVariables(expr)),
  ]);
  const subs = new Map([...all].filter(([name]) => !held.has(name) && !bound.has(name)));
  // A series is sampled as a polynomial, so the simplifier around it has nothing to do: on a
  // symbolic-coefficient series it only runs out the clock (`FullSimplify[Normal[Series[…]]]`).
  const asked = series.size > 0 ? withoutSimplifiers(expr) : expr;
  const theirs = emit(substituteFreeSymbols(asked, subs), system);
  const ours = emit(substituteFreeSymbols(expected, subs), system);
  if (!theirs.ok || !ours.ok) return undefined;
  const rules = [...all]
    .filter(([name]) => held.has(name))
    .map(([name, value]) => [emit(name, system), emit(value, system)] as const);
  if (rules.some(([name, value]) => !name.ok || !value.ok)) return undefined;
  const after = rules.map(
    ([name, value]) => `${(name as { source: string }).source} -> ${(value as { source: string }).source}`,
  );
  return {
    theirs: system === "wolfram" ? withoutConditions(theirs.source) : theirs.source,
    ours: ours.source,
    after: after.length === 0 ? "{}" : `{${after.join(", ")}}`,
    stepped: [...all.keys()].some((name) => steps.has(name)),
    series: series.size > 0,
  };
}

/**
 * `Solve`'s answer against ours, as sets of solutions. Wolfram answers rules (`{{x -> v}}`),
 * ours are bare values (a tuple per solution for several unknowns), in no fixed order, so
 * "the difference is zero" is asked of each value against its counterpart rather than of
 * the lists. A reply that is not a list of rule lists (Solve declined) is a disagreement.
 */
function solveAgreementSource(theirs: string, ours: string, cap: number): string {
  return (
    `Module[{r = Quiet[TimeConstrained[${theirs}, 20, $Aborted]], o = ${ours}, t, same}, ` +
    `same[v_, w_] := AllTrue[Flatten[{Quiet[TimeConstrained[FullSimplify[v - w], ${cap}, $Aborted]]}], # === 0 &]; ` +
    `If[!MatchQ[r, {{___Rule}...}], False, ` +
    `t = Replace[Values /@ r, {v_} :> v, {1}]; ` +
    `Length[t] == Length[o] && AllTrue[o, Function[v, AnyTrue[t, same[v, #] &]]] && ` +
    `AllTrue[t, Function[w, AnyTrue[o, same[#, w] &]]]]]`
  );
}

/**
 * A proposition against ours, side by side: `a == b` and `c == d` state the same thing when
 * `a - b` and `c - d` differ by nothing, or by a sign (`b == a`); an inequality with the same
 * relation needs each side to match; a conjunction needs each conjunct to. Term order inside a
 * side (`Cos[x] + I Sin[x]` against `I Sin[x] + Cos[x]`) is not a disagreement. A reply of a
 * different shape (`True`, a bare value) is not decided here.
 */
function propositionAgreementSource(theirs: string, ours: string, cap: number): string {
  return (
    `Module[{zero, agree}, ` +
    `zero[e_] := AllTrue[Flatten[{Quiet[TimeConstrained[FullSimplify[e], ${cap}, $Aborted]]}], # === 0 &]; ` +
    `agree[t_And, o_And] /; Length[t] == Length[o] := And @@ MapThread[agree, {List @@ t, List @@ o}]; ` +
    `agree[t_Equal, o_Equal] /; Length[t] == 2 && Length[o] == 2 := ` +
    `zero[t[[1]] - t[[2]] - (o[[1]] - o[[2]])] || zero[t[[1]] - t[[2]] + (o[[1]] - o[[2]])]; ` +
    `agree[t_, o_] /; MatchQ[t, _Less | _LessEqual | _Greater | _GreaterEqual] && Head[t] === Head[o] && ` +
    `Length[t] == 2 && Length[o] == 2 := zero[t[[1]] - o[[1]]] && zero[t[[2]] - o[[2]]]; ` +
    // Any other pair of statements (an `Or`, `x > 0` against `0 < x`): equivalent when the kernel can show it.
    `agree[t_, o_] := Module[{v = Select[Union[Cases[{t, o}, _Symbol, {-1}]], Context[#] =!= "System\`" &], r}, ` +
    `r = Quiet[TimeConstrained[FullSimplify[Equivalent[t, o]], ${cap}, $Aborted]]; ` +
    `If[r === True || r === False, r, ` +
    `r = Quiet[TimeConstrained[If[v === {}, Resolve[Equivalent[t, o], Reals], ` +
    `Resolve[ForAll[Evaluate[v], Equivalent[t, o]], Reals]], 20, $Aborted]]; ` +
    `If[r === True || r === False, r, Indeterminate]]]; ` +
    `agree[${theirs}, ${ours}]]`
  );
}

const ce = new ComputeEngine();

/** Wrappers that ask the kernel to work on their argument; the call inside is what can be left alone. */
const WRAPPERS = new Set(["N", "Simplify", "FullSimplify", "FunctionExpand", "Hold", "Evaluate", "Expand", "Factor"]);
/** Heads that only combine values: keeping one is not a function left unevaluated. */
const COMBINING = new Set([
  "List",
  "Add",
  "Multiply",
  "Power",
  "Divide",
  "Rational",
  "Negate",
  "Subtract",
  "Sqrt",
  "Tuple",
  "Set",
  "Equal",
  "Complex",
  "Pair",
]);

const canonicalText = (expr: MathJSON): string => {
  try {
    return JSON.stringify(ce.box(expr as Parameters<ComputeEngine["box"]>[0]).json);
  } catch {
    return JSON.stringify(expr);
  }
};

/**
 * Whether `expected` still holds some part of the call `expr` asks (canonically, so `Times(1/t, f)`
 * and `Divide(f, t)` are one call): ours left it unevaluated, in whole or in part. A difference of
 * it against the kernel's own evaluation of the same input is zero wherever ours is held, so it
 * can't witness agreement. A held part is a call to the head under test inside a kernel
 * transform (`Simplify`, `FunctionExpand`, …) or an entry of a list answer: a list that
 * holds one entry is not agreement with a list that evaluates all of them.
 */
export function leavesCall(expr: MathJSON, expected: MathJSON): boolean {
  let call = expr;
  while (Array.isArray(call) && WRAPPERS.has(call[0] as string)) call = call[1] as MathJSON;
  if (!Array.isArray(call) || typeof call[0] !== "string") return false;
  // A pure function mapped over a list is its body at each entry, a list of calls.
  if (call[0] === "Map" && call.length === 3 && isFunction(call[1] as MathJSON)) {
    const entries = call[2];
    if (Array.isArray(entries) && entries[0] === "List") {
      const mapped = entries.slice(1).map((entry) => applyFunction(call[1] as MathJSON[], entry as MathJSON));
      if (mapped.every((body) => body !== undefined)) return leavesCall(["List", ...mapped] as MathJSON, expected);
    }
  }
  // A list is held when any entry is: against the entry in the same place if ours is a list of the same length.
  if (call[0] === "List" || call[0] === "Tuple") {
    const kept = Array.isArray(expected) && expected[0] === call[0] && expected.length === call.length;
    return call
      .slice(1)
      .some((entry, i) =>
        leavesCall(entry as MathJSON, kept ? ((expected as MathJSON[])[i + 1] as MathJSON) : expected),
      );
  }
  // Arithmetic over calls is held where an operand's closed call is (`1 + Zeta(3)` as `1 + Zeta(3)`).
  if (COMBINING.has(call[0]))
    return call.slice(1).some((operand) => isClosed(operand as MathJSON) && leavesCall(operand as MathJSON, expected));
  // A call over a list threads: it is held where one entry's call is (`BarnesG([a, b])` as `[BarnesG(a), b]`).
  const [, only] = call;
  if (call.length === 2 && Array.isArray(only) && only[0] === "List") {
    const kept = Array.isArray(expected) && expected[0] === "List" && expected.length === only.length;
    const threaded = only
      .slice(1)
      .some((entry, i) =>
        leavesCall([call[0], entry] as MathJSON, kept ? ((expected as MathJSON[])[i + 1] as MathJSON) : expected),
      );
    if (threaded) return true;
  }
  const head = call[0];
  const asked = call;
  const askedText = canonicalText(asked);
  const visit = (e: MathJSON): boolean =>
    Array.isArray(e) &&
    ((e[0] === head &&
      (canonicalText(e) === askedText ||
        (e.length === asked.length &&
          e.slice(1).every((x, i) => sameValue(x as MathJSON, asked[i + 1] as MathJSON))))) ||
      e.slice(1).some((x) => visit(x as MathJSON)));
  return visit(expected) || holdsAppliedCall(call, expected) || holdsKernelCall(call, expected);
}

/** Heads whose job is to rewrite their first argument's form, and may hand it back as it came. */
const FORM_TRANSFORMS = new Set([
  "FunctionExpand",
  "Simplify",
  "FullSimplify",
  "ComplexExpand",
  "PiecewiseExpand",
  "Refine",
  "Expand",
  "ExpandAll",
  "ExpandNumerator",
  "ExpandDenominator",
  "PowerExpand",
  "ExpToTrig",
  "TrigToExp",
  "TrigExpand",
  "TrigReduce",
  "TrigFactor",
  "LogicalExpand",
  "Together",
  "Apart",
  "Cancel",
  "Collect",
  "Factor",
  "FactorTerms",
]);

const listEntries = (e: MathJSON): readonly MathJSON[] | undefined =>
  Array.isArray(e) && e[0] === "List" ? (e.slice(1) as MathJSON[]) : undefined;

/** The form `expr` asks to be rewritten, as the pieces a rewrite may leave alone: the whole, and a list's entries. */
const rewriteTargets = (expr: MathJSON): MathJSON[] | undefined => {
  if (!Array.isArray(expr)) return undefined;
  // `Assuming(condition, call)` asks `call`; a transformer mapped over a list asks each entry.
  if (expr[0] === "Assuming" && expr.length === 3) return rewriteTargets(expr[2] as MathJSON);
  const mapped = expr[0] === "Map" && expr.length === 3 && FORM_TRANSFORMS.has(expr[1] as string);
  if (!mapped && !FORM_TRANSFORMS.has(expr[0] as string)) return undefined;
  const form = expr[mapped ? 2 : 1] as MathJSON | undefined;
  if (form === undefined) return undefined;
  // An atom has nothing to rewrite.
  return [form, ...(listEntries(form) ?? [])].filter(Array.isArray);
};

/** Whether `node` is `expr`'s form, or one entry of it, written back unchanged. */
export function echoedPart(expr: MathJSON, node: MathJSON): boolean {
  const text = canonicalText(node);
  return rewriteTargets(expr)?.some((target) => canonicalText(target) === text) === true;
}

/**
 * Whether `expr` asks a form to be rewritten and `expected` hands it back, or an entry of it,
 * unchanged: a rewrite ours has not made. It agrees by value with whatever the kernel rewrites
 * it to, which hides the missing rewrite, so it is not agreement unless the kernel leaves the
 * form alone too.
 */
export function echoesInput(expr: MathJSON, expected: MathJSON): boolean {
  return echoedPart(expr, expected) || (listEntries(expected)?.some((entry) => echoedPart(expr, entry)) ?? false);
}

/** `expr` with a `Normal` of a series, under any wrappers, read as the series itself: a series ours
 * holds is the call left undone, though the kernel's polynomial of it is not the series. */
function seriesOfNormal(expr: MathJSON): MathJSON {
  if (!Array.isArray(expr) || expr.length !== 2) return expr;
  const [head, operand] = expr;
  if (head === "Normal" && Array.isArray(operand) && operand[0] === "Series") return operand;
  return WRAPPERS.has(head as string) ? ([head, seriesOfNormal(operand as MathJSON)] as MathJSON) : expr;
}

/** Heads whose call the kernel evaluates but ours may keep held, in whatever form. */
const KERNEL_CALLS = new Set(["Integrate", "Sum", "Product", "Limit", "Solve"]);

/**
 * Whether `call` asks for one of the `KERNEL_CALLS` and `expected` still holds a call to it, not
 * the one asked (ours nests `Integrate(Integrate(…))` where the kernel computes the integral). The
 * kernel evaluates ours too, so the difference from its own answer is zero whatever the answer is.
 */
function holdsKernelCall(call: MathJSON, expected: MathJSON): boolean {
  const heads = (e: MathJSON, found: Set<string> = new Set()): Set<string> => {
    if (Array.isArray(e) && typeof e[0] === "string") {
      if (KERNEL_CALLS.has(e[0])) found.add(e[0]);
      e.slice(1).forEach((operand) => heads(operand as MathJSON, found));
    }
    return found;
  };
  const asked = heads(call);
  return asked.size > 0 && [...heads(expected)].some((head) => asked.has(head));
}

/** Heads that only arrange or bind an answer: a call to one of these is not a function left undone. */
const STRUCTURAL = new Set([
  ...COMBINING,
  ...WRAPPERS,
  "Function",
  "Block",
  "Limits",
  "Rule",
  "KeyValuePair",
  "Nothing",
]);

/** The heads of the calls in the body of every pure function `expr` holds, which do something (not `STRUCTURAL`). */
function appliedHeads(expr: MathJSON, found: Set<string> = new Set(), inBody = false): Set<string> {
  if (!Array.isArray(expr) || typeof expr[0] !== "string") return found;
  if (inBody && !STRUCTURAL.has(expr[0])) found.add(expr[0]);
  for (const operand of expr.slice(1)) appliedHeads(operand as MathJSON, found, inBody || expr[0] === "Function");
  return found;
}

/** Whether `expr` names no free symbol: every bare name is a defined one, a slot, or bound by a
 * `Function` parameter or an iterator (`Limits`) inside it. A closed call is a value a kernel can compute. */
function isClosed(expr: MathJSON): boolean {
  const bound = new Set<string>();
  const bind = (e: MathJSON): void => {
    if (!Array.isArray(e) || typeof e[0] !== "string") return;
    if (e[0] === "Function") for (const name of e.slice(2)) if (typeof name === "string") bound.add(name);
    if (e[0] === "Limits" && typeof e[1] === "string") bound.add(e[1]);
    e.slice(1).forEach((operand) => bind(operand as MathJSON));
  };
  bind(expr);
  const free = (e: MathJSON): boolean => {
    if (typeof e === "string") return !/^'.*'$/s.test(e) && !SLOT.test(e) && !DEFINED_NAMES.has(e) && !bound.has(e);
    return Array.isArray(e) && e.slice(typeof e[0] === "string" ? 1 : 0).some((operand) => free(operand as MathJSON));
  };
  return !free(expr);
}

/**
 * Whether `expected` holds, anywhere under its arithmetic, a closed call to a head a function `call`
 * is given applies (`Normalize(p, f)` is `p / f(p)`, and `f` integrates: ours still has
 * `p / Integrate(…)`). A closed call is a number the kernel computes, so ours left it undone; one
 * with a free symbol in it (`Sin(x)`) may be all the answer there is, so it is not read as held.
 */
function holdsAppliedCall(call: MathJSON, expected: MathJSON): boolean {
  const heads = appliedHeads(call);
  if (heads.size === 0) return false;
  const visit = (e: MathJSON): boolean =>
    Array.isArray(e) && typeof e[0] === "string"
      ? (heads.has(e[0]) && isClosed(e)) || e.slice(1).some((operand) => visit(operand as MathJSON))
      : false;
  return visit(expected);
}

/** `expr` with products and sums flattened and their terms sorted, a quotient a product with a
 * `-1` power, and `Sqrt`/`Negate`/`Subtract` spelled as those: two writings of one expression that
 * differ only in the order or grouping of their factors come out as the same text. */
function orderFree(expr: MathJSON): MathJSON {
  if (!Array.isArray(expr) || typeof expr[0] !== "string") return expr;
  const [head, ...rest] = expr as [string, ...MathJSON[]];
  const operands = rest.map(orderFree);
  const sorted = (name: string, terms: readonly MathJSON[], unit: number): MathJSON => {
    const flat = terms.flatMap((term) =>
      Array.isArray(term) && term[0] === name ? (term.slice(1) as MathJSON[]) : [term],
    );
    const kept = flat
      .filter((term) => term !== unit)
      .toSorted((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
    return kept.length === 0 ? unit : kept.length === 1 ? (kept[0] as MathJSON) : ([name, ...kept] as MathJSON);
  };
  const product = (...terms: MathJSON[]): MathJSON => sorted("Multiply", terms, 1);
  switch (head) {
    case "Multiply":
      return product(...operands);
    case "Divide":
      return operands.length === 2 ? product(operands[0] as MathJSON, ["Power", operands[1], -1] as MathJSON) : expr;
    case "Negate":
      return operands.length === 1 ? product(-1, operands[0] as MathJSON) : expr;
    case "Sqrt":
      return operands.length === 1 ? (["Power", operands[0], ["Rational", 1, 2]] as MathJSON) : expr;
    case "Subtract":
      return operands.length === 2
        ? sorted("Add", [operands[0] as MathJSON, product(-1, operands[1] as MathJSON)], 0)
        : expr;
    case "Add":
      return sorted("Add", operands, 0);
    default:
      return [head, ...operands] as MathJSON;
  }
}

/** Two arguments that are one expression written differently (`1/t * f` and `f/t`). */
function sameValue(a: MathJSON, b: MathJSON): boolean {
  if (canonicalText(a) === canonicalText(b)) return true;
  if (JSON.stringify(orderFree(a)) === JSON.stringify(orderFree(b))) return true;
  try {
    const [x, y] = [a, b].map((e) => ce.box(e as Parameters<ComputeEngine["box"]>[0]));
    return x!.isSame(y!) || ce.box(["Subtract", x!, y!]).simplify().is(0) || agreeAtPoints(a, b);
  } catch {
    return false;
  }
}

/** Whether `a` and `b` take the same value at each of a few fixed rational points: for an
 * argument whose two writings the simplifier won't reduce to one. */
function agreeAtPoints(a: MathJSON, b: MathJSON): boolean {
  const bound = new Set([...boundVariables(a), ...boundVariables(b), ...seriesVariables(a), ...seriesVariables(b)]);
  const names = [...new Set([...ce.box(a as never).unknowns, ...ce.box(b as never).unknowns])].filter(
    (name) => !bound.has(name),
  );
  const discrete = new Set([...discreteVariables(a), ...discreteVariables(b)]);
  const positive = new Set([...positiveVariables(a), ...positiveVariables(b)]);
  return Array.from({ length: NUMBER_OF_TRIALS }, (_, trial) => {
    const subs = trialSubstitution(names, trial, discrete, positive);
    const [x, y] = [a, b].map((e) => ce.box(substituteFreeSymbols(e, subs) as never).N());
    const close = (p: number, q: number) => Number.isFinite(p) && Number.isFinite(q) && Math.abs(p - q) < 1e-9;
    return close(x!.re, y!.re) && close(x!.im, y!.im);
  }).every(Boolean);
}

const SLOT = /^_(\d*)$/;

/** `expr` with each free occurrence of a name in `names` renamed; a nested `Function` that binds
 * the name again shadows it. */
function renameFree(expr: MathJSON, names: ReadonlyMap<string, string>): MathJSON {
  if (typeof expr === "string") return names.get(expr) ?? expr;
  if (!Array.isArray(expr) || typeof expr[0] !== "string") return expr;
  const [head, ...operands] = expr as [string, ...MathJSON[]];
  if (head === "Function" && operands.length > 0) {
    const inner = new Map([...names].filter(([name]) => !operands.slice(1).includes(name)));
    return [head, ...operands.map((operand) => renameFree(operand, inner))] as MathJSON;
  }
  return [head, ...operands.map((operand) => renameFree(operand, names))] as MathJSON;
}

/** A pure function's body with its parameters renamed `Slot_1`, `Slot_2`, … by position — a named
 * parameter (`Function(body, x)`) and Wolfram's `#1` are then the same symbol — and its arity. The
 * `Block` that canonicalisation wraps a body in is not part of what the function says. */
function positional(fn: readonly MathJSON[]): { body: MathJSON; arity: number } | undefined {
  const [, body, ...params] = fn;
  if (body === undefined) return undefined;
  const named = params.filter((p): p is string => typeof p === "string" && !SLOT.test(p));
  if (named.length !== params.length) return undefined;
  const slots = new Set<string>();
  const collect = (e: MathJSON): void => {
    if (typeof e === "string" && SLOT.test(e)) slots.add(e === "_" ? "_1" : e);
    else if (Array.isArray(e)) e.slice(1).forEach((x) => collect(x as MathJSON));
  };
  collect(body);
  const names = new Map<string, string>([
    ...named.map((name, i) => [name, `Slot_${i + 1}`] as const),
    ...[...slots].map((slot) => [slot, `Slot_${SLOT.exec(slot)![1]}`] as const),
  ]);
  if (slots.has("_1")) names.set("_", "Slot_1");
  const unwrapped = Array.isArray(body) && body[0] === "Block" && body.length === 2 ? (body[1] as MathJSON) : body;
  return {
    body: renameFree(unwrapped, names),
    arity: named.length > 0 ? named.length : Math.max(0, ...[...slots].map((slot) => Number(SLOT.exec(slot)![1]))),
  };
}

const isFunction = (e: MathJSON): e is [string, ...MathJSON[]] => Array.isArray(e) && e[0] === "Function";

/** A pure function's body at `argument`, its parameter or slot (`_1`) replaced; `undefined` for a
 * function of several parameters. */
function applyFunction(fn: readonly MathJSON[], argument: MathJSON): MathJSON | undefined {
  const [, body, ...parameters] = fn;
  if (body === undefined || parameters.length > 1) return undefined;
  const unwrapped = Array.isArray(body) && body[0] === "Block" && body.length === 2 ? (body[1] as MathJSON) : body;
  const names = new Map<string, MathJSON>([
    ["_", argument],
    ["_1", argument],
  ]);
  if (typeof parameters[0] === "string") names.set(parameters[0], argument);
  return substituteFreeSymbols(unwrapped, names);
}

/** Whether two pure functions are one function written differently: the same arity, and bodies that
 * are one expression once the bound variables are renamed alike (`x |-> f(x)` and `f[#1] &`). */
export function equivalentFunctions(a: MathJSON, b: MathJSON): boolean {
  if (!isFunction(a) || !isFunction(b)) return false;
  const [x, y] = [positional(a), positional(b)];
  return x !== undefined && y !== undefined && x.arity === y.arity && sameValue(x.body, y.body);
}

/**
 * `theirs` with each pure function that is equivalent to the one in the same place in `ours`
 * (`equivalentFunctions`) replaced by it, so a comparison that reads a function as its text sees one
 * function, not two spellings of it. Anything else is left as it was.
 */
export function alignFunctions(theirs: MathJSON, ours: MathJSON): MathJSON {
  if (equivalentFunctions(theirs, ours)) return ours;
  // One expression spelled two ways (`Sqrt(2)` and `Power(2, 1/2)`) is one canonical form.
  if (Array.isArray(theirs) && canonicalText(theirs) === canonicalText(ours)) return ours;
  if (
    Array.isArray(theirs) &&
    Array.isArray(ours) &&
    typeof theirs[0] === "string" &&
    theirs[0] === ours[0] &&
    theirs.length === ours.length
  ) {
    return [theirs[0], ...theirs.slice(1).map((t, i) => alignFunctions(t as MathJSON, ours[i + 1] as MathJSON))];
  }
  return theirs;
}

/** `ConditionalExpression[value, condition]` as its value: the condition says where the answer
 * holds (`s >= 0`), not what it is, so the answer is compared without it. */
export function lookThroughConditions(expr: MathJSON): MathJSON {
  if (!Array.isArray(expr) || typeof expr[0] !== "string") return expr;
  if (expr[0] === "ConditionalExpression" && expr.length === 3) return lookThroughConditions(expr[1] as MathJSON);
  return [expr[0], ...expr.slice(1).map((operand) => lookThroughConditions(operand as MathJSON))];
}

/** Wolfram source for `source` with every `ConditionalExpression[value, condition]` replaced by its value. */
const withoutConditions = (source: string): string => `ReplaceAll[${source}, ConditionalExpression[e_, _] :> e]`;

/**
 * The kernel source for "does `expr` agree with `expected`", for an example whose emitted
 * form carries a free symbol. `undefined` when either side doesn't emit for `system`, OR when
 * `expected` doesn't depend on the SAME free symbol at all — the caller falls back to the
 * ordinary (structural or text) verdict, unaffected by this module.
 *
 * That second case is not an edge case to shrug at: `IndexOf(…, b)` free in `b`, expected the
 * constant `0`, or `FunctionConvexity(x^3, x)` free in `x`, expected the constant symbol
 * `Indeterminate` — neither `expected` mentions the variable at all, so "the difference is
 * zero" is not the claim being made; it would compare a variable expression against a
 * constant and call any answer other than that exact constant a disagreement, which
 * `compareTrees` (structural.ts) already does correctly without this module's help.
 */
export function symbolicAgreementSource(
  system: SymbolicSystem,
  expr: MathJSON,
  expected: MathJSON,
  freeSymbols: readonly string[],
  /** Seconds the kernel may simplify a difference (`SYMBOLIC_SECONDS`). */
  symbolicSeconds: number = SYMBOLIC_SECONDS,
): string | undefined {
  // Ours left the call unevaluated: the identity holds trivially, so the plain verdict decides.
  if (leavesCall(expr, expected) || echoesInput(expr, expected)) return undefined;
  // A series ours holds is no polynomial to check: the kernel evaluates ours too, so any difference
  // from its own `Normal` of it would be zero. Undecided, not agreed.
  if (system === "wolfram" && leavesCall(seriesOfNormal(expr), expected)) return "Indeterminate";
  const solving = system === "wolfram" && Array.isArray(expr) && expr[0] === "Solve";
  // A declined `Solve` (ours stays the call) has no solutions to compare as sets.
  if (solving && Array.isArray(expected) && expected[0] === "Solve") return undefined;
  const equating = system === "wolfram" && Array.isArray(expected) && PROPOSITIONS.has(expected[0] as string);
  if (!solving && !equating && (isStructured(expr) || isStructured(expected))) return undefined;
  const theirs = emit(expr, system);
  const ours = emit(expected, system);
  if (!theirs.ok || !ours.ok) return undefined;
  if (!(ours.freeSymbols ?? []).some((name) => freeSymbols.includes(name))) return undefined;
  const theirsSource = system === "wolfram" ? withoutConditions(theirs.source) : theirs.source;
  if (solving) return solveAgreementSource(theirsSource, ours.source, symbolicSeconds);
  if (equating) return propositionAgreementSource(theirsSource, ours.source, symbolicSeconds);
  const trials = Array.from({ length: NUMBER_OF_TRIALS }, (_, trial) =>
    trialSources(system, expr, expected, freeSymbols, trial),
  );
  // Samples that are not numbers leave it undecided, unless an answer is no value to sample: a function or
  // a rule, or a call the kernel declined with a message. Not a series, which stays undecided.
  const unsampled =
    [expr, expected].some(involvesSeries) || trials.some((t) => t?.stepped)
      ? "Indeterminate"
      : `Module[{v = Quiet[Check[TimeConstrained[{${theirsSource}, ${ours.source}}, ${symbolicSeconds}, $Aborted], $Failed]]}, ` +
        `If[v === $Failed || !FreeQ[v, _Function | _Rule | _RuleDelayed | _Unevaluated], ${NOT_NUMERIC}, Indeterminate]]`;
  if (system === "wolfram") {
    const points = trials.map((t) => {
      if (t === undefined) return "Indeterminate";
      const difference = `(${t.theirs}) - (${t.ours})`;
      // A step call is read by its definition at a point; the cancellation in a difference of
      // near-equal values (a q-function, `BetaRegularized` at a negative argument) needs more than a double.
      // A series is read as its polynomial (`Normal`) so its variable can be sampled, which a
      // `SeriesData` would not survive; a truncation is not a difference, so the O-term goes.
      const read = t.stepped ? `((${difference}) //. ${STEP_DEFINITIONS})` : `(${difference})`;
      if (t.series) return `Chop[N[Normal[${read}] /. ${t.after}, 30], 10^-12]`;
      if (t.stepped) return `Chop[N[${read} /. ${t.after}, 30], 10^-12]`;
      return `Chop[N[${difference}]]`;
    });
    // FullSimplify can run away on an identity it won't reduce; TimeConstrained caps it at
    // `symbolicSeconds` and reports $Aborted rather than eating the item's whole budget (run.ts,
    // ITEM_SECONDS) — an aborted simplification isn't `0` either, so it falls straight
    // through to the substitution trials, same as any other non-zero result.
    //
    // `d` is a scalar `0` for an ordinary answer, but a `List`/matrix answer's difference is
    // itself a list (BL-25) — `FullSimplify` never collapses `{0, 0}` to the bare number `0`,
    // so testing `d === 0` read every equal array as a disagreement. `Flatten[{d}]` reads the
    // same for both shapes: `{0}` for a scalar, the fully-flattened elementwise differences
    // for a list or nested matrix — `AllTrue[…, # === 0 &]` over that is the one check that
    // means "the difference vanishes" in both cases.
    //
    // Two truncated series that agree below their order differ by a pure O-term (`O[x]^5`), which is
    // zero at that order: it counts when it is no coarser than the series Wolfram answered.
    return (
      `Module[{d = Quiet[TimeConstrained[FullSimplify[(${theirsSource}) - (${ours.source})], ${symbolicSeconds}, $Aborted]], pureO, bound}, ` +
      `pureO = MatchQ[#, SeriesData[_, _, {}, _, _, _]] &; ` +
      `If[AllTrue[Flatten[{d}], # === 0 &] || (AnyTrue[Flatten[{d}], pureO] && ` +
      `(bound = Min[Append[Map[Function[t, t[[5]]/t[[6]]], ` +
      `Cases[Quiet[TimeConstrained[${theirsSource}, ${symbolicSeconds}, $Aborted]], _SeriesData, {0, Infinity}]], Infinity]]; ` +
      `AllTrue[Flatten[{d}], # === 0 || (pureO[#] && #[[5]]/#[[6]] >= bound) &])), ` +
      `True, Module[{s = {${points.join(", ")}}}, ` +
      `s = Flatten[s]; If[AllTrue[s, NumericQ], AllTrue[s, # == 0 &], ${unsampled}]]]]`
    );
  }
  const points = trials.map((t) => (t === undefined ? "None" : `(${t.theirs}, ${t.ours})`));
  return `enumeratio_symbolic_agree(${theirs.source}, ${ours.source}, [${points.join(", ")}])`;
}

/** Whether `text`, a symbolic check's printed answer, says it could not sample the answers as numbers
 * (`NOT_NUMERIC`): the plain comparison should decide instead. */
export const notNumeric = (text: string): boolean => text.trim() === NOT_NUMERIC;

/** `symbolicAgreementSource`'s printed answer, read back as a verdict: `True`/`False` from
 * either lane, or `Indeterminate`/`None` when neither the simplifier nor the substitution
 * points could decide it. */
export function interpretSymbolicAgreement(text: string): Verdict {
  const t = text.trim();
  if (t === "True") return "agree";
  if (t === "False") return "disagree";
  return "inconclusive";
}
