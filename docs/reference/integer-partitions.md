# IntegerPartitions

*The collection of integer partitions of $n$ — ways to write $n$ as a sum of positive integers, order
disregarded.*

## Usage

| Form | Meaning |
|---|---|
| $\operatorname{IntegerPartitions}(n)$ | all partitions of $n$ into positive parts |
| $\operatorname{At}(\operatorname{IntegerPartitions}(n),\ i)$ | the partition at 1-based position $i$ |
| $\operatorname{Rank}(\operatorname{IntegerPartitions}(n),\ p)$ | $p$'s 1-based position |

A partition is a list of positive integers summing to $n$, always returned in **weakly decreasing** (largest-part-
first) normal form: `[3, 2, 2, 1]` is the partition $3+2+2+1 = 8$.

## Details

- **Arity:** 1 — the number $n$ being partitioned. (A separate two-argument family, `PartitionsIntoKParts(n, k)`,
  fixes the number of parts.)
- **Result type:** `collection` of `list<integer>`, weakly decreasing, summing to $n$.
- **Count:** $p(n)$ — [`PartitionsP`](/reference/partitions-p), computed by Euler's pentagonal-number recurrence.
- **Order:** greedy descending — the unrank walks remaining sum `m` and a shrinking part-size ceiling, always
  choosing the largest part consistent with the target rank (`IntegerPartitionUnrank` in
  `packages/compute-engine/src/kernels-combinatorics.ts`). This is a well-defined total order but not
  lexicographic on the part sequence in the usual sense — don't assume adjacent ranks differ by a small edit.
- **Random access:** polynomial, not $O(1)$ — unrank/rank both walk the partition's own parts (at most $n$ of
  them), consulting a memoized partial-count table (`partsAtMost`) at each step.
- **Catalog alias:** the pg-catalog collection `integer_partitions` names the same family (see `COLL_HEADS` in
  `packages/client/src/ce-enum-engine.ts`).

## Examples

$\operatorname{Count}(\operatorname{IntegerPartitions}(5)) = \operatorname{PartitionsP}(5) = 7$

The 7 partitions of 5 are $5,\ 4{+}1,\ 3{+}2,\ 3{+}1{+}1,\ 2{+}2{+}1,\ 2{+}1{+}1{+}1,\ 1{+}1{+}1{+}1{+}1$ — the
collection's own unrank order does not have to match this "largest summand first, then recurse" listing exactly at
every rank, only its *first* choice at each step; verify a specific rank against `IntegerPartitionUnrank` rather
than assuming a simple pattern.

$\operatorname{At}(\operatorname{IntegerPartitions}(5),\ 1) = [5]$ — rank 1 (0-based rank 0) is always the single
part $n$ itself, since the unrank always prefers the largest available part first.

## See also

`PartitionsIntoKParts` · `DistinctPartitions` · `PartitionsMaxPart` · `PartitionsInBox` ·
[`PartitionsP`](/reference/partitions-p) · [`unrank`](/reference/unrank) · [`rank`](/reference/rank)
