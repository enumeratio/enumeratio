# @enumeratio/manifest

Every head we know — its packages, overloads and their types, parameter names, attributes
and summary — assembled at build time from the reference records and a bare compute-engine
([Manifest](https://github.com/enumeratio/enumeratio/wiki/Manifest)). It loads no package's own code: everything here is
knowable about a head without importing the package that declares it, which is what makes
the resolver possible (below).

## Entry points

- **`.` (`src/index.ts`)** — `SYMBOLS`, `symbolInfo(name)`: every declared head, by name.
  `PACKAGES` (what each package requires), `canonicalOrder`, and the resolver:
  `createResolver(libraries)` reads what each library's build found declaring it
  (`declares.json`, written by `scripts/collect-declares.ts`).
- **`./package/*`** — one generated module per package under `src/generated/package/`.
- **`createResolver` / `Resolver` / `plan` / `packagesFor` / `packagesNeeded` / `namesOf`**
  (`src/resolve.ts`) — given an expression and a `Library` per package (host-supplied: the
  manifest doesn't know how to import anything), resolves the heads and symbols it names to
  the packages that declare them, widens to those packages' own dependencies, and declares
  them into an engine in dependency order. See [Speculative Lazy Engine](https://github.com/enumeratio/enumeratio/wiki/Speculative-Lazy-Engine).
- **`buildEngine` / `enginePlan` / `loadLibraries` / `dependedLibraries` / `DECLARE_ORDER` /
  `DECLARE_PREFERENCE`** (`src/engine.ts`) — an engine with the libraries asked for, the base
  (`evaluation`, `boxes`, `structures`) and what each requires, declared in the order `HIERARCHY`
  gives, with the reason each is there. A library's own `package.json` says what declares it
  (`enumeratio.declare`: exports of its main entry, or `./subpath#export`; `late` for what must
  come after every library's own, and `requires` and `names` where it needs them); the host
  says how to import and how to make an engine, so hosts (`reference`, `census`) list no declare
  calls. `DECLARE_ORDER` is the order that holds though no library requires it (empty: BL-13's
  clobbers are gone), and `DECLARE_PREFERENCE` the one the records' `overrides` were written
  against.
- **`createRegistryResolver` / `Registry` / `manifestRegistry` / `definitionRegistry` /
  `combineRegistries` / `searchPath` / `pinOf`** (`src/registry.ts`) — the same, one name at
  a time through registries, so nothing lists every name: our packages are one registry,
  Epsil definitions under a namespace (pinned by content) another. A qualified name
  (`Statistics.Mean`) declares its namespace as a record of functions, which is how Epsil's
  `.` already evaluates. `searchPath` brings chosen namespaces' names into bare use, and
  refuses at setup a name two of them share or the system has, until it is preferred or
  excluded. With `check`, a definition's examples run in a scratch engine before it is
  declared, once per pin.
- **`./libraries`** (`src/libraries/`) — libraries from a package host (npm
  or GitHub over jsDelivr; `PackageHost` for others) as a registry (`catalog`), their
  format (`libraryIndexOf`), and ranges locked to versions (`lockLibraries`, by `semver`, checking
  each package's `system` range against `SYSTEM_VERSION`). A subpath, so the resolver alone
  doesn't bring `semver`. `scripts/pack-library.ts <dir>` writes a package's index, its
  examples and its JavaScript entry.

See [Speculative Vdom Markup](https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup).

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
