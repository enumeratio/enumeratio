# @enumeratio/manifest

Every head we know — its packages, overloads and their types, parameter names, attributes
and summary — assembled at build time from the reference records and a bare compute-engine
([Manifest](https://github.com/enumeratio/enumeratio/wiki/Manifest)). It loads no package's own code: everything here is
knowable about a head without importing the package that declares it, which is what makes
the resolver possible (below).

## Entry points

- **`.` (`src/index.ts`)** — `SYMBOLS`, `symbolInfo(name)`: every declared head, by name.
  `PACKAGES` (which package declares what), `DECLARERS` (each package's `declare` function,
  by name), `canonicalOrder`.
- **`./package/*`** — one generated module per package under `src/generated/package/`.
- **`createResolver` / `Resolver` / `plan` / `packagesFor` / `packagesNeeded` / `namesOf`**
  (`src/resolve.ts`) — given an expression and a `Library` per package (host-supplied: the
  manifest doesn't know how to import anything), resolves the heads and symbols it names to
  the packages that declare them, widens to those packages' own dependencies, and declares
  them into an engine in dependency order. See [Speculative Lazy Engine](https://github.com/enumeratio/enumeratio/wiki/Speculative-Lazy-Engine).
- **`createRegistryResolver` / `Registry` / `manifestRegistry` / `definitionRegistry` /
  `combineRegistries` / `searchPath` / `pinOf`** (`src/registry.ts`) — the same, one name at
  a time through registries, so nothing lists every name: our packages are one registry,
  Epsil definitions under a namespace (pinned by content) another. `searchPath` brings
  chosen namespaces' names into bare use, and refuses at setup a name two of them share or
  the system has, until it is preferred or excluded.
- **`npmRegistry` / `symbolIndexOf`** (`src/npm-registry.ts`) — symbol packages on npm, read
  over jsDelivr: a package marks itself with an `enumeratio` field (`namespace`, its scope;
  `index`), ships `symbols/<Name>/definition.json`, and `scripts/pack-symbols.ts <dir>` writes
  its `symbols/index.json`. Only the index and the definitions an expression uses are
  fetched, and each is checked against its pin. A qualified name (`Statistics.Mean`) declares its namespace as a record
  of functions, which is how Epsil's `.` already evaluates. See
  [Speculative Vdom Markup](https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup).

## Commands

```sh
node scripts/build.ts   # regenerate src/generated/{symbols,packages}.ts from the records
vp pack                  # or: vp run build (build.ts then vp pack)
vp check
vp test
```

`scripts/build.ts` reads every package's records and a bare compute-engine and sits at the
bottom of the build graph — it loads no package's code, only its records
(`@enumeratio/entry/node`). Run it after adding or changing a head; `vp run build` chains it
into the pack step.

## Next

[Manifest](https://github.com/enumeratio/enumeratio/wiki/Manifest) has the design and what tightening a signature's types
taught along the way. [`census`](../census/README.md) cross-checks the resulting namespace against
Wolfram's.
