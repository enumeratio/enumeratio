# sort

*Sort a list into ascending order.*

## Usage

| Form | Meaning |
|---|---|
| `sort(L)` | $L$'s elements in ascending order |

## Details

- **Kind:** a generic list primitive canonicalized at parse time to compute-engine's own `Sort` head — see
  [`join`](/reference/join) for the shared "bind, don't reimplement" mechanism (`LIST_RESULT_OPS` in
  `packages/expressions/src/bind.ts`; `CE_LIST_OPS` in `packages/client/src/ce-enum-engine.ts`).
- **Result type:** `integer[]`.
- **Semantics:** compute-engine's own `Sort` — ascending numeric order. Enumeratio does not alter or extend its
  behavior (no custom comparator support beyond what CE itself exposes).

## Examples

`sort([3, 1, 4, 1, 5])` is `[1, 1, 3, 4, 5]`.

## See also

[`join`](/reference/join) · [`unique`](/reference/unique)
