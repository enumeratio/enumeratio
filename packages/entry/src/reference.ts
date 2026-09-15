import type { CrosswalkSystem } from "./sources.ts";

/** How a reference's `identity` relates to its subject. Omitted means the same object. */
export type ReferenceRelation = "partial" | "aggregate" | "conceptual";

/** One pointer from a head (or a statistic, a map, a collection) into another system. */
export interface Reference {
  readonly system: CrosswalkSystem;
  /** The resolvable name over there -- a symbol, a class, a Q-id, an St-number, a page title. */
  readonly identity: string;
  /** The page, when the system's URLs cannot be built from the identity alone. */
  readonly url?: string;
  /** What differs, when the correspondence is not exact. */
  readonly note?: string;
  readonly relation?: ReferenceRelation;
  /**
   * Operand count the row applies to, for a head that means different things at different
   * arities -- `Zeta` is Riemann's at one argument and Hurwitz's at two, and the two have
   * different pages everywhere. Omitted: the row is about the head as a whole.
   */
  readonly arity?: number;
}

/** Where a resolved reference was found, so the page can say and a reader can judge. */
export type ReferenceOrigin =
  /** Written on the entry itself. */
  | "entry"
  /** The hand-kept table in `crosswalk/curated.ts`. */
  | "curated"
  /** The enumeratio catalog's own crosswalk (`base_reference`). */
  | "catalog"
  /** Compute-engine's definition of the symbol (its Wikidata id). */
  | "engine"
  /** The Wikidata item's own sitelink and external identifiers. */
  | "wikidata"
  /** The DLMF's index of notations, matched by name. */
  | "dlmf"
  /** FindStat's finder, matched by value on every object up to a size. */
  | "findstat"
  /** The OEIS, matched by the family's counting sequence. */
  | "oeis"
  /** A Fungrim identity the engine compiled, whose rule mentions this head. */
  | "fungrim"
  /** The transpiler's head map: the Wolfram symbol it vouches for. */
  | "wolfram"
  /** The oracle's mapping table: the equivalent call in another kernel. */
  | "oracle";

/** A reference with its link built and its provenance attached. */
export interface ResolvedReference extends Reference {
  readonly label: string;
  readonly href?: string;
  readonly origin: ReferenceOrigin;
  /**
   * Established by computation: values or counts compared with the other system's, or the
   * head's own examples run in that system's kernel. `disagree` is a count of examples that
   * came out differently -- a pointer that is checked and WRONG somewhere, which is worth
   * more than an unchecked one, not less.
   */
  readonly verified?: {
    readonly by: "values" | "terms" | "examples" | "identities";
    readonly count: number;
    readonly disagree?: number;
    readonly note?: string;
  };
  /** The name the reference was actually recorded against, when not this head's own. */
  readonly via?: string;
}
