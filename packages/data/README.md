# @enumeratio/data

The enumeratio database **as a package** — the combinatorial catalog and its whole schema as pure SQL (zero C).
~150 collections realized by a data-driven generator into a uniform handle / fiber / element / notation / membership
layer. Under the hood a pure-SQL Postgres extension; it runs in any Postgres and in-browser via
[PGlite](https://pglite.dev).

Everything else in enumeratio reads through this. Most consumers use it via
[`@enumeratio/client`](https://www.npmjs.com/package/@enumeratio/client) rather than touching the SQL directly.

```bash
npm install @enumeratio/data
```

> **Ships as TypeScript source.** The entry points are `.ts` — consume it from a bundler (Vite) or a TS-aware runtime
> (`tsx`), not plain `node`. The browser entry uses Vite's `import.meta.glob` to inline the SQL at build time.

## What's in it

- **`sqlsrc/*.sql`** — the source of truth: one file per collection / concern, each with a `-- requires:` header that
  fixes load order.
- **`enumeratio-core.pgdata`** — a prebuilt, gzipped PGlite snapshot of the whole core, stamped with a bundle hash.
  Mount it (`loadDataDir`) to skip re-exec'ing the SQL. Regenerated from `sqlsrc` on every publish.

## Entry points

| Import | Use |
| --- | --- |
| `@enumeratio/data` | Browser / Vite entry — `coreFiles`, `coreBundle`, `coreBundleHash` inlined at build via `import.meta.glob`. |
| `@enumeratio/data/node` | Node entry — reads `sqlsrc` from disk and orders it (no bundler needed). `coreFiles()`, `coreBundle()`. |
| `@enumeratio/data/vite` | Vite plugin (`enumeratioCore()`) — serves the prebuilt pgdata dump in dev and emits it in prod. |
| `@enumeratio/data/enumeratio-core.pgdata` | The prebuilt snapshot as a resolvable asset URL. |

```ts
// node: load the ordered core into a PGlite instance
import { PGlite } from '@electric-sql/pglite'
import { coreFiles } from '@enumeratio/data/node'

const pg = new PGlite()
for (const f of coreFiles()) await pg.exec(f.content)
```

`@electric-sql/pglite` is an optional peer — needed only for the `vite` / dump build paths.

## License

[Unlicense](./LICENSE) (public domain).
