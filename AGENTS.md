# Working in enumeratio

A **pure-SQL, data-driven Postgres combinatorics library** and its consumers. The spine is
`packages/pg-enumeratio` — combinatorial + number-theoretic collections (subsets, permutations,
partitions, compositions, paths, trees, matchings, primes, number sequences/sets, …) defined as **catalog rows + SQL authored as data**, realized by a generator into a uniform handle/element/notation/membership layer. It
runs in a bare PostgreSQL / [PGlite](https://pglite.dev) with **zero C** — no `CREATE EXTENSION`. Consumers: a
TypeScript client (`enumeratio-client`), a terminal enumerator (`enumeratio-cli`, home of the sage oracle
tests), a Vue/PrimeVue explorer (`enumeratio-explorer`), and docs. pnpm workspace.

> The original C/PGXS extension (`packages/pg-enumeratio`) and its WASM build (`pglite-enumeratio`) are the
> **legacy** precursor — superseded by the pure-SQL core. Don't build new work there.

## The one architectural invariant

**Everything is data, including the DDL.** A collection is rows in the `catalog_*` tables plus its carrier type
and engine functions — and those types/functions/casts are *themselves* inserted as rows into the staging
tables `enumeratio_type` / `enumeratio_function` / `enumeratio_cast`, then emitted by `SELECT
enumeratio_commit();` (one insertion-ordered DDL stream, with a precise inverse for revert). Almost nothing is a
raw hand-written `CREATE`.

- **The catalog is the database.** `catalog_collection`, `catalog_grade_axis`, `catalog_collection_order`,
  `catalog_example`. A generator — `enumeratio_realize_collection(coll)` / `enumeratio_realize_sequence(coll)` —
  turns each row into the generic layer: the handle composite type + constructor, `cardinality(handle)`,
  `unrank(handle, r)`, `contains(handle, x)` + membership operators `<@` / `@>`, `notation(handle)`,
  `elements`/`fibers`, the located-element type + implicit cast, and `COMMENT ON` docs from the row's
  `description`.
- **The registry stays fully reconfigurable from data.** Never add per-collection special-casing in the
  generator or the client — add catalog rows. Reuse a carrier and *borrow* rankings via an order-isomorphic
  bijection where one exists; record subset relationships with `catalog_collection.specializes`.
- **`natural_number` / `cardinal_number` are unbounded `numeric` domains** — counts get huge, and cardinality
  is ∞-aware.

**Public surface vs. implementation — a hard line.** User-level code calls only the *public* surface: the
constructors and the generic layer the generator emits (`cardinality`, `unrank`/`rank`, `contains` + `<@`/`@>`,
`notation`, `elements`/`fibers`, exposed stats/maps). The *internal* engines a collection hand-authors —
combinatorial `<coll>_count(n int, grades int[])` + `<coll>_unrank_<order>(n int, grades int[], r
natural_number)`, numeric `<coll>_term(r)` + `<coll>_count_below(bound)` (`grades[]` positional by axis, `NULL`
= unbound) — are trampolined to by the generic names and **very likely to change** (followon: genericization to
fiber-taking functions bound by catalog reference, not name-mangling). Never build consumer code against the
`<coll>_` names. (Open, undecided: whether the core lives in a shared DB as a real PG extension or owns its own
DB — the public/internal split holds either way; enforcement mechanism waits on that call.)

## Layout, ordering, and the apply flow

`packages/pg-enumeratio/sqlsrc/`: `bootstrap.sql` (number tower, math identities, catalog tables, the
data-DDL stage/commit machinery, the generator) always loads first. Every other file is one collection with a
sensible name and a dependency header:

```sql
-- requires: set-partitions, dyck-paths
```

Load order is a topological sort over those headers (`sqlsrc-order.ts`) — **no numeric filename prefixes**.
Examples live beside each collection as `catalog_example` rows (living assertions).

```sh
# from packages/pg-enumeratio:
node --import tsx run.mts             # apply all sqlsrc (toposorted) into PGlite, run the example suite
node --import tsx run.mts cand.sql    # + apply a candidate last, in a rolled-back txn (prototype a collection)
node --import tsx overview.mts        # generate overview.html from the live catalog
```

`run.mts` / `overview.mts` are **temporary scaffolding**. The DB is self-describing (catalog + `COMMENT ON` +
example assertions); the intended end state is a Vue/PrimeVue component that introspects the PGlite DB and
generates docs from code + data.

## Adding / porting a collection

Prefer wrapping an existing carrier; borrow a ranking through an order-isomorphic bijection where one exists
(the generator produces the engine). Author the file data-style (like `subsets.sql` / `integer-partitions.sql`),
give it a `-- requires:` header, ship `catalog_example` rows as its regression + docs, and run `run.mts` to a
green example suite. When porting from the `numbers` repo or the legacy extension, **anchor counts to the
source's own recurrence / OEIS id, not memory** — ad-hoc cross-check anchors have been wrong before.

**Gotchas (these will bite you):**

- `numeric /` rounds — use `div()` for integer division.
- Domain `CHECK`s must be flat — no nested plpgsql calls.
- Composite `::text` casts don't round-trip (malformed record literal); build handles via `unrank(...)`.
- Reserved keywords as unquoted identifiers break the DDL (`left`, …). `guards.sql` asserts no catalog
  identifier collides with a reserved keyword — keep it green.
- `$body$` can't appear inside an `enumeratio_function` body (it's the outer dollar-quote).
- `enumeratio_type` handles both composite types and domains (via `kind = 'domain'`); stage both as rows.

## Collection lifecycle

Collections are **immutable in the wild** — augment or tombstone-with-deprecation, never rename. Rename only at
design time against a fresh DB; there is no DB rename helper.

## Conventions & working with Dean

Dean's global working style lives in `~/.config/opencode/AGENTS.md` — read/honor it (senior dev, concise +
direct, self-documenting code with short comments for funky bits, no unsolicited tests unless
fast/reliable/useful, don't summarize diffs). Repo-specific:

- **Main is fine here.** Dean has OK'd working directly on `main` in this repo; keep each change a clean,
  self-contained commit. Branch/worktree for genuinely long parallel work — clean it up after.
- **No scratch in the repo.** Session notes, throwaway scripts, analysis → `.scratch/` (gitignored) or `/tmp`.
  One-off analysis prefers a committed, re-runnable `tsx` script over inline `node -e`.
- **Commits:** concise, intent not minutiae; approximate counts ("a few", not "3"). **No `Co-Authored-By`
  trailer** — Dean's standing rule forbids it.
- **Ask on ambiguity** before implementing, even in build mode — especially for core-carrier changes.
- **Don't trust self-justifying comments.** Ported/generated comments sometimes rationalize whatever shape
  exists as "correct"; believe the design goal over the comment, and fix the comment.

---

## Output style (caveman mode)

This repo runs caveman mode for every IDE agent. Code, commits, PRs, and security warnings are written
normally; only prose is compressed.

Respond terse like smart caveman. All technical substance stay. Only fluff die.

Rules:

- Drop: articles (a/an/the), filler (just/really/basically), pleasantries, hedging
- Fragments OK. Short synonyms. Technical terms exact. Code unchanged.
- Pattern: [thing] [action] [reason]. [next step].
- Not: "Sure! I'd be happy to help you with that."
- Yes: "Bug in auth middleware. Fix:"

Switch level: /caveman lite|full|ultra|wenyan
Stop: "stop caveman" or "normal mode"

Auto-Clarity: drop caveman for security warnings, irreversible actions, user confused. Resume after.

Boundaries: code/commits/PRs written normal.
