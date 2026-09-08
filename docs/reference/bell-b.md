# BellB

*The number of ways to partition an $n$-element set into non-empty, unordered blocks.*

## Usage

| Form | Meaning |
|---|---|
| $\operatorname{BellB}(n)$ | the $n$-th Bell number, $B_n$ |
| $\operatorname{BellB}(\{n_1, n_2, \dots\})$ | threads element-wise over a list (see Listable, below) |

## Details

- **Arity:** 1 — a natural number $n$.
- **Argument/result type:** `(integer) -> integer`.
- **Attributes:** `broadcastable: true` — CE's Listable: `BellB` applied to a list evaluates element-wise instead
  of erroring, with no special-casing needed in the implementation (`packages/compute-engine/src/library.ts`'s
  `numberOp` helper wraps every counting sequence this way).
- **Implementation:** the Bell triangle (`packages/compute-engine/src/kernels-combinatorics.ts`) — each row is
  built from the previous one in $O(n)$ additions per row, $O(n^2)$ total for $B_0 \ldots B_n$; not a closed form.
- **Domain:** $n \geq 0$; $B_0 = 1$ by convention (the empty set has exactly one partition: itself, with zero
  blocks).
- **Counts:** the collection `SetPartitions(n)` — $\operatorname{Count}(\operatorname{SetPartitions}(n)) =
  \operatorname{BellB}(n)$ by construction (`packages/compute-engine/src/packs/core.ts`).

## Examples

$\operatorname{BellB}(0) = 1,\quad \operatorname{BellB}(1) = 1,\quad \operatorname{BellB}(2) = 2,\quad
\operatorname{BellB}(3) = 5,\quad \operatorname{BellB}(4) = 15$

The 5 set partitions of $\{1,2,3\}$ that $\operatorname{BellB}(3)=5$ counts: $\{1\}\{2\}\{3\}$, $\{1,2\}\{3\}$,
$\{1,3\}\{2\}$, $\{1\}\{2,3\}$, $\{1,2,3\}$.

## See also

`SetPartitions` · [`Fubini`](/reference/fubini) (ordered set partitions — the same blocks, sequenced) ·
[`PartitionsP`](/reference/partitions-p) (integer partitions, not set partitions) · `StirlingS2` (set partitions
into an exact number of blocks)
