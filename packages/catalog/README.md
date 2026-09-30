# @enumeratio/catalog

The enumeratio catalog as resolvable resources: lazy context namespaces, a search path, and
the promotion ladder from namespaced to blessed to global
([Namespaces](https://github.com/enumeratio/enumeratio/wiki/Namespaces)). Registering the whole catalog — hundreds of
collections, carriers, stats and maps — costs one map insert each; nothing here declares a
compute-engine head until a name is actually promoted. Depends only on [`engine`](../engine/README.md).

Its heads (`Resource`) keep their reference entries under `reference/`.

## Entry points

- **`.` (`src/index.ts`)** re-exports everything:
- **`types.ts`** — `Resource`/`ResourceKind`/`Grade`, `CatalogCollection`/`CatalogCarrier`,
  `qualify`/`unqualify`.
- **`registry.ts`** — `ResourceRegistry`: the context registry and search path behind the
  three rungs (namespaced, blessed, promoted). Promotion is a path change, never a rename —
  `enumeratio\`Subsets`keeps resolving after`Subsets` goes global.
- **`resources.ts`** — `catalogResources`, `catalogRegistry`, `ENUMERATIO`: the catalog's own
  names as resources in the `enumeratio` context, from `catalog-records-data.ts`.
- **`declare.ts`** — `declareCatalog(ce, options)`: whether a resource is answerable (a real
  head is already declared) is asked of the engine, never recorded in the data.
- **`lazy.ts`** — `prepare`/`applicationCandidates`/`rawParse`/`Install`: the resolve-before-evaluate
  loop — parse, find candidates, resolve async, declare, box — so the synchronous evaluator
  is never asked to suspend ([Namespaces](https://github.com/enumeratio/enumeratio/wiki/Namespaces) §5.1).
- **`latex.ts`** — `CATALOG_LATEX`/`RESOURCE_TRIGGER`/`LatexEntry`.
- **`spelling.ts`** — `pascal`.

## Commands

```sh
vp check
vp test
vp pack   # build dist (also: vp pack --watch)
```

## Next

[Namespaces](https://github.com/enumeratio/enumeratio/wiki/Namespaces) has the full argument for lazy resolution, the rung
model, and which names should become heads at all; [Symbols](https://github.com/enumeratio/enumeratio/wiki/Symbols) is the
companion piece on what to do once a name is already Wolfram's, enforced by
[`census`](../census/README.md).
