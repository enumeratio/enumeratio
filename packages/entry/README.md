# @enumeratio/entry

The shape of a reference entry: the types every package's `reference/<Head>/` folder is
written against, and the rule an `implementations` block has to satisfy. A leaf package —
`collections`, `statistics` and `domains` can all depend on it, while [`reference`](../reference/README.md)
depends on them, which is the cycle this package exists to break.

A head's folder holds `index.md` (front matter plus a markdown body), `examples.tsv` (one
hand-written row per example, in page order), and the generated
`examples.values.<system>.tsv`. See AGENTS.md "Reference entries" and
[Examples as Data](https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data) for the format and what `id`, `known` and `source`
mean on an example.

## Entry points

- **`.` (`src/index.ts`)** — the entry/example/binding types, the crosswalk pointer a record
  may carry (`CrosswalkSource`, `SOURCES`, `SYSTEM_ORDER`), `checkImplementations` (the
  `bindings` rule), `orderImplementations`, `slugId`/`captionId`/`dedupeId`, and the YAML
  codec (`parseYaml`/`stringifyYaml`/`isCanonicalYaml`) used for anything still written as
  YAML (component stories).
- **`./schema` (`src/schema.ts`)** — the JSON Schemas the records validate against
  (`REFERENCE_ENTRY_SCHEMA`, `REFERENCE_EXAMPLES_SCHEMA`, `HEAD_IMPLEMENTATIONS_SCHEMA`,
  `COMPONENT_STORIES_SCHEMA`), written by `build` into the uncommitted `schema/*.schema.json`.
- **`./node` (`src/node.ts`)** — the fs reader/writer every tool goes through:
  `readHead`/`writeHead`/`updateHead`/`removeHead`, `readEntries`/`writeEntries`,
  `headNames`/`headExists`/`isWrittenHead`, component `.stories.yaml`. Node-only, so it never
  lands on the main export.

**Read and write records through `@enumeratio/entry/node`, never by hand-parsing their
files** — hand edits are fine; the writer normalizes them back. A record is written in two
passes: `src/record.ts` decides the split across `index.md`/`examples.tsv`, oxfmt decides
layout, so a written record is exactly what `vp fmt` would make of it. A TSV cell is its text
as written; one that can't sit in a row as written (a tab, a line break, a leading `"`, the
empty string) is JSON-encoded (`src/tsv.ts`).

## Commands

```sh
vp check                                       # format, lint, type check
vp test                                        # tests/*.test.ts
pnpm --filter @enumeratio/entry build          # write schema/*.schema.json
```

## Next

[`reference`](../reference/README.md) is the loader and crosswalk built on these types; hand edits to a
record are fine, and `packages/reference/scripts/format-records.ts` tidies them through this
package's writer.
