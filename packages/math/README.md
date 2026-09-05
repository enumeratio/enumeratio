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

## Naming: mirror the SQL, exactly

Every export is named to match its SQL counterpart byte-for-byte (`stirling_second`, `catalan_number`,
`permutation_unrank_lex` → `permutation_unrank`, etc.) so the correspondence is never in doubt — grep one name,
find both sides. Where a primitive has no SQL twin (its rank is only reachable through the generic collection
framework, e.g. `unrank(integer_partitions(n), r)`, or it's a bijection's exact inverse with no separately-named
SQL function), the module header says so explicitly and the differential instead round-trips the TS function
against itself or against the generic dispatch.

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
