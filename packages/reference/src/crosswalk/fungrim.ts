// What checking Fungrim's identities came to, per head.
//
// The crosswalk points a head at every Fungrim entry whose compiled rule mentions it. Most
// of those are claims nobody here has tested; `scripts/verify-fungrim.ts` tests the ones our
// engine can evaluate, and this is where a page reads the answer -- as a score on the head's
// Fungrim chip, and as a note on the entries that came out wrong.

import { fungrimVerified } from "../fungrim-verified-data.ts";

/**
 * Why an identity disagrees, where we have looked into it. Every case so far has been OUR
 * evaluation rather than Fungrim's mathematics, which is the useful direction: the corpus is
 * a test of the engine as much as the engine is a reader of the corpus.
 */
export const KNOWN_CAUSES: Readonly<Record<string, string>> = {
  "16d2e1":
    "compute-engine's EllipticE is imprecise at complex modulus — at m = 0.57 + 0.23i it gives 1.32492…, where mpmath and the identity's own hypergeometric side both give 1.324807…; the identity is right",
  "752619": "the same EllipticE imprecision at complex modulus",
  "9227bf": "the same EllipticE imprecision at complex modulus",
};

export interface FungrimScore {
  readonly agree: number;
  readonly disagree: number;
  /** The entries that disagreed, with where they parted. */
  readonly disagreements: readonly { readonly entry: string; readonly detail: string }[];
}

const byHead = new Map<string, FungrimScore>();
for (const row of fungrimVerified) {
  for (const head of row.heads) {
    const score = byHead.get(head) ?? { agree: 0, disagree: 0, disagreements: [] };
    const next: FungrimScore = {
      agree: score.agree + (row.verdict === "agree" ? 1 : 0),
      disagree: score.disagree + (row.verdict === "disagree" ? 1 : 0),
      disagreements:
        row.verdict === "disagree"
          ? [...score.disagreements, { entry: row.entry, detail: row.detail ?? "" }]
          : score.disagreements,
    };
    byHead.set(head, next);
  }
}

/** How this head's Fungrim identities came out, when any of them were checked. */
export const fungrimScore = (head: string): FungrimScore | undefined => byHead.get(head);

/** The verdict on one entry, when it was checked. */
export const fungrimEntryVerdict = (entry: string): (typeof fungrimVerified)[number] | undefined =>
  fungrimVerified.find((row) => row.entry === entry);
