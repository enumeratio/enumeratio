# @enumeratio/client

The TypeScript **read-through client** over the pure-SQL enumeratio core
([`@enumeratio/data`](https://www.npmjs.com/package/@enumeratio/data)), running in
[PGlite](https://pglite.dev) — the math API the CLI, explorer, and web components all consume.

Construct a collection, then enumerate, count, rank / unrank, project statistics, render representations, follow maps,
and value-address elements — lazily, against an in-browser or node PGlite.

```bash
npm install @enumeratio/client
```

> **Ships as TypeScript source.** Entry points are `.ts` — consume from a bundler (Vite) or a TS-aware runtime
> (`tsx`), not plain `node`. Dual `node` / `browser` conditions select the right PGlite loaders.

## Usage

Wire a `Db` provider once, then use the read-through API:

```ts
import { provideDb, makeDb, construct, collections } from '@enumeratio/client'

provideDb(() => makeDb())            // main-thread; or makeWorkerDb() for off-thread + watchdog

await collections()                  // -> ['permutations', 'integer_partitions', …]

const perms = construct('permutations', { size: 4 })
await perms.card()                   // 24
for await (const row of perms.elements()) console.log(row.element)
```

The node entry also exports `makePgDb()` — a **dev/test** provider that applies the sqlsrc core to a throwaway
scratch database on a real Postgres (`ENUMERATIO_PG_URL`, default `postgres://localhost:5432/postgres`) and drops it
on `close()` (`{ keep: true }` to keep it). Unlike PGlite, a real server honours `SET statement_timeout`, so a sweep
script can cancel a runaway query instead of needing `makeWorkerDb()`'s watchdog. Tested against PostgreSQL 18; see
`packages/data/pg-demo.mts`.

It runs on a small `pg.Pool`, tracks every pooled session by backend pid (in-flight statement + a ring of the last
20), and carries a watchdog: a statement in flight past `stuckMs` is inspected from *another* connection
(`pg_stat_activity`, `pg_blocking_pids`), emitted as a full diagnostic bundle to `onPgDiagnostic()` /
`recentPgDiagnostics()`, then `pg_cancel_backend`ed — escalating to `pg_terminate_backend` only if the cancel
doesn't take. Dead connections (mid-query or idle) emit the same kind of bundle and are never reused. See
`packages/data/pg-watchdog-demo.mts`, which proves all four paths.

The browser entry additionally exports the shared-session loaders
(`makeServiceWorkerDb`, `SessionDb`, …) for one observable calculation surface across tabs.

## License

[Unlicense](./LICENSE) (public domain).
