// The catalogue of places where another system and compute-engine disagree, as data.
//
// A scan (reference/scripts/oracle-scan.ts) produces the disagreements; a person classifies each one. The
// classification is the useful part — "Round[2.5] is 2 there and 3 here" is a fact, but
// "compute-engine rounds half away from zero and Wolfram rounds half to even" is the
// convention behind a whole family of facts, and what a reader of the reference needs.
// Every row in an entry file's `<stem>.oracle.json` sidecar that is not an agreement —
// disagree, error or inconclusive — carries its classification; the reference's oracle test
// refuses an unclassified one.

import type { MathJSON } from "./emit.ts";
import type { Tree } from "./structural.ts";

/** Why two correct systems can answer differently. */
export const DIVERGENCE_KINDS = {
  /** Ties round away from zero here, to even there. */
  "rounding-mode": "a different tie-breaking rule for rounding",
  /** The same values, arranged differently — a flat tuple against a nested list. */
  shape: "the same values in a different structure",
  /** compute-engine leaves the expression unevaluated where Wolfram continues it. */
  unevaluated: "left symbolic here, computed there",
  /** One side extends the function past its textbook domain; the other refuses. */
  domain: "a different domain — one side answers where the other declines",
  /** Both decline, and spell the non-answer differently: NaN, ComplexInfinity, Missing, unevaluated. */
  "undefined-form": "both decline, with a different spelling of undefined",
  /** Both are right under their own definition of the operation. */
  convention: "a different definition of the operation",
  /** Wolfram's numeric evaluation is off; its symbolic evaluation and other oracles agree with us. */
  precision: "a numeric-evaluation quirk on the Wolfram side",
  /** compute-engine threads a Listable head over a list; the other system takes scalars only. */
  threading: "threaded over a list here, scalars only there",
  /** The other system hit the scan's time or memory cap, so said nothing either way. */
  resource: "the other system ran out of time or memory",
  /** The other system is right and this is a gap or bug here; the row names its issue. */
  ours: "a gap or bug here, tracked by an issue",
  /** Not yet reviewed — a scan adds these and a person replaces them. */
  unclassified: "not yet reviewed",
} as const;

export type DivergenceKind = keyof typeof DIVERGENCE_KINDS;

export interface Divergence {
  /** `Head#n` — the reference example, as the scan labels it. */
  readonly id: string;
  readonly kind: DivergenceKind;
  /** What the two systems each do, in a sentence. Empty until classified. */
  readonly note: string;
  readonly expr: MathJSON;
  /** The Wolfram source the example was evaluated as. */
  readonly source: string;
  /** Both answers, reduced the way the scan compares them (see structural.ts). */
  readonly ours: Tree;
  readonly theirs: Tree;
}
