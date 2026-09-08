# unrank

*The element at a given index — $O(1)$ random access into any collection, no scan.*

## Usage

| Form | Meaning |
|---|---|
| `unrank(C, i)` | the element of collection handle $C$ at 0-based index $i$ |

## Details

- **Kind:** a generic engine primitive — not a per-collection stat or map, one mechanism shared by every
  collection in the catalog. Recognized by its literal name wherever it appears as a call head (it has to be
  registered in the parser's function dictionary first — see `packages/expressions/src/ce/latex.ts`'s
  `catalogDictionary`), not by matching a `base_operation`/`base_function` id
  (`packages/expressions/src/names.ts`).
- **Dispatch:** on the ARGUMENT's type, not the head name alone — `unrank`/`random_element` are the
  `HANDLE_ELEM` set in `packages/expressions/src/bind.ts`, distinguishing them from ordinary catalog functions.
- **Result type:** `elem(C)` — a *located* element of $C$, not a bare scalar; typing it this way is what lets a
  later `next`/`prev`/`rank` chain onto the result without re-declaring it.
- **Indexing:** the primitive's own index $i$ is **0-based**. At evaluation, the pure-CE backend
  (`packages/client/src/ce-enum-engine.ts`) lowers `unrank(C, i)` to CE's `At(C, i+1)` — CE's own collection
  index is 1-based — so the off-by-one is absorbed at the engine boundary, not left for a notebook author to
  manage.
- **Complexity:** $O(1)$ to $O(n)$ depending on the family — this is the entire point of the library
  (`packages/compute-engine/src/library.ts`'s header comment: "CE's combinatorial collections have closed-form
  counts but SCAN-based random access and NO rank. Every collection here supplies an O(1) `at` (via unrank)").
  A family like [`SymmetricGroup`](/reference/SymmetricGroup) or [`Subsets`](/reference/subsets) decodes its
  index in $O(n)$ (one pass over the $n$ positions), never by enumerating and counting off elements — the
  distinction that matters at collection sizes where naive enumeration is infeasible (e.g. $n!$ or $2^n$ for
  $n$ in the dozens).
- **Out of range:** an index outside $[0, \operatorname{Count}(C))$ has no value — CE's `at` handler
  (`gradedHandlers` in `library.ts`) returns `undefined` rather than throwing or wrapping.

## Examples

`unrank(SymmetricGroup(4), 0)` is the lexicographically-first permutation of $[4]$: $[1,2,3,4]$.

`unrank(Subsets(3), 5)` is the subset whose 0-based rank is $5 = 101_2$: $\{1, 3\}$ — see
[`Subsets`](/reference/subsets) for the bitmask convention.

## See also

[`rank`](/reference/rank) (the inverse) · [`random_element`](/reference/random-element) (a uniform random
unrank) · `next` / `prev` (unrank at rank $\pm 1$ of an already-located element) ·
[`cardinality`](/reference/cardinality) (the bound `unrank`'s index ranges over)
