# enumeratio

The monorepo behind [enumeratio.dev](https://enumeratio.dev): mathematical symbol
definitions for the [Cortex compute-engine](https://cortexjs.io/compute-engine/), and the
tools to write, explore and check them.

Its base is enumerative combinatorics: collections (permutations, partitions, Dyck paths,
tableaux and a few hundred more) as lazy indexed families with closed-form counts, ranking
and unranking, plus the statistics and maps over them. Around that sit number theory, the
special functions and a range of algebras. Definitions are written in the engine's
language, [Epsil](https://epsil.dev).

What holds it together is structure. A head says what structure it needs (`Min` a linear
order or a lattice, `Floor` ticks, `Basis` a finite-dimensional algebra), and a type
provides that structure by conforming to the engine's protocols. So a head is written once
and works on every type with enough structure, including one a user declares
([design](design/structures.md), after Mathlib's hierarchy). The interface, notatio, sits
on top of that.

Every symbol has a reference entry whose examples are tested, and are cross-checked against
external systems (Wolfram, SageMath, SymPy, mpmath, the OEIS, FindStat, Fungrim, …) wherever
a claim can be computed.

## Layout

| path                       | what's there                                                                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/symbols/*/`      | the symbol libraries, grouped by area: `combinatorics`, `arithmetic`, `analysis`, `algebras`, `groups`, `evaluation`                                                                                                                                       |
| `packages/`                | shared machinery: reference data (`entry`, `reference`, `catalog`), cross-checking (`oracle`, `census`, `plausible`, `bench`), output (`formats`, `wolfram`, `raster`), components and CLI (`notatio`, `components`, `cli`) and helpers (`boxed`, `utils`) |
| `upstream/compute-engine/` | fixes offered to compute-engine, applied as patches until they land ([design](design/upstreaming.md))                                                                                                                                                      |
| `web/`                     | the [enumeratio.dev](https://enumeratio.dev) site: guides, reference pages, worksheet and notebook                                                                                                                                                         |
| `tools/`                   | CI tooling (`perf`)                                                                                                                                                                                                                                        |
| `design/`                  | design notes — start from [roadmap.md](design/roadmap.md)                                                                                                                                                                                                  |

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
