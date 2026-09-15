// The systems a head can be cross-referenced against, and how to reach each one. This is
// the one table every crosswalk link on the site is written from -- the reference pages,
// the catalogue tables, and the `<Symbol type="…">` control in prose.
//
// `href` builds a link from a bare identity when the system has a stable URL scheme (a
// Wolfram symbol, a Wikidata Q-id, a FindStat St-number). Systems whose pages are keyed by
// module path (Sage, SymPy, mathlib4) have none: a reference to one of those carries the
// URL it was recorded with, or is shown as plain text.

export type CrosswalkSystem =
  | "wolfram"
  | "mathworld"
  | "wikipedia"
  | "wikidata"
  | "nlab"
  | "encyclopediaofmath"
  | "britannica"
  | "fungrim"
  | "fungrimEntry"
  | "dlmf"
  | "oeis"
  | "findstat"
  | "sage"
  | "sympy"
  | "mpmath"
  | "numpy"
  | "scipy"
  | "mathlib4"
  | "matlab"
  | "rosettacode";

export interface CrosswalkSource {
  /** What to call the system in a chip, a tooltip or an aria-label. */
  readonly label: string;
  /** Build the target from an identity, when the system's URLs are keyed by name. */
  readonly href?: (identity: string) => string;
}

export const SOURCES: Readonly<Record<CrosswalkSystem, CrosswalkSource>> = {
  wolfram: {
    label: "Wolfram Language",
    href: (id) => `https://reference.wolfram.com/language/ref/${id}.html`,
  },
  mathworld: { label: "MathWorld", href: (id) => `https://mathworld.wolfram.com/${id}.html` },
  wikipedia: {
    label: "Wikipedia",
    href: (id) => `https://en.wikipedia.org/wiki/${id.replace(/ /g, "_")}`,
  },
  wikidata: { label: "Wikidata", href: (id) => `https://www.wikidata.org/wiki/${id}` },
  nlab: { label: "nLab", href: (id) => `https://ncatlab.org/nlab/show/${id.replace(/ /g, "+")}` },
  encyclopediaofmath: {
    label: "Encyclopedia of Mathematics",
    href: (id) => `https://encyclopediaofmath.org/wiki/${id}`,
  },
  britannica: { label: "Britannica", href: (id) => `https://www.britannica.com/${id}` },
  fungrim: { label: "Fungrim", href: (id) => `https://fungrim.org/symbol/${id}/` },
  fungrimEntry: { label: "Fungrim entry", href: (id) => `https://fungrim.org/entry/${id}/` },
  dlmf: { label: "DLMF", href: (id) => `https://dlmf.nist.gov/${id}` },
  oeis: { label: "OEIS", href: (id) => `https://oeis.org/${id}` },
  findstat: { label: "FindStat", href: (id) => `https://www.findstat.org/${id}` },
  sage: { label: "SageMath" },
  sympy: { label: "SymPy" },
  mpmath: { label: "mpmath" },
  numpy: { label: "NumPy" },
  scipy: { label: "SciPy" },
  mathlib4: { label: "mathlib4" },
  matlab: { label: "MATLAB" },
  rosettacode: {
    label: "Rosetta Code",
    href: (id) => `https://rosettacode.org/wiki/${id.replace(/ /g, "_")}`,
  },
};

export const isCrosswalkSystem = (system: string): system is CrosswalkSystem => system in SOURCES;

/** The order systems are shown in: the encyclopaedic ones first, then the other engines. */
export const SYSTEM_ORDER: readonly CrosswalkSystem[] = [
  "wikipedia",
  "mathworld",
  "wikidata",
  "encyclopediaofmath",
  "nlab",
  "britannica",
  "dlmf",
  "fungrim",
  "fungrimEntry",
  "oeis",
  "findstat",
  "wolfram",
  "sage",
  "sympy",
  "mpmath",
  "numpy",
  "scipy",
  "mathlib4",
  "matlab",
  "rosettacode",
];
