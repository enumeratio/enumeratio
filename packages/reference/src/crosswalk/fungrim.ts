// What checking Fungrim's identities came to, per head.
//
// The crosswalk points a head at every Fungrim entry whose compiled rule mentions it. Most
// of those are claims nobody here has tested; `scripts/verify-fungrim.ts` tests the ones our
// engine can evaluate, and this is where a page reads the answer -- as a score on the head's
// Fungrim chip, and as a note on the entries that came out wrong.

import { fungrimVerified } from "../fungrim-verified-data.ts";

/**
 * Why an identity disagrees, where we have looked into it. Most cases are OUR evaluation
 * rather than Fungrim's mathematics (a real bug, or a branch convention we chose
 * differently than Fungrim's compiled rule) -- the corpus is a test of the engine as much
 * as the engine is a reader of the corpus. A few are errata in Fungrim's own source (a sign
 * or index error unrelated to any head we declare), inherited by compute-engine's corpus
 * and caught by cross-checking both sides against mpmath independently.
 */
export const KNOWN_CAUSES: Readonly<Record<string, string>> = {
  "16d2e1":
    "compute-engine's EllipticE is imprecise at complex modulus — at m = 0.57 + 0.23i it gives 1.31754…, where mpmath and the identity's own hypergeometric side both give 1.324807…; the identity is right (cortex-js/compute-engine#346)",
  "48333c":
    "the same EllipticE imprecision at complex modulus, reached through this CarlsonRG identity (cortex-js/compute-engine#346)",

  "00cdb7":
    "CarlsonRC(x, -y) for real x, y > 0: our RC returns DLMF 19.2.19's real Cauchy principal value (mpmath's plain elliprc(x,-y) agrees); this identity's Artanh form is Fungrim's analytic continuation approached from above the cut (y + i0), which has a nonzero imaginary part mpmath reproduces exactly under that same perturbation — a real convention difference, not a wrong value",
  "25435b": "the same CarlsonRC principal-value-vs-approached-from-above convention difference, at RC(1,-1)",
  "4becdd":
    "the same CarlsonRC principal-value-vs-approached-from-above convention difference, folded into a Conjugate identity",

  "42eb01":
    "Fungrim erratum, inherited by compute-engine's corpus: the entry adds where it should subtract — the correct identity is T_n(x)^2 - (x^2-1)*U_{n-1}(x)^2 = 1 (confirmed with mpmath's chebyt/chebyu); our ChebyshevT/U match mpmath exactly at the tested points (cortex-js/compute-engine#343)",
  "4c7aeb":
    "Fungrim erratum, inherited by compute-engine's corpus: the entry is off by one index — the correct identity is U_{n-1}(cos x)*sin(x) = sin(n*x) (confirmed with mpmath's chebyu/sin); our ChebyshevU matches mpmath exactly (cortex-js/compute-engine#343)",
  "5f09f4":
    "Fungrim erratum, inherited by compute-engine's corpus: the entry has T_n where U_n belongs — the correct identity is U_{2n}(x) = U_n(2x^2-1) + U_{n-1}(2x^2-1) (confirmed with mpmath's chebyu); our ChebyshevT/U agree with mpmath's chebyt/chebyu (cortex-js/compute-engine#343)",

  b468f3:
    "CarlsonRJ(0,1,1,-1): falls inside our documented p < 0, x,y,z ≥ 0 Cauchy-principal-value branch (DLMF 19.20.14), which is deliberately real — same convention as Wolfram's CarlsonRJ there, confirmed — while Fungrim's expected value is complex, Fungrim's analytic continuation approached from one side of the cut rather than the principal value; the real part agrees with mpmath's elliprj exactly, only the (conventionally dropped) imaginary part differs",
  e04867: "the same CarlsonRJ real-CPV-vs-complex-continuation convention difference, at RJ(1,1,1,-1)",
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
