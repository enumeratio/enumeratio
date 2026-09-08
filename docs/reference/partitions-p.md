# PartitionsP

*$p(n)$ — the number of integer partitions of $n$ (OEIS A000041).*

## Usage

| Form | Meaning |
|---|---|
| $\operatorname{PartitionsP}(n)$ | $p(n)$ |
| $\operatorname{PartitionsP}(\{n_1, n_2, \dots\})$ | threads element-wise over a list (Listable) |

## Details

- **Arity:** 1 — a natural number $n$.
- **Argument/result type:** `(integer) -> integer`.
- **Attributes:** `broadcastable: true` (Listable).
- **Implementation:** Euler's pentagonal-number recurrence,
  $p(n) = \sum_{k\geq1} (-1)^{k-1}\left(p\!\left(n - \tfrac{k(3k-1)}{2}\right) + p\!\left(n -
  \tfrac{k(3k+1)}{2}\right)\right)$, built bottom-up in one array (`packages/compute-engine/src/kernels-extra.ts`)
  — sub-quadratic (the pentagonal gaps grow, so each row's inner loop terminates well before $n$ terms).
- **Domain:** $n \geq 0$; a negative $n$ returns $0$.
- **Counts:** the collection [`IntegerPartitions`](/reference/integer-partitions) —
  $\operatorname{Count}(\operatorname{IntegerPartitions}(n)) = \operatorname{PartitionsP}(n)$ by construction.
- **Distinct from `PartitionsQ`:** `PartitionsQ(n)` counts partitions into *distinct* parts only — a different,
  smaller sequence with its own collection, `DistinctPartitions`.

## Examples

$\operatorname{PartitionsP}(0) = 1,\quad \operatorname{PartitionsP}(1) = 1,\quad \operatorname{PartitionsP}(4) = 5,
\quad \operatorname{PartitionsP}(5) = 7,\quad \operatorname{PartitionsP}(10) = 42$

$\operatorname{Count}(\operatorname{IntegerPartitions}(5)) = 7$ matches
$\operatorname{PartitionsP}(5) = 7$ — see [`IntegerPartitions`](/reference/integer-partitions) for the 7 partitions
this counts.

## See also

[`IntegerPartitions`](/reference/integer-partitions) · `PartitionsQ` (distinct parts) · `DistinctPartitions` ·
`PartitionsMaxPart` · `KPartPartitionCount` (as `PartitionsIntoKParts`'s count) · [`BellB`](/reference/bell-b)
(set, not integer, partitions)
