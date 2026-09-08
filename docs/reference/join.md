# join

*Concatenate lists into one.*

## Usage

| Form | Meaning |
|---|---|
| `join(L1, L2, ...)` | the lists concatenated in argument order |

## Details

- **Kind:** a generic list primitive (`packages/components/src/notebook-catalog.ts`'s `GENERIC_PRIMITIVES`) —
  one of the three (with [`sort`](/reference/sort) and [`unique`](/reference/unique)) that compute-engine already
  implements natively, so enumeratio **binds to it rather than reimplementing it**: at parse time the identifier
  `join` canonicalizes to compute-engine's own Pascal head, `Join` — the same canonicalization `sort`→`Sort` and
  `unique`→`Unique` get (`packages/expressions/src/bind.ts`'s `LIST_RESULT_OPS` comment; the pass-through at
  evaluation is `CE_LIST_OPS` in `packages/client/src/ce-enum-engine.ts`).
- **Result type:** `integer[]` (typed by `LIST_RESULT_OPS` in `bind.ts`; arguments are still individually typed
  for error-checking even though the result type doesn't depend on them).
- **Semantics:** list concatenation — `Join([1,2], [3], [4,5])` is `[1,2,3,4,5]`. This is compute-engine's own
  operator; enumeratio does not alter or extend its behavior.

## Examples

`join([1, 2], [3, 4])` is `[1, 2, 3, 4]`.

## See also

[`sort`](/reference/sort) · [`unique`](/reference/unique) · `scramble` · `random_sample`
