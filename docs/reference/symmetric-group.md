# SymmetricGroup

*The collection of permutations of $\{1, \dots, n\}$, in one-line notation.*

## Usage

| Form | Meaning |
|---|---|
| $\operatorname{SymmetricGroup}(n)$ | the collection of all $n!$ permutations of $[n]$ |
| $\operatorname{At}(\operatorname{SymmetricGroup}(n),\ i)$ | the permutation at 1-based position $i$ in lexicographic order |
| $\operatorname{Rank}(\operatorname{SymmetricGroup}(n),\ p)$ | $p$'s 1-based lexicographic position |

A permutation is represented as a list of length $n$: `[3, 1, 2]` means $1 \mapsto 3,\ 2 \mapsto 1,\ 3 \mapsto 2$
(one-line notation — the image of $1, 2, \dots, n$ read left to right).

## Details

- **Arity:** 1 — a single natural number $n$.
- **Result type:** `collection` of `list<integer>`, each of length $n$.
- **Count:** $n!$ ([Factorial](https://reference.wolfram.com/language/ref/Factorial.html)).
- **Order:** lexicographic on the one-line word, via Lehmer-code decode/encode (`PermutationUnrank`/
  `PermutationRank` in `packages/compute-engine/src/kernels.ts`) — the same rank/unrank pair the SQL catalog's
  `permutation_unrank_lex` uses.
- **Random access:** $O(n)$ — unrank walks the $n$ remaining-symbol slots once; not $O(1)$ the way a closed-form
  count alone might suggest, since decoding a Lehmer code still touches every position.
- **Catalog alias:** the pg-catalog collection `permutations` is this same family under a different name (see
  `packages/client/src/ce-enum-engine.ts`'s `COLL_HEADS`) — a notebook line can spell either
  `\operatorname{SymmetricGroup}(4)` or `\operatorname{permutations}(4)` and reach the identical collection.
- **Related stat:** `Inversions` counts a permutation's Coxeter length (sum of its Lehmer code) — compose it
  with `At`: $\operatorname{Inversions}(\operatorname{At}(\operatorname{SymmetricGroup}(9),\ 5))$.

## Examples

$\operatorname{Count}(\operatorname{SymmetricGroup}(4)) = 24$

The lexicographically-first permutation of $[4]$ (1-based position 1) is $[1,2,3,4]$; the last (position 24) is
$[4,3,2,1]$.

The 6 words in lex order are $[1,2,3], [1,3,2], [2,1,3], [2,3,1], [3,1,2], [3,2,1]$, so $[2,3,1]$ sits at the 4th
position: $\operatorname{Rank}(\operatorname{SymmetricGroup}(3),\ [2,3,1]) = 4$ — `Rank` here is 1-based. The
generic primitive [`rank`](/reference/rank) reports the same position 0-based (`rank([2,3,1])` would be `3`),
matching `unrank`'s own 0-based convention — see that page for why the two conventions differ.

## See also

`KPermutations` · `SignedPermutations` · `ColoredPermutations` · `Derangements` · `Involutions` ·
[`rank`](/reference/rank) · [`unrank`](/reference/unrank) · [`random_element`](/reference/random-element) ·
[`cardinality`](/reference/cardinality)
