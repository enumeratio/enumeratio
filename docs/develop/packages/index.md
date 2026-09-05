# Packages

enumeratio is a pnpm monorepo. The spine is the pure-SQL database; everything else is a consumer of it.

| package | what it is |
|---|---|
| **[@enumeratio/data](/develop/packages/data/)** | The database *as a package* — the combinatorial catalog and whole schema as pure SQL (zero C). A pure-SQL Postgres extension; runs in any Postgres and in-browser via PGlite. Everything below reads through it. |
| **[@enumeratio/client](/develop/packages/client/)** | The TypeScript read-through client over the core: construct a collection, then enumerate, count, rank/unrank, project statistics, render representations, follow maps, value-address elements — lazily, against an in-browser (or node) PGlite. |
| **[@enumeratio/cli](/develop/packages/cli/)** | A terminal enumerator — stream a collection's elements to stdout; a thin driver over the client, and home of the sage oracle tests. |
| **[@enumeratio/components](/develop/packages/components/)** | Every enumeratio web component (Lit): pure data→visual figures (`*-glyph`, `*-figure`, the three.js polytope views) plus client-backed `enumeratio-*` elements (expression, notation, figure) that resolve a resource straight from the db. |

The **[explorer](/explore/collection/)** (`@enumeratio/explorer`, Vue + PrimeVue) is not a leaf package but the app that ties
these together — it loads the DB and browses collections / handles / stats interactively, and is built and mounted
inside this docs site.

Its guiding architecture, now core to the project: **a collection page IS a composed SQL `SELECT`.** The table's
columns are the projection (`SELECT`), the column configurator edits that clause; filtering is `WHERE`; grading is
`GROUP BY GROUPING SETS` (a plain table is `(())`, summary rows add `(level)`, a TreeTable is the full `ROLLUP`); the
footer's `()` group holds the overall aggregates; sorting is `ORDER BY`; `rank` vs `ordinality` are the canonical
address vs the ordinal-measure position in the filtered result. Because the naive materialisation of that query is the
definitional answer, it self-certifies the fast path. The full design is [the query model](https://github.com/enumeratio/enumeratio/wiki/Query-Model).

## How they stack

```
@enumeratio/data      pure SQL — the catalog + engines (the source of truth)
        ↑
@enumeratio/client    TS read-through API over a PGlite/Postgres connection
        ↑
   ┌────┴───────────────┬────────────────────┐
@enumeratio/cli   @enumeratio/components   @enumeratio/explorer
 (terminal)        (web components)          (Vue app, in these docs)
```

See [Learn](/learn/) for the live, in-browser components in action, and the [Design docs](https://github.com/enumeratio/enumeratio/wiki/Architecture) for the model.
