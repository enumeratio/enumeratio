// A carrier domain: what a collection's ELEMENTS are, as opposed to the collection itself —
// except the domain and its PLAIN collection are the same head now (design/domains.md's
// naming rule): a domain's name is plural, and IS the same-named collection where one
// exists (`SetPartitions` is both). The singular pascal-case of a carrier's id is reserved
// for an inhabitant — a helper naming ONE value, e.g. `SetPartitionUnrank` — never a domain
// or collection name; there is no singular alias.
//
// `SetPartitions(4)` is a collection; its elements inhabit the `SetPartitions` domain, and
// so do the elements of `SetPartitionsIntoKBlocks(4, 2)` and of every other collection over
// that carrier. 280 collections over 86 carriers — one domain serves three collections on
// average, which is why the catalog stores the carrier rather than deriving it.

/** The structural shape a carrier's values have, as a compute-engine type expression. */
export type Shape = string;

export interface Domain {
  /** The domain's name, plural — and the CONSTRUCTOR head's spelling (the same head as the
   *  plain collection, where one exists; declare.ts's `declareConstructor` is what makes
   *  that a merge rather than a collision). */
  readonly name: string;
  /** The nominal type's name — lowercase singular, which a signature reads. */
  readonly type: string;
  /** The underlying structure, for the type body. */
  readonly shape: Shape;
  /** enumeratio's snake_case carrier id — which is also the type's spelling. */
  readonly id: string;
  /** The domain this one RESTRICTS, when it is a restriction. compute-engine cannot express
   *  the subtype relation between minted types (§1.1), so this is recorded as data and
   *  checked by predicate rather than believed by the engine. */
  readonly restricts?: string;
  /** The membership predicate, as a head taking a value of the parent domain. */
  readonly predicate?: string;
}

/**
 * Two names for two things now, not three, and no suffix on either — because compute-engine's
 * own convention already has room for both:
 *
 *   affine_permutation    the TYPE        snake_case, exactly like `integer`, `indexed_collection`
 *   AffinePermutations    the CONSTRUCTOR *and* the COLLECTION — one head, both jobs
 *
 * The engine spells its primitive types `integer`, `number`, `boolean`, `indexed_collection`
 * — lowercase, snake_case when multiword — and reserves the TitleCase plural for a
 * set-valued SYMBOL: `Integers` is not a type at all, it is a symbol whose type is
 * `set<integer>`. Our carrier constructors follow that same reading: `AffinePermutations` is
 * a symbol (a held constructor, or an enumerated family — declare.ts's overload-merging is
 * what lets one name answer to both), never a type. The snake_case singular stays the type,
 * and the TitleCase PLURAL is what used to be split between a singular constructor and a
 * plural collection — merged now, per design/domains.md's naming rule.
 *
 * The type name therefore needs no transformation at all: it is enumeratio's carrier id
 * verbatim, which was snake_case already.
 *
 * An earlier version of this file suffixed the type (`PermutationType`) to avoid a collision
 * with the constructor. That collision is real — types and symbols share one namespace — but
 * the suffix was the wrong way out of it: following the engine's own casing convention
 * avoids it entirely and reads better in every position.
 */
export const typeFor = (id: string): string => id;
