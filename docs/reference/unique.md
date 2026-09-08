# unique

*Remove duplicate elements from a list, preserving first-occurrence order.*

## Usage

| Form | Meaning |
|---|---|
| `unique(L)` | $L$ with duplicates removed |

## Details

- **Kind:** a generic list primitive canonicalized at parse time to compute-engine's own `Unique` head — see
  [`join`](/reference/join) for the shared "bind, don't reimplement" mechanism.
- **Result type:** `integer[]`.
- **Semantics:** order-preserving deduplication — the first occurrence of each distinct value is kept, in its
  original position; later duplicates are dropped (`packages/client/src/ce-enum-engine.ts`'s comment on
  `CE_LIST_OPS` states this explicitly: "Unique = order-preserving dedup"). This is compute-engine's own
  operator; enumeratio does not alter it.

## Examples

`unique([1, 3, 1, 2, 3, 3])` is `[1, 3, 2]`.

## See also

[`join`](/reference/join) · [`sort`](/reference/sort)
