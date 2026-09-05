# @enumeratio/data

The enumeratio **database, as a package** — the combinatorial catalog and its whole schema, authored as **pure SQL,
zero C**. This is the bare data and the engine that realizes it; everything else in the monorepo is a consumer of it.

A collection is declared as *data* (a carrier type + a grade chain + catalog rows) plus one hand-authored floor
engine; the `base_realize()` generator turns that into the handle/fiber/element types and the whole surface —
`cardinality`, `elements`, `unrank`, `fibers`, `contains`, `render()`, and the `base_catalog` / `base_stat` /
`base_repr` / `base_map` / `base_glyph` registries. 230+ collections today. The `sqlsrc/*.sql` files apply in
`-- requires:` dependency order (`sqlsrc-order.ts`), the one ordering both the disk runner and the Vite bundle use.

## What it *is*, underneath

A **pure-SQL PostgreSQL extension** — nothing more. No C, no PGXS build; the types, functions, casts, and catalog
rows are all plain SQL, so the same source applies into a bare Postgres server *or* an in-browser
[PGlite](https://pglite.dev). Consumers pull it in for exactly one thing: the SQL that stands the database up.

- [`@enumeratio/client`](/develop/packages/client/) imports the assembled SQL (`coreBundle` / `coreFiles`) to boot a DB.
- [`@enumeratio/cli`](/develop/packages/cli/) and the [components](/develop/packages/components/) drive that client.

Because the client reads the **data-driven catalog** (`base_catalog`) rather than hard-coding collections, it can
mount *any* compatible build of this package and self-configure from the DB shape — an invariant worth preserving as
the packaging below evolves.

## Where this is headed (documented intent, not yet built)

This package is deliberately the seam between "the math as data" and every runtime. The direction — see the
[dual-artifact roadmap item](https://github.com/enumeratio/enumeratio/wiki/Roadmap) — is to publish it **two ways**:

1. **A valid PostgreSQL extension** — a control file + versioned SQL, installable in a real server
   (`CREATE EXTENSION`). The `math_`-prefixing already dodges builtin collisions; no dedicated schema (a schema
   fights extension packaging).
2. **An npm package** — the artifacts a consumer needs to stand the DB up: the assembled, **engine-neutral install
   SQL** (the always-shipped core), and *optionally* a **fast-start snapshot** — a pre-initialized PGlite datadir
   tarball, so a PGlite consumer skips re-applying 230+ collections' worth of DDL on every boot. The snapshot is a
   PGlite-flavored *convenience* artifact, not a dependency: it ships alongside the neutral SQL, and a non-PGlite
   consumer just ignores it.

### Open questions (being worked out — this doc is where we think them through)

- **The test suite belongs here.** The example suite (`base_example`, run by `run.mts` against PGlite) *is* the
  pure-SQL regression suite — every `catalog` example doubles as a test and as documentation. Anything **pure SQL**
  should live and run here; only genuinely non-SQL checks (the CLI's sage oracle, TS typechecks) stay with their
  packages. Open: also expose the suite through the **standard pg extension test infrastructure** (`pg_regress` /
  `make installcheck`) for the real-server artifact — worth figuring out what shape that takes today (pg_regress
  still ships with PostgreSQL, but it's wired for PGXS/source builds, not a pure-SQL-as-data package). Node + PGlite
  is the fast inner loop regardless.
- **Runtime stays with the client (settled 2026-08-27); PGlite is NOT a dep here.** Deciding *where the data lives*
  is inherently a client instance's job, so the PGlite standup — mounting, workers, the PGlite version — stays in
  [`@enumeratio/client`](/develop/packages/client/). That keeps this package engine-neutral and, crucially, lets a client
  pointed at a **real Postgres** (extension installed) skip the PGlite/WASM freight entirely. The seam already
  exists: the client's `provideDb(factory)` is the injection point, so a consumer picks its backend — PGlite (any
  version; workers *or* all-main-thread) or a real pg connection — without this package caring. Moving a mounting
  helper *into* data later is only a possible direction, gated by **real-world usage patterns + startup times**, not
  a leaning.
- **Introspection helpers.** Small scripts to browse/inspect the data (list collections, dump a catalog slice) could
  ship here so the package is legible on its own, not only through a client.

## The extension name

As a real Postgres extension the underlying thing wants a conventional `pg_`/`pg-` name (e.g. `pg-enumeratio`);
`@enumeratio/data` is the npm face of it. Not decided — noted so the two names don't get conflated.

See the [design docs](https://github.com/enumeratio/enumeratio/wiki/Architecture) for the model, the [retired C extension](https://github.com/enumeratio/enumeratio/wiki/C-Extension) for the
precursor, and the [client](/develop/packages/client/) for the read-through API.
