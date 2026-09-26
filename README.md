# enumeratio

The monorepo behind [enumeratio.dev](https://enumeratio.dev): mathematical symbol
definitions for the [Cortex compute-engine](https://cortexjs.io/compute-engine/), and the
tools to write, explore and check them.

It answers to two names, split by what each governs:

- **enumeratio** (Latin, "a counting out") is the mathematics — what a symbol _means_ and how
  it evaluates. Its base is enumerative combinatorics: collections (permutations, partitions,
  Dyck paths, tableaux and a few hundred more) as lazy indexed families with closed-form
  counts, ranking and unranking, plus the statistics and maps over them. Around that sit
  number theory, the special functions and a range of algebras. Definitions are written in
  the engine's language, [Epsil](https://epsil.dev).
- **notatio** (Latin, "a marking") is the interface — how a person _writes and sees_ that
  mathematics: the notebook and `<notatio-*>` components, plots and glyphs, the CLI and
  REPL, the format registry, and the site. It is also the name of the restricted subset of
  Epsil those tools read and write.

Every symbol has a reference entry whose examples are tested, and are cross-checked against
external systems (Wolfram, SageMath, SymPy, mpmath, the OEIS, FindStat, Fungrim, …) wherever
a claim can be computed.

## Layout

| path                  | what's there                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/symbols/*/` | the symbol libraries, grouped by area: `combinatorics`, `arithmetic`, `analysis`, `algebras`, `groups`, `evaluation`                                                                                                                                   |
| `packages/`           | shared machinery: reference data (`entry`, `reference`, `catalog`), cross-checking (`oracle`, `census`, `plausible`, `bench`), output (`formats`, `wolfram`, `raster`), the interface (`notatio`, `notatio-lit`, `cli`) and helpers (`boxed`, `utils`) |
| `web/`                | the [enumeratio.dev](https://enumeratio.dev) site: guides, reference pages, worksheet and notebook                                                                                                                                                     |
| `tools/`              | CI tooling (`perf`)                                                                                                                                                                                                                                    |
| `design/`             | design notes — start from [roadmap.md](design/roadmap.md)                                                                                                                                                                                              |

Each package's `package.json` `description` says what it holds.

## Development

This is a [Vite+](https://viteplus.dev/) workspace; `vp` is the one CLI.

```sh
vp install      # install dependencies
vp run dev      # serve the site
vp check        # format, lint and type-check
vp test         # run tests
vp run ready    # check, test and build everything
```

[AGENTS.md](AGENTS.md) has the working conventions: naming, reference entries, testing and
CI. [namespaces.md](design/namespaces.md) describes how the symbol family is organised.

## License

[WTFPL](LICENSE).
