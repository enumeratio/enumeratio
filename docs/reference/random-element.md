# random_element

*A uniformly random element of a collection — $O(1)$ at any size, never enumerates.*

## Usage

| Form | Meaning |
|---|---|
| `random_element(C)` | one uniform draw from collection handle $C$ |

## Details

- **Kind:** a generic engine primitive, in the same `HANDLE_ELEM` dispatch set as [`unrank`](/reference/unrank)
  (`packages/expressions/src/bind.ts`) — typed `elem(C)`, so its result can chain into `next`/`prev`/`rank` just
  like a `declare`d or `unrank`ed element.
- **Result type:** `elem(C)`.
- **Implementation:** draws one uniform integer in $[0, \operatorname{Count}(C))$ and calls the collection's own
  `unrank` — `RandomElement` in `packages/compute-engine/src/library.ts`. Because every collection's `unrank` is
  $O(1)$–$O(n)$ (never a full enumeration), this stays cheap even for astronomically large collections
  ($\operatorname{SymmetricGroup}(30)$'s $30!$ elements, say).
- **Randomness source:** a single module-level, seedable PRNG (mulberry32) shared by `random_element`,
  `scramble`, and `random_sample` — `seedRandom(n)` pins a reproducible stream (used by, e.g., a notebook's
  reshuffle control); `seedRandom()` with no argument reverts to `Math.random`. Reseeding is global: it affects
  every random primitive on every engine that has loaded this library, not just the caller's own collection.
- **Empty collection:** `random_element` of a collection with `Count = 0` has no value (`RandomElement` returns
  `undefined` rather than drawing from an empty range).

## Examples

`random_element(SymmetricGroup(52))` draws one of the $52!$ permutations of a 52-card deck uniformly at random,
without ever materializing a list of 52 cards to shuffle in place — contrast with `scramble`, below, which *does*
work by shuffling an explicit list.

`rank(random_element(C))` is a uniform random integer in $[0, \operatorname{Count}(C))$, for any collection $C$.

## See also

[`unrank`](/reference/unrank) · [`rank`](/reference/rank) · `scramble` (Fisher–Yates on an explicit list) ·
`random_sample` (n random elements) · [`cardinality`](/reference/cardinality) (the range random_element draws
over)
