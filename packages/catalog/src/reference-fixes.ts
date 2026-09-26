// Corrections to the catalog's crosswalk, kept here because this repo is now where the
// catalog lives: the enumeratio database it was extracted from is being wound down, so a
// wrong row is fixed HERE, not there. Each fix names the row it is about and says why.
//
// Applied over the extracted rows at load (`references.ts`); the data file stays as
// extracted, so a fix that stops matching -- the dump caught up, or the row went -- fails
// loudly instead of lingering.

import type { CatalogReference } from "./catalog-data.ts";

/** Which row a fix is about: every named field has to match. */
export type ReferenceKey = Pick<CatalogReference, "kind" | "subject" | "system" | "identity"> &
  Partial<Pick<CatalogReference, "on">>;

export interface ReferenceFix {
  readonly match: ReferenceKey;
  /** Fields to overwrite; `remove: true` drops the row instead. */
  readonly set?: Partial<Omit<CatalogReference, "kind" | "subject">>;
  readonly remove?: true;
  readonly why: string;
}

const MATHLIB = "https://leanprover-community.github.io/mathlib4_docs/";

export const REFERENCE_FIXES: readonly ReferenceFix[] = [
  {
    match: {
      kind: "collection",
      subject: "DistinctPartitions",
      system: "mathlib4",
      identity: "Nat.Partition.distincts",
    },
    set: {
      url: `${MATHLIB}Mathlib/Combinatorics/Enumerative/Partition/Basic.html#Nat.Partition.distincts`,
    },
    why: "mathlib4 split Enumerative/Partition into Partition/Basic; the old page is gone",
  },
  {
    match: { kind: "collection", subject: "DyckPaths", system: "mathlib4", identity: "catalan" },
    set: { url: `${MATHLIB}Mathlib/Combinatorics/Enumerative/Catalan/Basic.html#catalan` },
    why: "mathlib4 split Enumerative/Catalan into Catalan/Basic; the old page is gone",
  },
  {
    match: {
      kind: "stat",
      subject: "Crank",
      on: "IntegerPartition",
      system: "findstat",
      identity: "St000146",
    },
    set: {
      identity: "St000474",
      url: "https://www.findstat.org/St000474",
      note: "FindStat's St000146 takes the length when there are no 1s; ours takes the largest part, which is St000474 — confirmed on every partition of n ≤ 10 by FindStat's finder",
    },
    why: "the recorded id disagrees with our definition by value",
  },
  {
    match: {
      kind: "stat",
      subject: "Area",
      on: "DyckPath",
      system: "findstat",
      identity: "St000012",
    },
    remove: true,
    why: "St000012 counts full cells between the path and the diagonal; our Area is the total of the heights after each step — a different statistic (4 vs 1 on [1,1,0,0])",
  },
];

/**
 * Rows the database never had, recorded here for the same reason the fixes are. The shape
 * is the extracted row's; `why` says what it rests on.
 */
export const ADDED_REFERENCES: readonly (CatalogReference & { readonly why: string })[] = [
  {
    kind: "collection",
    subject: "DyckPaths",
    system: "mathlib4",
    identity: "DyckWord",
    url: `${MATHLIB}Mathlib/Combinatorics/Enumerative/DyckWord.html#DyckWord`,
    why: "mathlib4 gained a Dyck word type; `catalan` is only the count",
  },
  {
    kind: "collection",
    subject: "SetPartitions",
    system: "mathlib4",
    identity: "Nat.bell",
    url: `${MATHLIB}Mathlib/Combinatorics/Enumerative/Bell.html#Nat.bell`,
    relation: "aggregate",
    why: "mathlib4 gained Bell numbers; the count of set partitions, not the objects",
  },
];

/** `rows` with every fix applied and every added row appended; a fix that matches nothing is an error, not a no-op. */
export function applyReferenceFixes(rows: readonly CatalogReference[]): CatalogReference[] {
  const matches = (row: CatalogReference, key: ReferenceKey): boolean =>
    row.kind === key.kind &&
    row.subject === key.subject &&
    row.system === key.system &&
    row.identity === key.identity &&
    (key.on === undefined || row.on === key.on);
  let out = [...rows];
  for (const fix of REFERENCE_FIXES) {
    const hit = out.filter((row) => matches(row, fix.match));
    if (!hit.length) {
      throw new Error(`reference fix matches no row: ${JSON.stringify(fix.match)}`);
    }
    out = fix.remove
      ? out.filter((row) => !hit.includes(row))
      : out.map((row) => (hit.includes(row) ? { ...row, ...fix.set } : row));
  }
  return [...out, ...ADDED_REFERENCES.map(({ why: _why, ...row }) => row)];
}
