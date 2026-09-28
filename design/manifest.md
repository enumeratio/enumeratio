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

### What a type can say

The `type` is compute-engine's type language (Epsil's), and it says a great deal
(probed against 0.134):

- **The numeric tower** is a chain, `integer <: rational <: real <: complex <: number`,
  with ranges: `integer<1..>` rejects `0`, `real<0..1>`. Collections carry element types
  and shapes (`list<integer^(2x3)>`, `tuple<…>`, `record{x: integer}`), a head's own
  applications are `expression<RowBox>`, and `declareType` adds structural aliases and
  nominal types (a minted one is a true newtype, a subtype of nothing).
- **Effects** are part of a signature: `(real) random -> real`, `(string) fs_read ->
string`. The labels are `console`, `entropy`, `environment`, `fs_read`, `fs_write`,
  `network`, `random`, `scope`, `state`, `time`; `pure` is the empty set, and absent means
  pure. So an effect goes in the type, not in a field of its own.
- **Generics** are rank-1, bounded: `(T) -> T where T: indexed_collection`.
- **Overloads** are an intersection of signatures: `((integer) -> integer) & ((string) ->
string)`. compute-engine resolves a call against it the way PostgreSQL resolves an
  overloaded function -- arity, then admissible operand types, then most specific, then
  the narrower effect set -- except that where Postgres calls a tie ambiguous,
  compute-engine takes the first declared. There is no preferred-type table.

Two consequences for records. A type prints back normalised (union members sorted,
aliases expanded, `vector<…>` as `list<…>`), so the drift test compares the engine's
printing of the record's type with the engine's printing of what was declared, not the
record's text. And a record should say as much as the code actually guarantees: a
positive-integer argument is `integer<1..>`, not `integer`, and a random one is `random`.

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
must not overlap: no argument tuple may match two of them. compute-engine has no
whole-signature overlap test (`couldMatch` on two arrows compares arrows), so the check
is per position: arities that can coincide, and every parameter position able to hold a
common value (`couldMatch`). An overlap fails the build, unless the later row says what
it replaces:

```yaml
signatures:
  - call: Fibonacci(n, x)
    library: enumeratio-number-theory
    type: (integer, value) -> value
    overrides: enumeratio-adeles
```

At runtime a head is declared once, its signature the intersection of its overloads, so
typing a call already picks an arm. compute-engine keeps that choice to typing: an
`evaluate` handler is never told which arm won. So dispatch is ours: one handler per head
that sends a call to the most specific overload whose parameter types admit the operands,
with compute-engine's native handler as one overload among them. That replaces the
`wrapOperator` / `widenSignature` chains.

Nothing widens a head in code alone. A test declares every package and requires that
every head a package adds or re-signs has a typed row for that package, so the manifest
is complete by construction. At the start: 1,068 heads added or re-signed by our
packages, 147 of them with no record at all (mostly family members documented on the
family's page, the `Form*` and `Braid*` heads), and 5 touched by more than one package
(`CatalanNumber`, `Fibonacci`, `Inverse`, `LucasL`, `PermutationCycles`). census and
reference declare number-theory and adeles in opposite orders, so `Fibonacci`'s final
signature already depends on which engine asks.

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

## Cost at scale

Measured on an M1 Pro, with the manifest at 1,897 heads and synthetic ones beyond:

| heads  | index, gzip | import | declare every head, no handlers | define every element |
| ------ | ----------- | ------ | ------------------------------- | -------------------- |
| 1,897  | 27 KB       | 5 ms   | ~20 ms                          | ~10 ms               |
| 10,000 | ~140 KB     | 24 ms  | ~80 ms                          | 26 ms                |
| 50,000 | ~700 KB     | 140 ms | ~290 ms, ~1 KB heap each        | 133 ms, 23 MB        |

Knowing about every head is cheap, and stays cheap far past where we are. What does not
scale is doing something per head eagerly, so:

- **Elements are defined on demand**, for the tags a page uses (50 tags: 1 ms; an element
  already in the page upgrades when its class arrives), not for every head at startup.
- **An engine declares on demand too**, through the resolve-before-evaluate loop (20
  heads: 0.35 ms). Declaring everything up front is affordable, but costs time and heap
  for heads a session never touches, and lookup does not slow with declared heads either
  way.
- **The index splits by use**: names and parameter names (what tags and completion need),
  overload types (what type-checking needs), summaries (what docs need), each its own
  chunk. Type strings are interned into a table (the vocabulary of signatures is small),
  and `documented` becomes small codes rather than repeated package names -- together a
  third of today's bytes.

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
2. Types for the rest of the packages, batched by group, lifted mechanically off the
   engine in declaration order (each package's contribution is what its `declare`
   changed), with records for the record-less heads and the completeness test.
3. The overlap check and `overrides`, then dispatch replacing the wrapping chains.
4. Lazy loading through the generalised `prepare`.
5. Component wrappers made from the manifest at runtime; elements defined on demand; the
   index split into chunks.
