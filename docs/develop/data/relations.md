---
sidebar: false
aside: false
---

# Relations

<script setup>
import { data } from './relations.data.ts'
</script>

Every cross-reference enumeratio carries, in one table — the full `base_reference` registry, not a bespoke slice
of it. Pick which rows and columns matter to you; the choice lives in the URL, so the resulting view is a link
you can share or bookmark.

<ClientOnly>
  <AssociationTable :systems="data.systems" :kinds="data.kinds" :rows="data.rows" />
</ClientOnly>

## Reading a row

Each row is a **subject** — a collection, a stat, or a map — and each column is an external **system** it's been
checked against. A cell shows the identity in that system (linked out when a URL is known) plus two markers when
they apply:

- **Δ** — a documented delta: not a bug, a noted difference in convention (indexing, parameter order, canonical
  order) between enumeratio's version and that system's. Hover it for the note.
- a **relation** tag — shown whenever the mapping isn't a straight isomorphism. `partial` means the identity is a
  predicate/filter on a bigger external class, not the class itself (e.g. `non_crossing_partitions` filters
  sage's `SetPartitions(n)` by `.is_noncrossing()` rather than naming a dedicated sage class). `aggregate` means
  only the *count* matches — `fubini_numbers` → sage's `OrderedSetPartitions(n)` is this shape: the cardinalities
  agree (`a(n) = OrderedSetPartitions(n).cardinality()`), but it isn't the same combinatorial object, unlike the
  genuine order-isomorphism `set_compositions` → `OrderedSetPartitions(n)` sitting right next to it. `conceptual`
  marks a soft grounding association (every `wikipedia` row) rather than a structural claim.

## Deep-linking in

The Rows and Columns pickers, and any drag-reorder, write straight into the URL's querystring
(`?systems=...&kinds=...`, both comma-separated) — reload the page and the view is exactly as you left it. A few
examples:

- [`?systems=findstat&kinds=map`](/develop/data/relations?systems=findstat&kinds=map) — just the FindStat column,
  maps only. The shape FindStat's own site would want linking in.
- [`?systems=oeis&kinds=collection`](/develop/data/relations?systems=oeis&kinds=collection) — every collection
  with a known OEIS A-number.
- [`?systems=sage,mathlib4`](/develop/data/relations?systems=sage,mathlib4) — Sage next to mathlib4, everything else
  hidden.

## What's not here yet

Aggregate stats (like `fubini_numbers`) show up as rows once they carry a `base_reference` entry, but there's no
link yet from an aggregate stat to the underlying math function it's built from — that needs
[a real functions reference page](/develop/data/functions) to point at, which is still a stub.
Representations and glyphs aren't rows here yet either; both are natural future subject kinds for this same table.
