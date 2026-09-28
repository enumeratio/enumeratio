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

import { emit, type MathJSON } from "./emit.ts";
import type { SymbolicSystem } from "./systems.ts";
import type { Verdict } from "./compare.ts";

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
 * The kernel source for "does `expr` agree with `expected`", for an example whose emitted
 * form carries a free symbol. `undefined` when either side doesn't emit for `system` — the
 * caller falls back to the ordinary (structural or text) verdict, unaffected by this module.
 */
export function symbolicAgreementSource(
  system: SymbolicSystem,
  expr: MathJSON,
  expected: MathJSON,
  freeSymbols: readonly string[],
): string | undefined {
  const theirs = emit(expr, system);
  const ours = emit(expected, system);
  if (!theirs.ok || !ours.ok) return undefined;
  const trials = Array.from({ length: NUMBER_OF_TRIALS }, (_, trial) =>
    trialSources(system, expr, expected, freeSymbols, trial),
  );
  if (system === "wolfram") {
    const points = trials.map((t) => (t === undefined ? "Indeterminate" : `Chop[N[(${t.theirs}) - (${t.ours})]]`));
    return (
      `Module[{d = Quiet[FullSimplify[(${theirs.source}) - (${ours.source})]]}, ` +
      `If[d === 0, True, Module[{s = {${points.join(", ")}}}, ` +
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
