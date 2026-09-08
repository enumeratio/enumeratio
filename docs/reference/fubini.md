# Fubini

*The number of ways to partition an $n$-element set into non-empty blocks AND put those blocks in order — the
ordered Bell numbers.*

## Usage

| Form | Meaning |
|---|---|
| $\operatorname{Fubini}(n)$ | the $n$-th Fubini (ordered Bell) number |
| $\operatorname{Fubini}(\{n_1, n_2, \dots\})$ | threads element-wise over a list (Listable) |

## Details

- **Arity:** 1 — a natural number $n$.
- **Argument/result type:** `(integer) -> integer`.
- **Attributes:** `broadcastable: true` (Listable).
- **Implementation:** the recurrence $\operatorname{Fubini}(n) = \sum_{k=1}^{n} \binom{n}{k}
  \operatorname{Fubini}(n-k)$, $\operatorname{Fubini}(0) = 1$, built bottom-up in one array
  (`packages/compute-engine/src/kernels-combinatorics.ts`) — $O(n^2)$ total for the whole table up to $n$.
- **Domain:** $n \geq 0$.
- **Counts:** `SetCompositions(n)` — ordered set partitions of $[n]$
  (`packages/compute-engine/src/packs/core.ts`: `SetCompositions`' count is literally `Fubini(n)`).
- **Relation to `BellB`:** $\operatorname{Fubini}(n) \geq \operatorname{BellB}(n)$ for $n \geq 1$ — every set
  partition contributes $k!$ ordered compositions, where $k$ is its number of blocks.

## Examples

$\operatorname{Fubini}(0) = 1,\quad \operatorname{Fubini}(1) = 1,\quad \operatorname{Fubini}(2) = 3,\quad
\operatorname{Fubini}(3) = 13,\quad \operatorname{Fubini}(4) = 75$

The 3 ordered set partitions of $\{1,2\}$ that $\operatorname{Fubini}(2) = 3$ counts: $(\{1,2\})$,
$(\{1\},\{2\})$, $(\{2\},\{1\})$ — one unordered block, plus the two orderings of splitting into singletons.

## See also

`SetCompositions` · [`BellB`](/reference/bell-b) (the unordered count) · `SetPartitionsIntoKBlocks` ·
`StirlingS2`
