---
name: RowSource
domain: Boxes
signature: RowSource(collection, options)
summary: "The rows of an ordered collection, by range: a count that is exact, a growing lower bound or infinite, and each row as boxes."
signatures:
  - call: RowSource(collection, options)
    description: "The rows of an ordered collection, by range: a count that is exact, a growing lower bound or infinite, and each row as boxes."
    library: enumeratio-boxes
    type: (any, expression*) -> expression
attributes:
  - HoldAll
seeAlso:
  - TableViewBox
---

- Held: it is the handle a `TableViewBox` carries, and the kernel it is registered with answers `rows(range)`. Rows are numbered by the index `At(collection, #)` reproduces, as bigints, so `SymmetricGroup(25)` reaches its last row.
- `Columns` are expressions over the row `_` (a bare head `Descents` means `Descents(_)`), `Filter` a predicate over it, `SortBy` a column. A filter makes the count a lower bound until the scan covers the source; sorting an infinite source declines.
- A collection with no stable order (a finite `Set`) declines; random access uses the collection's `At` when it has one, and otherwise a prefix walk.
