# rank

*The index of an already-located element within its collection — the inverse of [`unrank`](/reference/unrank).*

## Usage

| Form | Meaning |
|---|---|
| `rank(x)` | the 0-based index of $x$ within the collection it was located in |

## Details

- **Kind:** a generic engine primitive, dispatched on the argument's type (the `NEXT_PREV_RANK` set in
  `packages/expressions/src/bind.ts`, shared with `next`/`prev`).
- **Argument type:** `elem(C)` for some collection $C$ — `x` must already be a *located* element (bound by a
  `declare`, or itself the result of `unrank`/`random_element`/`next`/`prev`), not a bare value. Passing a plain
  scalar is a type error: `"rank" expects a collection element, not <kind>`.
- **Result type:** `natural_number`.
- **Indexing:** **0-based**, matching `unrank`'s own convention (`rank` and `unrank` are exact inverses at this
  layer). At evaluation, the pure-CE backend lowers `rank(x)` to CE's `Rank(C, x) − 1` — CE's `Rank` operator is
  1-based, so the primitive subtracts 1 to land back on 0.
- **Non-membership:** if `x` is not actually a member of the collection the type system believes it belongs to,
  the result is undefined (stays symbolic) rather than an error — `rankOf` in `packages/compute-engine/src/
  library.ts` returns `undefined` for a non-member, and every one of this library's views/combinators (`Reversed`,
  `Product`, `Zip`, …) composes that same convention recursively.

## Examples

Given `x ∈ SymmetricGroup(3)` and `x = [2,3,1]`, `rank(x)` is the 0-based lex position of $[2,3,1]$ among the
$3! = 6$ permutations of $[3]$.

`rank(unrank(C, 7))` is `7` for any collection $C$ with at least 8 elements — `rank` and `unrank` round-trip.

## See also

[`unrank`](/reference/unrank) (the inverse) · `next` / `prev` (rank $\pm 1$, same family) ·
[`random_element`](/reference/random-element) · [`cardinality`](/reference/cardinality)
