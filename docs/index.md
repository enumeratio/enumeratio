---
layout: home
hero:
  name: enumeratio
  text: math as data, data as math
  tagline: A home for combinatorial structures — exact counting, rank/unrank, statistics, and maps, explorable live in the browser and built to be understood and used by people and LLMs alike.
  image:
    light: /logo-light.svg
    dark: /logo-dark.svg
    alt: enumeratio lattice mark
  actions:
    - theme: brand
      text: Explore →
      link: /explore/collection/
    - theme: alt
      text: Learn
      link: /learn/
    - theme: alt
      text: Develop
      link: /develop/
features:
  - title: The catalog is the database
    details: A collection is catalog rows + a carrier type + a floor engine; a generator realizes the whole handle / element / notation / membership layer from that.
  - title: Live in the browser
    details: The whole pure-SQL core (zero C) runs in-browser via PGlite — the components and the explorer query it directly.
  - title: One identity, many roles
    details: A combinatorial number is written once and referenced by every role that is it — cardinalities, aggregates, and the maps that let one family borrow another's ranking.
---

## The name

*Latin* **ēnumerātiō** (f.), from **ēnumerāre** "to count out, reckon up" (**ē-/ex-** "out" + **numerāre** "to
count," from **numerus** "number"). In classical rhetoric, the *enumeratio* is the closing recapitulation that
lists the points made.

The name holds both halves of the project's lineage. **Numeration** — writing a number positionally — and
**enumeration** — counting and listing the structures that organize those writings — share the root *numerus*.
enumeratio began as a study of number systems and grew into a general, database-driven library of the
combinatorial structures enumeration is about — permutations, set partitions, compositions, subsets, Dyck paths,
integer partitions, … — **math as data, data as math**.

## The model — the catalog *is* the database

A **collection** is a row in the catalog (`base_collection` + its grade axes, orders, and examples) plus a carrier
type and a handful of engine functions. A generator (`base_realize`) turns each collection row into the generic
layer, so adding a collection is rows + its engine, never per-collection glue.

- **handle addressing** — `permutations(5)` is a subscriptable handle. Grades bind at construction
  (`set_partitions(5, blocks => 2)`) and grading is multi-axis; a subscript addresses the element by rank or by a
  named order. `cardinality(handle)` is ∞-aware.
- **membership is data** — `x <@ collection` / `collection @> x` dispatch to a generated `contains(handle, x)`; a
  collection's `is_*` predicate folds in as its `membership_predicate`, and grade axes are checked for free.
- **stat** = a per-element invariant; **map** = a function to another collection; **restrictions** name a slice as
  its own collection.
- **representations are data** — notation *and* figures: `render()` casts to a chosen medium, and
  `glyph_svg(<carrier>)` emits an element's SVG straight from the db.
- **examples are data** — the example suite runs every catalog example; they double as regression tests and
  documentation, and `COMMENT ON` makes the DB self-describing.

## One identity, many roles

What most combinatorics libraries miss is the *connections*. A combinatorial number is written once — as a `math_*`
identity (`math_factorial`, `math_binomial`, `math_stirling2`, …) — and every role that **is** that number
references it instead of re-deriving it: the **cardinality** of a collection (one Catalan identity is the count of
Dyck paths, binary trees, ordered trees, 231-avoiding permutations, and non-crossing partitions alike); an
**aggregate**'s closed form (the Stirling-2 row that the grade counts of `set_partitions(5)` sum to Bell(5)); and
— the deep one — the **order-isomorphic maps** between equinumerous families, which let one *borrow* another's
ranking (`binary_trees` ranks through the Dyck-path bijection, never writing its own).

## Getting around

- **[Explore](/explore/)** — the full collection map, generated fresh from the registry, plus the
  [collection explorer](/explore/collection/) for browsing element-by-element.
- **[Learn](/learn/)** — a guided tour through the kinds of collections, live in the browser, no background
  assumed, plus the [deeper essays](/learn/explorations/polytopes) for readers who already have the vocabulary.
- **[Develop](/develop/)** — the vision, [packages](/develop/packages/data/) (data, client, cli, components), API
  reference, entity data, sources, how to contribute, and the architecture wiki.
