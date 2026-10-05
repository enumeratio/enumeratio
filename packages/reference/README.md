# @enumeratio/reference

Structured, verified example data for compute-engine functions — the single source for
reference pages and their tests. This is the loader and the crosswalk; the record format and
types it loads live in [`entry`](../entry/README.md), and the record layout itself is AGENTS.md
"Reference entries" plus [Examples as Data](https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data).

Depends on nearly every symbol package (it documents their heads) and on
[`oracle`](../oracle/README.md) and [`wolfram`](../wolfram/README.md) for cross-system checking — this is a
leaf on the dependency graph the other direction: nothing documents its own heads by
depending on `reference`.

## Entry points

- **`.` (`src/index.ts`)** — `engineEntries`/`ENGINE_DOMAIN` (stub entries for
  compute-engine's own undocumented symbols), `backlog`/`BacklogHead` (heads Wolfram has that
  we don't yet, from `backlog.json`), `checkImplementations` (re-exported from
  `@enumeratio/entry`), and the crosswalk (below).
- **`./node` (`src/node.ts`)** — the fs-based loader (AGENTS.md "Reference entries"): reads
  every `<package>/reference/<Head>/` folder through `@enumeratio/entry`'s reader, validates
  against its JSON Schema, and checks `id` collisions on a head shared between two packages.
  Node-only — the browser-facing `.` export never touches `node:fs`, since
  `ExampleAlternatives.vue` imports it directly.
- **`crosswalk/`** — a head's references assembled from every source that knows something
  about it: the entry's own `references:`, the catalog crosswalk, compute-engine's Wikidata
  id, DLMF, FindStat, OEIS, Fungrim. `crosswalkFor`/`crosswalkForCollection`/
  `crosswalkForStatistic`/`crosswalkForMap`, `groupBySystem`, `hrefOf`.

## Commands

Everything here is a `node`/`vp node` script under `scripts/`; run one directly rather than
through a `package.json` alias.

```sh
vp check
vp test                                              # incl. tests/known.test.ts — see AGENTS.md "Testing"

# after adding or changing an example, a printer, or a transpiler:
UPDATE_FORMS=1 node packages/frontend/scripts/collect-forms.ts

node packages/reference/scripts/format-records.ts     # rewrite every record through @enumeratio/entry's writer
node packages/reference/scripts/oracle-scan.ts --accept       # every example, every wired system
node packages/reference/scripts/oracle-scan.ts wolfram sage   # some systems only
node packages/reference/scripts/oracle-scan.ts --head Foo,Bar # one or a few heads, fast iteration

pnpm --filter @enumeratio/reference run crosswalk:fetch    # fungrim, inventories, wikidata, dlmf
pnpm --filter @enumeratio/reference run crosswalk:find     # oeis, findstat
pnpm --filter @enumeratio/reference run crosswalk:collect  # crosswalk-data.ts, engine-symbols-data.ts (`build` runs it); :check / :verify / :audit also exist
node packages/reference/scripts/collect-coverage.ts    # kernel snapshot, committed as src/coverage-data.ts (wolframscript, python3)
```

The crosswalk, engine-symbol and provenance data are built by `build` (gitignored, never
committed); `coverage-data.ts`, which says which systems expose each head, is the one committed
column, because only a kernel can answer it. `format-records.ts` fixes a record left in the wrong style or row order after a merge or hand
edit — it changes nothing about the data. `oracle-scan.ts` is a work queue, not a gate: read
its report, classify any new `unclassified` rows, commit the records it writes. See the
script's own header for what `agree`/`disagree`/`inconclusive`/`unmapped`/`error` mean.
Reference examples are themselves the test data (AGENTS.md "Testing") — never "fix" a failing
`known` example by rewriting `expected`.

## Next

[Examples as Data](https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data) is the design this package implements. AGENTS.md
"CI and deployment" covers where the gate ends and the oracle sweeps (advisory, nightly)
begin.
