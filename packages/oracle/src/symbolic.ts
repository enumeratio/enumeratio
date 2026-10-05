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

const NUMBER_OF_TRIALS = 3;

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
function trialSubstitution(freeSymbols: readonly string[], trial: number): ReadonlyMap<string, MathJSON> {
  return new Map(
    freeSymbols.map((name, i) => [
      name,
      rationalLiteral(RATIONALS[(i + trial * freeSymbols.length) % RATIONALS.length]!),
    ]),
  );
}

/** One trial's pair of emitted sources (theirs, ours), or `undefined` when the substituted
 * expression no longer emits for `system` (an unrelated mapping gap, not this mechanism's
 * problem — the trial is just skipped, not the whole check). */
function trialSources(
  system: SymbolicSystem,
  expr: MathJSON,
  expected: MathJSON,
  freeSymbols: readonly string[],
  trial: number,
): { readonly theirs: string; readonly ours: string } | undefined {
  const subs = trialSubstitution(freeSymbols, trial);
  const theirs = emit(substituteFreeSymbols(expr, subs), system);
  const ours = emit(substituteFreeSymbols(expected, subs), system);
  return theirs.ok && ours.ok ? { theirs: theirs.source, ours: ours.source } : undefined;
}

/**
 * `Solve`'s answer against ours, as sets of solutions. Wolfram answers rules (`{{x -> v}}`),
 * ours are bare values (a tuple per solution for several unknowns), in no fixed order, so
 * "the difference is zero" is asked of each value against its counterpart rather than of
 * the lists. A reply that is not a list of rule lists (Solve declined) is a disagreement.
 */
function solveAgreementSource(theirs: string, ours: string): string {
  return (
    `Module[{r = Quiet[TimeConstrained[${theirs}, 20, $Aborted]], o = ${ours}, t, same}, ` +
    `same[v_, w_] := AllTrue[Flatten[{Quiet[TimeConstrained[FullSimplify[v - w], 10, $Aborted]]}], # === 0 &]; ` +
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
function propositionAgreementSource(theirs: string, ours: string): string {
  return (
    `Module[{zero, agree}, ` +
    `zero[e_] := AllTrue[Flatten[{Quiet[TimeConstrained[FullSimplify[e], 10, $Aborted]]}], # === 0 &]; ` +
    `agree[t_And, o_And] /; Length[t] == Length[o] := And @@ MapThread[agree, {List @@ t, List @@ o}]; ` +
    `agree[t_Equal, o_Equal] /; Length[t] == 2 && Length[o] == 2 := ` +
    `zero[t[[1]] - t[[2]] - (o[[1]] - o[[2]])] || zero[t[[1]] - t[[2]] + (o[[1]] - o[[2]])]; ` +
    `agree[t_, o_] /; MatchQ[t, _Less | _LessEqual | _Greater | _GreaterEqual] && Head[t] === Head[o] && ` +
    `Length[t] == 2 && Length[o] == 2 := zero[t[[1]] - o[[1]]] && zero[t[[2]] - o[[2]]]; ` +
    `agree[_, _] := Indeterminate; ` +
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
  // A list is held when any entry is: against the entry in the same place if ours is a list of the same length.
  if (call[0] === "List" || call[0] === "Tuple") {
    const kept = Array.isArray(expected) && expected[0] === call[0] && expected.length === call.length;
    return call
      .slice(1)
      .some((entry, i) =>
        leavesCall(entry as MathJSON, kept ? ((expected as MathJSON[])[i + 1] as MathJSON) : expected),
      );
  }
  if (COMBINING.has(call[0])) return false;
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
  return visit(expected);
}

/** Two arguments that are one expression written differently (`1/t * f` and `f/t`). */
function sameValue(a: MathJSON, b: MathJSON): boolean {
  if (canonicalText(a) === canonicalText(b)) return true;
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
  const names = [...new Set([...ce.box(a as never).unknowns, ...ce.box(b as never).unknowns])];
  return Array.from({ length: NUMBER_OF_TRIALS }, (_, trial) => {
    const subs = trialSubstitution(names, trial);
    const [x, y] = [a, b].map((e) => ce.box(substituteFreeSymbols(e, subs) as never).N());
    const close = (p: number, q: number) => Number.isFinite(p) && Number.isFinite(q) && Math.abs(p - q) < 1e-9;
    return close(x!.re, y!.re) && close(x!.im, y!.im);
  }).every(Boolean);
}

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
): string | undefined {
  // Ours left the call unevaluated: the identity holds trivially, so the plain verdict decides.
  if (leavesCall(expr, expected)) return undefined;
  const solving = system === "wolfram" && Array.isArray(expr) && expr[0] === "Solve";
  // A declined `Solve` (ours stays the call) has no solutions to compare as sets.
  if (solving && Array.isArray(expected) && expected[0] === "Solve") return undefined;
  const equating =
    system === "wolfram" && Array.isArray(expected) && (expected[0] === "Equal" || expected[0] === "And");
  if (!solving && !equating && (isStructured(expr) || isStructured(expected))) return undefined;
  const theirs = emit(expr, system);
  const ours = emit(expected, system);
  if (!theirs.ok || !ours.ok) return undefined;
  if (!(ours.freeSymbols ?? []).some((name) => freeSymbols.includes(name))) return undefined;
  if (solving) return solveAgreementSource(theirs.source, ours.source);
  if (equating) return propositionAgreementSource(theirs.source, ours.source);
  const trials = Array.from({ length: NUMBER_OF_TRIALS }, (_, trial) =>
    trialSources(system, expr, expected, freeSymbols, trial),
  );
  if (system === "wolfram") {
    const points = trials.map((t) => (t === undefined ? "Indeterminate" : `Chop[N[(${t.theirs}) - (${t.ours})]]`));
    // FullSimplify can run away on an identity it won't reduce; TimeConstrained caps it at
    // 10s and reports $Aborted rather than eating the item's whole 30s budget (run.ts,
    // ITEM_SECONDS) — an aborted simplification isn't `0` either, so it falls straight
    // through to the substitution trials, same as any other non-zero result.
    //
    // `d` is a scalar `0` for an ordinary answer, but a `List`/matrix answer's difference is
    // itself a list (BL-25) — `FullSimplify` never collapses `{0, 0}` to the bare number `0`,
    // so testing `d === 0` read every equal array as a disagreement. `Flatten[{d}]` reads the
    // same for both shapes: `{0}` for a scalar, the fully-flattened elementwise differences
    // for a list or nested matrix — `AllTrue[…, # === 0 &]` over that is the one check that
    // means "the difference vanishes" in both cases.
    return (
      `Module[{d = Quiet[TimeConstrained[FullSimplify[(${theirs.source}) - (${ours.source})], 10, $Aborted]]}, ` +
      `If[AllTrue[Flatten[{d}], # === 0 &], True, Module[{s = {${points.join(", ")}}}, ` +
      `If[AllTrue[s, NumericQ], AllTrue[s, # == 0 &], Indeterminate]]]]`
    );
  }
  const points = trials.map((t) => (t === undefined ? "None" : `(${t.theirs}, ${t.ours})`));
  return `enumeratio_symbolic_agree(${theirs.source}, ${ours.source}, [${points.join(", ")}])`;
}

/** `symbolicAgreementSource`'s printed answer, read back as a verdict: `True`/`False` from
 * either lane, or `Indeterminate`/`None` when neither the simplifier nor the substitution
 * points could decide it. */
export function interpretSymbolicAgreement(text: string): Verdict {
  const t = text.trim();
  if (t === "True") return "agree";
  if (t === "False") return "disagree";
  return "inconclusive";
}
