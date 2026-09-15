# Collection table

A paged table over a combinatorial collection, rendered by `<notatio-collection-table>`.
Every collection head — `Subsets`, `SymmetricGroup`, `IntegerPartitions`, `DyckPaths`, and
the rest of the catalog — is a **lazy indexed family**: `Count` is closed-form and `At`
unranks, so the table draws a page by asking for twenty indices and never touches the
other rows. That is the whole design: `SymmetricGroup(20)` has 2.4 × 10¹⁸ rows and pages
exactly as fast as `Subsets(4)`, and the `#` column is the index that reproduces each row
(`At(expr, #)`).

The controls are live. **Columns** are statistics applied to the row: a head
(`Descents`, `Inversions`, `CycleCount`, …) or any expression over the row `_`
(`Max(_) - Min(_)`). **Filter** is a predicate over `_`, answered the way `Filter` is — by
testing rows — so it has to scan the source; the scan runs in the background, bounded, and
the match count is exact only once it has covered every row. **Sorting** by a column has
to materialise that column, so it is bounded too and the table says which prefix it
ordered. Click a column header to sort; click again to flip; a third time to clear.

## Subsets, with the glyph

<Story
  title="Subsets(4), every subset drawn">
<template #description>
Sixteen rows, in the binary (Gray-free) order the kernel unranks. Sort by
<Symbol>Length</Symbol> to group by size; filter <code>Length(_) == 2</code> for the six
pairs — the count goes exact at once, since sixteen rows scan in a millisecond. The
<Symbol>Sum</Symbol> column is any expression over the row, not just a head.
</template>
<notatio-collection-table expr="Subsets(4)" columns="Length, Sum" glyph="subset" page-size="10" />
</Story>

## Permutations and their statistics

<Story
  title="SymmetricGroup(5), the classical statistics">
<template #description>
The 44 derangements of five, picked out of 120 by the filter, each with its
<Symbol>Descents</Symbol> number, <Symbol>MajorIndex</Symbol>, <Symbol>Inversions</Symbol>
count and <Symbol>Cycles</Symbol> count. Clear the filter to see all 120; sort by
<Symbol>Inversions</Symbol> to see that it and <Symbol>MajorIndex</Symbol> are
equidistributed but not equal; add <Symbol>Peaks</Symbol>, <Symbol>Excedances</Symbol> or
<Symbol>LeftToRightMaxima</Symbol> as further columns.
</template>
<notatio-collection-table expr="SymmetricGroup(5)" columns="Descents, MajorIndex, Inversions, CycleCount, FixedPoints" glyph="permutation" filter="FixedPoints(_) == 0" />
</Story>

<Story
  title="SymmetricGroup(12) — paging without materialising">
<template #description>
479,001,600 permutations. The pager opens on page one million — <code>At</code> unranks the
ten rows there directly. Type a page number, or jump to the last page with <code>»</code>.
Sorting here orders only the first two thousand rows (the bound is adjustable) and says so;
a filter scans twenty thousand rows at a time and offers to continue.
</template>
<notatio-collection-table expr="SymmetricGroup(12)" columns="Descents, Inversions" glyph="permutation" page="1000000" page-size="10" />
</Story>

## Beyond 2⁵³

<Story
  title="SymmetricGroup(20)">
<template #description>
2,432,902,008,176,640,000 rows — past <code>Number.MAX_SAFE_INTEGER</code>, so the count
shows as approximate and the pager stops at the last exactly-indexable page. The kernel
counts and unranks in doubles; indexing past 2⁵³ would silently round, so the table refuses
rather than guess. <code>readonly</code> hides the editors.
</template>
<notatio-collection-table expr="SymmetricGroup(20)" columns="Descents, CycleCount" page-size="10" readonly />
</Story>

## Other carriers

<Story
  title="IntegerPartitions(8) as Ferrers diagrams">
<template #description>
Partitions unrank in reverse-lexicographic order. The partition statistics come from
<code>@enumeratio/statistics</code>, where each is a definition over the part list;
filter <code>IsSelfConjugate(_) == 1</code> for the two self-conjugate partitions of 8, or
<code>Length(_) == 3</code> for the five into three parts.
</template>
<notatio-collection-table expr="IntegerPartitions(8)" columns="Length, LargestPart, DistinctParts, DurfeeSquare, Crank" glyph="partition" page-size="10" />
</Story>

<Story
  title="DyckPaths(4) as step words">
<template #description>
Fourteen paths (Catalan), as up/down words drawn as mountain ranges. <code>Height</code>,
<code>Area</code>, <code>Returns</code> (touches of the axis) and <code>Hills</code> are
Dyck-path statistics; sort by <code>Returns</code> to see the Narayana-like split, or filter
<code>Returns(_) == 1</code> for the five primitive paths.
</template>
<notatio-collection-table expr="DyckPaths(4)" columns="Height, Area, Returns, Hills" glyph="dyck" page-size="14" />
</Story>

<Story
  title="SetPartitions(4), blocks as pills">
<template #description>
Fifteen set partitions (Bell). The element is the block list; the glyph converts it to the
restricted-growth string the <code>set-partition</code> figure draws. <code>Length</code>
counts blocks — sort by it to walk from one block to four — and
<code>Max(Map(Length, _))</code> is the largest block. (The named set-partition statistics,
<code>Blocks</code>, <code>SingletonBlocks</code>, …, are declared over <code>list&lt;integer&gt;</code>
today and reject a ragged block list; they land here once they carry their own carrier type.)
</template>
<notatio-collection-table expr="SetPartitions(4)" columns="Length, Max(Map(Length, _))" glyph="set-partition" page-size="15" />
</Story>

## What the bounds are for

The three operations have three different costs, and the table is honest about each:

- **Paging** is `At` — closed-form unranking, constant per row. Any page of any collection.
- **Filtering** is `Filter` — a scan of the source, linear in how far it has to look. The
  scan runs in time slices so the page stays responsive, stops at `scan-limit` rows (twenty
  thousand by default) and offers to go on. The count reads "_k_ matches in the first _N_
  of _M_" until the scan is complete, then "_k_ of _M_ match".
- **Sorting** by a statistic needs the statistic for every candidate row, which is the one
  thing a lazy collection cannot give you for free. It is bounded by `sort-limit`, and the
  note above the table says when the order covers only a prefix.

The compute-engine's own `Filter` has the same linear cost, plus an iteration cap
(`ce.iterationLimit`, 1024 by default) after which `Count(Filter(…))` stays symbolic and
`At(Filter(…), i)` answers `Missing` — so the table drives the scan itself, by index, which
is also what lets it resume where it stopped.
