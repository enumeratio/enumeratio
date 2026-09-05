# enumeratio

*Latin* **ēnumerātiō** (f.), from **ēnumerāre** "to count out, reckon up" (**ē-/ex-** "out" +
**numerāre** "to count," from **numerus** "number"). In classical rhetoric, the *enumeratio* is the
closing recapitulation that lists the points made.

The name holds both halves of the project's lineage. **Numeration** — writing a number positionally —
and **enumeration** — counting and listing the structures that organize those writings — share the
root *numerus*. enumeratio began as a study of number systems (its precursor, the sibling `numbers`
repo) and grew into a general, database-driven library of the combinatorial structures enumeration is
about — permutations, set partitions, compositions, subsets, Dyck paths, integer partitions, … — where
**the math is data**.

## What's here

A pnpm monorepo built on **pure SQL, zero C**:

- **`packages/data`** (`@enumeratio/data`) — the spine. 230+ combinatorial + number-theoretic collections
  defined as **catalog rows + SQL authored as data**, realized by a generator into a uniform
  handle/element/notation/membership layer. Runs in a bare PostgreSQL / [PGlite](https://pglite.dev) —
  no `CREATE EXTENSION`.
- **`packages/client`** (`@enumeratio/client`) — the TypeScript client over the core (PGlite in a worker
  thread in Node).
- **`packages/cli`** (`@enumeratio/cli`) — a terminal enumerator; home of the sage oracle tests.
- **`packages/components`** (`@enumeratio/components`) — Lit web components (pure figures +
  client-backed elements) that query the core and render elements, including SVG straight from the db.
- **`packages/explorer`** (`@enumeratio/explorer`) — a Vue + PrimeVue app that loads the DB and explores
  collections / handles / stats interactively; built and mounted inside the docs site. Its core architectural
  principle: **a collection page IS a SQL `SELECT`** — the columns are the projection, filtering is `WHERE`, grading is
  `GROUP BY GROUPING SETS`, sorting is `ORDER BY`, and the naive form of that query is a self-certifying oracle for the
  fast one. See [the query model](https://github.com/enumeratio/enumeratio/wiki/Query-Model).

## The model — the catalog *is* the database

A **collection** is a row in `base_collection` (plus its grade axes, orders, and examples) plus a carrier
type and a handful of engine functions. A generator (`base_realize`, see
[`packages/data/sqlsrc/realizer.sql`](packages/data/sqlsrc/realizer.sql)) turns each collection row into the
generic layer, so adding a collection is rows + its engine, never per-collection glue.

- **handle addressing** — `permutations(5)` is a subscriptable handle. Grades bind at construction
  (`set_partitions(5, blocks => 2)`) and grading is multi-axis; a subscript addresses the element by rank
  or by a named order. `cardinality(handle)` is ∞-aware.
- **membership is data** — `x <@ collection` / `collection @> x` dispatch to a generated `contains(handle, x)`;
  a collection's `is_*` predicate folds in as its `membership_predicate`, and grade axes are checked for free.
- **stat** = a per-element invariant; **map** = a function to another collection; **restrictions** name a
  slice as its own collection.
- **representations are data** — notation *and* figures: `render()` casts to a chosen medium, and
  `glyph_svg(<carrier>)` emits an element's SVG straight from the db.
- **examples are data** — the example suite runs every catalog example; they double as regression tests and
  documentation, and `COMMENT ON` makes the DB self-describing.

## One identity, many roles

What most combinatorics libraries miss is the *connections*. A combinatorial number is written once — as a
`math_*` identity (`math_factorial`, `math_binomial`, `math_stirling2`, …) — and every role that **is** that
number references it instead of re-deriving it: the **cardinality** of a collection (one Catalan identity is the
count of Dyck paths, binary trees, ordered trees, 231-avoiding permutations, and non-crossing partitions alike);
an **aggregate**'s closed form (the Stirling-2 row that the grade counts of `set_partitions(5)` sum to Bell(5));
and — the deep one — the **order-isomorphic maps** between equinumerous families, which let one *borrow*
another's ranking (`binary_trees` ranks through the Dyck-path bijection, never writing its own). One identity,
surfaced as counts, aggregates, and rankings and threaded through structure-preserving maps — rather than each
family reimplemented in isolation.

For the whole thesis in one place — the math-is-data invariant, one-identity-many-roles, the collection page as a SQL
view / star schema, and self-certifying correctness — read **[Math as data, data as math](docs/develop/index.md)**.

## Run

```sh
pnpm install

# apply the pure-SQL core into PGlite and run the example suite (the correctness gate)
cd packages/data && node --import tsx run.mts

# the docs site (VitePress) — hosts the guide, the math, and the built explorer
pnpm dev
```

## Testing

`pnpm test` runs everything in **dependency order**, fail-fast:

| Phase | Script | What |
|-------|--------|------|
| 1 | `pnpm test:core` | `@enumeratio/data`'s `run.mts` applies all `sqlsrc` into PGlite and runs the example suite (the foundation gate) |
| 2 | `pnpm test:stack` | `@enumeratio/client` typecheck → `@enumeratio/cli` typecheck → the sage oracle |
| 3 | `pnpm test:build` | `@enumeratio/explorer` build → docs build (compile-validation) |

`pnpm test:unit` runs just the Vitest suites (fast, unordered); `pnpm test:watch` watches them.

Two **self-certification** harnesses stand outside the default gate (slow by design — they materialize and sort whole
fibers): `packages/data/selfcert.mts` certifies each collection's accelerated `cardinality`/`unrank` against its naive
floor enumeration, and `selfcert-view.mts` lifts the same differential to a whole view (`WHERE`/`ORDER BY`/`GROUP BY`
vs. the naive materialisation). Run on demand:

```sh
pnpm --filter @enumeratio/data selfcert          # per-collection differential (add an id filter, e.g. `selfcert perm`)
pnpm --filter @enumeratio/data selfcert:view     # view-level differential
```

See [Math as data, data as math](docs/develop/index.md#_4-correctness-that-certifies-itself) for what these prove.

Design notes live in [the wiki](https://github.com/enumeratio/enumeratio/wiki); staged design docs awaiting that
move sit in `wiki/` at the repo root, outside the docs build.
