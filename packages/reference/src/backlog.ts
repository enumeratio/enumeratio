// Heads we do not have yet, that Wolfram's reference pages reach for.
//
// An aspirational example (`aspirational: true` on an entry's example) records a gap in a
// head we already document. This is the other half of that backlog: heads with no entry at
// all, found while porting the examples of Wolfram's pages for heads we do have
// (`neededBy`), or as the obvious missing sibling of one. Each carries examples in the same
// shape as a reference example, every one of them a target we do not meet yet — so adding
// the head is a matter of moving its record into an entry file and dropping it from here.
//
// The records live in `backlog.json`; `tests/backlog.test.ts` keeps them honest (every
// example still evaluates, none is met yet, and no head here is already documented).

import data from "./backlog.json" with { type: "json" };
import type { ReferenceExample } from "./types.ts";

/** One head to add, with the examples it should meet. */
export interface BacklogHead {
  /** The head name we would declare -- compute-engine's conventions (`Is…`), not `…Q`. */
  readonly name: string;
  /** The Wolfram symbol whose reference page the examples come from. */
  readonly wolfram: string;
  readonly summary: string;
  readonly signature: string;
  /** The package that would most naturally own it. */
  readonly home: string;
  /** Documented heads whose Wolfram examples reach for this one. */
  readonly neededBy: readonly string[];
  /** Never `aspirational`-flagged: every example here is a target not yet met. */
  readonly examples: readonly ReferenceExample[];
}

export const backlog: readonly BacklogHead[] = Object.entries(
  data as Readonly<Record<string, Omit<BacklogHead, "name">>>,
).map(([name, head]) => ({ name, ...head }));
