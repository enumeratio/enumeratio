// A carrier domain: what a collection's ELEMENTS are, as opposed to the collection itself.
//
// `SetPartitions(4)` is a collection; its elements inhabit the `SetPartition` domain, and so
// do the elements of `SetPartitionsIntoKBlocks(4, 2)` and of every other collection over that
// carrier. 280 collections over 86 carriers — one domain serves three collections on average,
// which is why the catalog stores the carrier rather than deriving it.

/** The structural shape a carrier's values have, as a compute-engine type expression. */
export type Shape = string;

export interface Domain {
  /** The domain's name, singular — and the CONSTRUCTOR head's spelling. */
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
 * Three names for three things, and no suffix on any of them — because compute-engine's own
 * convention already has room for all three:
 *
 *   affine_permutation   the TYPE        snake_case, exactly like `integer`, `indexed_collection`
 *   AffinePermutation    the CONSTRUCTOR what appears in expressions
 *   AffinePermutations   the COLLECTION  the indexed family
 *
 * The engine spells its primitive types `integer`, `number`, `boolean`, `indexed_collection`
 * — lowercase, snake_case when multiword — and reserves the TitleCase plural for a
 * set-valued SYMBOL: `Integers` is not a type at all, it is a symbol whose type is
 * `set<integer>`. So the plural denotes a set (a value), the snake_case singular is the type,
 * and the TitleCase singular is free for the constructor.
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
