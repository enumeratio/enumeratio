# @enumeratio/math

A pure-TypeScript, zero-dependency twin of enumeratio's SQL math core (`packages/data/sqlsrc/`). Same names,
same numbers — factorial, binomial, Bell/Fubini/Catalan/Stirling/Eulerian counting sequences, Gaussian and
multicomplex arithmetic, integer/set-partition and set-composition rank/unrank, permutation rank/unrank and
Lehmer codes, and more.

## Why this exists

enumeratio's core is a pure-SQL pglite extension — the math *is* data, queried through the collection realizer.
That's the right shape for the explorer and the client, but sometimes you just want a fast, dependency-free
JS/TS function: no pglite boot, no query round-trip. `@enumeratio/math` is that function library, kept in exact
lockstep with the SQL originals.

## Naming: the casing tells you whether it is contract

**`snake_case` means the export mirrors an SQL function byte-for-byte** (`stirling_second`, `catalan_number`,
`k_part_partition_count`) so the correspondence is never in doubt — grep one name, find both sides. These are the
contract surface: an engine registers them by this name, and `base_function_impl.impl_ref` points at it.

**`camelCase` means there is no bare SQL twin** — the operation is only reachable through the generic collection
framework (`integerPartitionUnrank` ↔ `unrank(integer_partitions(n), r)`), or it is a bijection's exact inverse
with no separately-named SQL function. The module header says which, per function, and the differential
round-trips these against the generic dispatch rather than against a named SQL function. Nothing outside this
package should depend on a camelCase name; it is not engine-registerable.

The one export that broke this rule (`integerPartitionKCount`, which does back a curated function) was renamed
to `k_part_partition_count` in #280. If you add a primitive with an SQL twin, name it after the twin.

## Swapping in another implementation (WASM, or anything else)

**The swap point is not in this package.** A backend does not replace or wrap these functions; it registers
itself in the catalog alongside them, and the router picks between them per call:

- add a row to `base_engine`, and a grant in `base_engine_grant` for the column groups it can serve;
- add `base_function_impl` rows — `(function, engine, impl_ref, arg_types, return_type, representation, cost)`;
- the client resolves an implementation by *overload* (`arg_types`, the way Postgres dispatches) and by
  *representation* (return precision, which Postgres cannot overload on). Those are separate columns precisely so
  a new backend can offer a different precision for a function that already exists.

That is why the naming rule above matters and why the `_bigint` suffixes live in `impl_ref` and not in the
function id: `factorial` is one identity with several implementations, currently a float64 TS one and an exact
`bigint` one. A WASM arbitrary-precision `factorial` is a third row, not a third name.

Two things a WASM backend inherits for free:

- **A correctness gate.** `packages/client/selfcert-engine.mts` is driven by the impl rows, so a new engine's
  rows are swept the moment they land — WASM == pg, or it declines. Nothing per-function needs writing.
- **A soft-decline contract.** An implementation that cannot answer exactly must throw `InexactResult` rather
  than return a plausible number; the router then falls through to the next engine. The float64 twins here do
  this past 2^53.

One measured caveat before assuming WASM wins on speed: `packages/client/bench-engine.mts` (#291) found a pg
scalar call is ~194 µs of transport and ~29 µs of arithmetic, and that in-process pglite and a worker thread cost
the same — so **the case for a WASM engine is removing the query, not moving it off-thread**, and the arithmetic
it would speed up is the small half.

## Verifying: the differential oracle

`selfcert-math.mts` is the one place this package is allowed to depend on the SQL core (via
`@enumeratio/data/node`, a devDependency only — the published package stays zero-dependency). It boots pglite,
and for every twinned primitive asserts `TS f(...) === SQL f(...)` (or, for generic-dispatch families, `TS
f(...) === notation((unrank(<collection>(...), r)).value)`) across a range of inputs — the same "accelerated ==
naive" differential style as `packages/data/selfcert.mts`, but here the two sides are TS vs. SQL rather than
two SQL paths.

```sh
cd packages/math
pnpm install          # first time only
node --import tsx selfcert-math.mts
```

A mismatch prints the SQL and TS values side by side and exits non-zero. Run `pnpm typecheck` for a plain
type-check (no SQL boot needed).
