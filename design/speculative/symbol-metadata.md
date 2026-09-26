# Symbol metadata as data

This is a proposal; nothing is started yet. It follows the examples-as-data migration (design/examples-as-data.md) and would begin once step 7 lands.

## The split

Each head gets three files, side by side, where its reference record lives today:

| file                          | holds                                                                 | written by                 |
| ----------------------------- | --------------------------------------------------------------------- | -------------------------- |
| `<Head>.yaml`                 | what the symbol _is_: every fact about the head that isn't an example | hand                       |
| `<Head>.examples.yaml`        | the examples list, exactly as `examples:` is today                    | hand                       |
| `<Head>.implementations.yaml` | one entry per example id: our forms, each system's run                | collect-forms, oracle scan |

- Every example gets an implementations entry, even when that entry is empty (`{}`). yaml.test already enforces this, so the rule carries over unchanged.
- MathJSON stays canonical in the examples file. notatio and every other form stay derived, in the implementations file.
- A head can have a `<Head>.yaml` and no examples file. That is how we get the facts out of TS for the 130-odd heads we map or rename but never document by hand (see below).

### Naming

The head-level list in `<Head>.yaml` is `bindings:` (it was `implementations:`, which clashed with the per-example `<Head>.implementations.yaml`).

## What moves into `<Head>.yaml`

This table comes from a survey of main at the time of writing. The counts are only there for scale.

| today                                                                                                 | heads                       | becomes                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reference/src/crosswalk/curated.ts` `CURATED`                                                        | ~180 (30 without a record)  | `references:` (the field already exists; the curated rows merge into it)                                                                              |
| `curated.ts` `FUNGRIM_NAMES`, `DLMF_NAMES`, `WIKIDATA_FIXES`, `WIKIDATA_CONFIRMED`, `CATALOG_ALIASES` | ~110 across the five tables | a `names:` map, e.g. `{ fungrim: RiemannZeta, dlmf: …, wikidata: Q…, catalog: … }`, with a flag for whether the Wikidata ID is confirmed              |
| `wolfram/src/to-wolfram.ts` `HEADS`                                                                   | ~520 (130 without a record) | `names.wolfram`, set only when Wolfram's name differs from ours                                                                                       |
| `oracle/src/mappings.ts` `MAPPINGS`                                                                   | ~86 (24 without a record)   | head-level `bindings:` rows with `origin: mapped`, one row per system: `form: sympy`, `template: "primepi($1)"`, plus `arity`, `threadArg` and `note` |
| `statistics/src/naming.ts` `RENAMED`                                                                  | about a dozen               | `formerly: [<catalog name>]`, a data alias like the numerals renames                                                                                  |
| `ce.declare({ description })` in the symbol packages                                                  | a few dozen                 | a single source, `summary`, which the declare call reads from generated data                                                                          |

These stay where they are:

- `catalog/src/reference-fixes.ts`, because it is keyed by catalog row, not by head.
- The generated `*-data.ts` files (wikidata, fungrim, oeis, dlmf, inventory, …), because they are fetched; the loader joins them by name.

MAPPINGS is the move that pays off most. The page already shows the head-level `bindings:` list as "the systems it maps to", and MAPPINGS is a second hand-kept copy of the same fact.

## Records for heads we don't document

Heads like `Add`, `Power`, `Rational` and `Equal` carry Wolfram names and oracle templates but have no record. Each gets a metadata-only `<Head>.yaml` in `packages/reference/entries/`, with no examples file. Today the `stub: engine` pages are all generated. A stub that carries hand data would become a written file, and the rest would stay generated.

## Runtime access

`to-wolfram` and the oracle emitters run in the browser and in CI, and they need synchronous lookups. So do the `ce.declare` descriptions. There are two ways to give them the data:

- A generated `*-data.ts` per consumer, pinned by a test that the generated file is current. This is how `heads-data.ts` and the forms work today.
- The `virtual:reference-entries` Vite module plus the Node loader. This only works where the consumer already runs under Vite or the loader.

I'd default to the generated files. No consumer has to learn about YAML, and tree-shaking keeps the browser bundles small.

## Order, each its own PR

Every step lands as a codemod with a before/after test. At the codemod commit, a test deep-compares the old TS export against the table rebuilt from YAML, as its consumer sees it. A follow-up PR then deletes the TS table and the test. The codemods stay in `packages/reference/scripts/migrate/` until the last step.

1. Split `examples:` out into `<Head>.examples.yaml`. This step is purely mechanical: the loader and `writeEntries` learn the three-file layout, the `.vscode` schemas get the new glob, and the site's data comes out identical before and after.
2. Move `curated.ts` into `references:` and `names:`. Its only consumer is the crosswalk, and `check-crosswalk.ts` already fetches every URL.
3. Move `RENAMED` into `formerly:`.
4. Move the Wolfram `HEADS` into `names.wolfram`. The test: `toWolfram` gives the same output for every key of `HEADS` across the round-trip golden set.
5. Move `MAPPINGS` into `bindings:` rows. The test: `emit` gives the same source for every example on every system, and the nightly drift check stays quiet across the switch.
6. Replace the declare descriptions with `summary`.
7. Delete `migrate/`.

## Open questions

- Does `details:` stay in `<Head>.yaml`? It's prose like `summary`, so I'd say yes.
- Heads such as `FormDiscriminant` are documented on their family's page. Should each get its own metadata file with a `page:` pointer to the family, or stay discoverable only through the family's record?
- Should the crosswalk's derived rows ever be written back into `references:`? I'd say no: derived data stays derived, and the page joins the two.
