# Subsets

*The power set of $\{1, \dots, n\}$ — every subset, of every size, including $\varnothing$ and the full set.*

## Usage

| Form | Meaning |
|---|---|
| $\operatorname{Subsets}(n)$ | all $2^n$ subsets of $[n]$ |
| $\operatorname{At}(\operatorname{Subsets}(n),\ i)$ | the subset at 1-based position $i$ |
| $\operatorname{Rank}(\operatorname{Subsets}(n),\ S)$ | $S$'s 1-based position |

A subset is a strictly increasing list of its members, e.g. `[1, 3, 4]` $\subseteq [5]$. The empty set is `[]`.

## Details

- **Arity:** 1. For subsets of a fixed size $k$, see `KSubsets(n, k)`.
- **Result type:** `collection` of `list<integer>` (any length $0$ to $n$).
- **Count:** $2^n$.
- **Order:** binary membership mask — element $i$ ($1$-indexed) is present iff bit $i-1$ of the 0-based rank is
  set (`SubsetUnrank`/`SubsetRank` in `packages/compute-engine/src/packs/subsets.ts`). Rank 0 is $\varnothing$;
  the top rank $2^n - 1$ is the full set $[n]$.
- **Random access:** $O(n)$ — unrank/rank both scan the $n$ bit positions once.
- **Catalog alias:** the pg-catalog collection `subsets` names the same family (`COLL_HEADS`,
  `packages/client/src/ce-enum-engine.ts`).
- A companion order, `GrayCodeSubsets(n)`, visits the same $2^n$ subsets with each consecutive pair differing by
  exactly one element (a reflected binary Gray code) rather than by bitmask value.

## Examples

$\operatorname{Count}(\operatorname{Subsets}(3)) = 8$

In rank order (0-based), the subsets of $[3]$ are: $\varnothing,\ \{1\},\ \{2\},\ \{1,2\},\ \{3\},\ \{1,3\},\
\{2,3\},\ \{1,2,3\}$ — reading each rank $r$ in binary (LSB = element 1) gives the membership mask directly:
rank $5 = 101_2 \Rightarrow \{1, 3\}$.

$\{2, 4\} \subseteq [4]$ has mask $2^{1} + 2^{3} = 10 = 1010_2$, a 0-based rank of $10$ — so
$\operatorname{Rank}(\operatorname{Subsets}(4),\ [2, 4]) = 11$, since `Rank` (unlike the generic
[`unrank`](/reference/unrank)/[`rank`](/reference/rank) primitives) is 1-based
(`packages/compute-engine/src/library.ts` adds 1 to the kernel's own 0-based rank).

## See also

`KSubsets` · `GrayCodeSubsets` · `SubsetsOfSizeAtMost` · `EvenSubsets` · `OddSubsets` ·
[`cardinality`](/reference/cardinality) · [`unrank`](/reference/unrank)
