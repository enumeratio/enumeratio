---
order: 13
title: The collection explorer
---

# The collection explorer

Every collection head (`Derangements`, `SymmetricGroup`, `Subsets`, …) gets a table on its
symbol page, drawn by [`<notatio-collection-table>`](/reference/component/CollectionTable)
and derived from the head's record. A hand-written `enumerate:` in the record wins field by
field; whatever it leaves out is derived.

## What is derived

- **The call**: the head at a small size, from its `grades` and `maxSize`. A head with no
  `maxSize` stops at size 6.
- **A glyph** for the carrier's elements, from the carrier record's `glyph:`.
- **Columns**: statistics defined on the carrier that answer on the first row, most-used
  first. A statistic that is constant over the default collection is left out.

A head that is catalog-only, untyped, or not opening as a collection gets no table.

## Pickers

The table has a statistics menu (add or remove columns, with a text filter for a carrier
with hundreds of statistics) and a size stepper bounded as the derivation is. An explicit
`expr` with no size or template stays fixed.

In a notebook the same choices are options:

- `Columns -> Automatic`: the derived columns. The element needs its `statistics` property
  set, since the runtime loads no records.
- `Glyph -> Automatic`: the carrier's glyph.
- `Size -> n`: the size of the collection.

## Distributions

Each statistic column has a distribution button. It opens a pane drawing how often each value
occurs over the whole collection, as a bar chart with its generating polynomial.
`Distribution -> True` opens it from the start.

<Story
  title="Descents and inversions over the permutations of five">
<notatio-out format="epsil" value='CollectionTable(SymmetricGroup(5), Columns -> "Descents, Inversions", Glyph -> "permutation", Distribution -> True)' />
</Story>

The tally is computed in the browser on demand, by the page's kernel or engine; nothing is
precomputed. A collection past `size-max`, with too many elements to walk, or of unknown size
declines with the reason instead of freezing. A column that is an expression rather than a
statistic head has no distribution.

## On a statistic's page

A statistic's own page shows its distribution over its carrier's collection as a triangle:
the coefficients row by row, the generating polynomial and a bar chart of the last row. The
"same distribution as" button scans the other statistics on the carrier for equidistribution,
row by row, within a time budget, and lists the matches. The collection is derived from the
carrier's records as the table's is.

## Try it

The same size bounds govern the [Try it panel](/docs/frontend/try-it): where no example of a
collection head lifts to a control, Try it falls back to the explorer's sized call.
