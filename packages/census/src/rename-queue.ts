// Renames agreed but not executed — the queue to drain when a package is quiet.
//
// A head's own `formerly:` field (design/speculative/symbol-metadata.md) records renames
// that HAVE happened (catalog name → head; @enumeratio/statistics's `blessedName` reads the
// generated table built from it). This is the other end: a head we still declare under a
// spelling we have decided
// against, with the spelling it should get and what is holding it. Data rather than prose so
// a test can hold it honest: every `from` must still be declared, no `to` may be — the
// moment a rename lands, its row fails the test and comes out.
//
// The rule for what goes here is the one naming.ts states: a Wolfram collision is not a
// reason to rename; a name that misdescribes its result, or breaks the house spelling
// (`…Count`, `…Numerals`), is. Web-component tags are queued in design/component-naming.md
// §4 rather than here, since they are not engine heads.

export interface QueuedRename {
  readonly from: string;
  readonly to: string;
  /** Why the new spelling, in one line. */
  readonly why: string;
  /** What has to be true, or decided, before it can land. */
  readonly blockedBy: string;
}

export const RENAME_QUEUE: readonly QueuedRename[] = [
  // modular: named for the implementation rather than the mathematics. No Wolfram
  // counterpart to align against, which is why it drifted.
  {
    from: "FormRho",
    to: "FormCycleStep",
    why: "ρ is one step round the cycle of a reduced indefinite form; say what it does, not what Gauss called it",
    blockedBy: "the modular normalisation pass — do the package in one go, not one head at a time",
  },
  {
    from: "LinkingWithTrefoil",
    to: "TrefoilLinkingNumber",
    why: "a noun for a number, and the object first",
    blockedBy: "the modular normalisation pass",
  },
  {
    from: "WordSymbol",
    to: "RademacherSymbolOfWord",
    why: "it is the Rademacher symbol read off the S,T word — the head should say which symbol, and `Symbol` alone is compute-engine's",
    blockedBy:
      "the modular normalisation pass; RademacherSymbol takes the matrix, so an overload may be the better answer than a second head",
  },
];
