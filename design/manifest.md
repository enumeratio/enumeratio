# Design: the symbol manifest

Status: **first slice** -- `@enumeratio/manifest` built from the records, replacing notatio's
`heads-data.ts` and the per-package `summaries-data.ts`; typed signatures piloted on
`boxes`. Dispatch across packages and lazy loading are next.

## What it is

Every head we know, and everything about it that can be known without loading its code:
which package declares it, its overloads and their types, its parameter names, its
summary, whether it holds its arguments. One table, assembled at build time from the
records (`<Head>.yaml`, design/speculative/symbol-metadata.md) plus a bare compute-engine
for the engine's own heads.

Three things follow from having it:

- **The interface knows every symbol before any of its code is loaded.** A generic
  element, a component wrapper, a completion list, a type check of a call -- all read the
  manifest, not the declared engine.
- **Code can load lazily.** An engine declares every head from the manifest (types,
  descriptions, attributes, no handlers) and loads a package's handlers when an expression
  first needs them (below).
- **Nothing can go stale.** The manifest is a build artifact, never committed, so there is
  no generated file to forget to regenerate. `heads-data.ts` had drifted by most of the
  catalogue before this replaced it. Vite Task's cache tracks every record the build reads,
  so an edit to any package's YAML rebuilds it.

## The records carry the types

A record's `signatures` rows are its overloads. Each row may now carry the compute-engine
type of that overload, and the record its Wolfram-style attributes:

```yaml
name: InterpretationBox
signatures:
  - call: InterpretationBox(box, expr)
    description: …
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
attributes: [HoldAll]
```

The declaring package reads its heads' types and summaries back from the manifest
(`@enumeratio/manifest/package/<name>`), so a signature is written once, in the record. A
reference test declares every library and checks each typed row against what the engine
ended up with, so the record cannot claim a signature the code does not have.

`HoldAll` is compute-engine's `lazy`. The name is Wolfram's because the rest of the
record's vocabulary is.

## Why build it from records, not from code

Building from code would mean booting every package's `declare` into an engine at build
time. The manifest would then depend on every symbol package, and every symbol package
depends on the manifest (for its own types and summaries): a cycle. Built from the YAML,
the manifest depends only on `@enumeratio/entry` (which reads records) and
compute-engine, and sits at the bottom of the build graph.

The price is that the record is the source and the code must agree with it, which the
drift test enforces. The engine's own heads are the exception: their types come from a
bare engine at build time, since compute-engine is not ours to annotate.

## Overloads across packages

One head may be declared by several packages -- compute-engine's `Fibonacci`, widened by
`adeles`, widened again by `number-theory`. Today that is declaration order: whichever
`widenSignature` runs last wins, and `reference/scripts/engines.ts` carries a comment
saying which must go last. Nothing checks it.

The manifest makes it a checked fact. For each head, overloads from different packages
must not overlap: no argument tuple may match two of them. An overlap fails the build,
unless the later row says what it replaces:

```yaml
signatures:
  - call: Fibonacci(n, x)
    library: enumeratio-number-theory
    type: (integer, value) -> value
    overrides: enumeratio-adeles
```

At runtime a head is declared once, its signature the union of its overloads, and its
handler dispatches to the most specific overload whose parameter types match, with
compute-engine's native handler as one overload among them. That replaces the
`wrapOperator` / `widenSignature` chains. (Next slice; this one records the types.)

## Lazy loading

The loop is design/namespaces.md §5, already built for the catalog (`prepare`): walk an
expression's heads before evaluating it, load what is missing, then evaluate
synchronously. The manifest generalises the registry it consults: a head resolves to the
package whose overload matches, and loading a package is a cached dynamic import of its
handlers. A head synthesised during evaluation whose handler is not loaded stays
unevaluated, and the miss is reported so the host can load and retry; a package declares
the packages its handlers construct heads from (§5.2), and loading it loads them.

## Components

Generic elements are defined from the manifest's names and parameter names. The Vue and
React wrappers stay generated from the element sources at build time (they are already a
build artifact, not committed); a wrapper per manifest head, made at runtime, with the
build emitting only its types, is where they go once the elements themselves are
manifest-driven.

## Delivery

`@enumeratio/manifest` builds from the records into `dist/`: the whole manifest at the
root export (name, package, parameter names, overload types, attributes -- no prose), and
one module per package at `./package/<name>` with that package's summaries and types for
its `declare`. Nothing generated is committed. Editing a record means rebuilding the
package, as editing any package's source does.

## Order

1. This slice: the manifest package; `type` and `attributes` in the record schema;
   notatio's `HEADS`/`PARAMS` and every `summaries-data.ts` read from it; `boxes` typed
   and declared from its records, with the drift test.
2. Types for the rest of the packages, one package per change, each declaring from its
   records.
3. The overlap check and `overrides`, then dispatch replacing the wrapping chains.
4. Lazy loading through the generalised `prepare`.
5. Component wrappers made from the manifest at runtime.
