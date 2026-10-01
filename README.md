# enumeratio

The monorepo behind [enumeratio.dev](https://enumeratio.dev): mathematical symbol
definitions for the [Cortex compute-engine](https://cortexjs.io/compute-engine/), and the
tools to write, explore and check them. Design notes, the roadmap and contributor notes
live on the [wiki](https://github.com/enumeratio/enumeratio/wiki).

Its base is enumerative combinatorics: collections (permutations, partitions, Dyck paths,
tableaux and a few hundred more) as lazy indexed families with closed-form counts, ranking
and unranking, plus the statistics and maps over them. Around that sit number theory, the
special functions and a range of algebras. Definitions are written in the engine's
language, [Epsil](https://epsil.dev).

What holds it together is structure. A head says what structure it needs (`Min` a linear
order or a lattice, `Floor` ticks, `Basis` a finite-dimensional algebra), and a type
provides that structure by conforming to the engine's protocols. So a head is written once
and works on every type with enough structure, including one a user declares
([Structures](https://github.com/enumeratio/enumeratio/wiki/Structures), after Mathlib's
hierarchy). The interface, notatio, sits on top of that.

Every symbol has a reference entry whose examples are tested, and are cross-checked against
external systems (Wolfram, SageMath, SymPy, mpmath, the OEIS, FindStat, Fungrim, …) wherever
a claim can be computed ([Examples as Data](https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data)).

## Layout

| path                   | what's there                                                                                                                                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/symbols/*/`  | the symbol libraries, grouped by area: `combinatorics`, `arithmetic`, `analysis`, `algebras`, `groups`, `evaluation`                                                                                                                                                                               |
| `packages/`            | shared machinery: reference data (`entry`, `reference`, `catalog`, `manifest`), cross-checking (`oracle`, `census`, `plausible`, `bench`), structure (`structures`), output (`formats`, `boxes`, `wolfram`, `raster`), interface (`frontend`, `components`, `cli`) and helpers (`engine`, `utils`) |
| `packages/ce-patches/` | fixes and heads offered to compute-engine, applied as patches until they land ([README](packages/ce-patches/README.md))                                                                                                                                                                            |
| `web/`                 | the [enumeratio.dev](https://enumeratio.dev) site: guides, reference pages, component stories, worksheet and notebook                                                                                                                                                                              |
| `tools/`               | CI tooling (`perf`)                                                                                                                                                                                                                                                                                |

Each package's `package.json` `description` says what it holds;
[Packages](https://github.com/enumeratio/enumeratio/wiki/Packages) and
[Namespaces](https://github.com/enumeratio/enumeratio/wiki/Namespaces) describe how they
and the symbol family are organised.

## Development

This is a [Vite+](https://viteplus.dev/) workspace; `vp` is the one CLI.

```sh
vp install      # install dependencies
vp run dev      # serve the site
vp check        # format, lint and type-check
vp test         # run tests
vp run ready    # check, test and build everything
```

Build the library packages before `vp check` or the tests, since both resolve sibling
packages through their `dist/`:

```sh
pnpm -r --filter "./packages/**" run build
```

## More on the wiki

- [Roadmap](https://github.com/enumeratio/enumeratio/wiki/Roadmap): what's next, by area,
  and where to look for work.
- [Contributing](https://github.com/enumeratio/enumeratio/wiki/Contributing): names, where a
  change goes, reference entries, tests, git and CI.
- [Lanes](https://github.com/enumeratio/enumeratio/wiki/Lanes): how parallel work is
  coordinated and landed.
- Design and speculative design: the rest of the wiki's sidebar.

[AGENTS.md](AGENTS.md) holds the same working conventions, written for coding agents.

## License

[WTFPL](LICENSE).
