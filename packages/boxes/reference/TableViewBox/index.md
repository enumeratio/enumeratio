---
name: TableViewBox
domain: Boxes
signature: TableViewBox(source, options)
summary: "A scrolling grid over a row source: it asks for the rows in view, so a massive or infinite collection draws without ever being held."
signatures:
  - call: TableViewBox(source, options)
    description: "A scrolling grid over a row source: it asks for the rows in view, so a massive or infinite collection draws without ever being held."
    library: enumeratio-boxes
    type: (expression, expression*) -> boxes
attributes:
  - HoldAll
seeAlso:
  - RowSource
  - GridBox
  - PaneBox
bindings:
  - origin: mapped
    form: wolfram
    counterpart: false
    note: Wolfram has no TableViewBox (its TableView is a front-end construct with no box head); this box is ours.
    checked:
      version: 15.0.0
      on: 2026-10-10
---

- `CollectionTable` and `TableView` lower to it. The source is held: the page registers it with the kernel and asks for rows by range, so only the expression travels.
- `ImageSize` fixes the viewport (a fixed height by default), so the page never reflows as rows load. `Scrollbars` scrolls (the default); `Pagination -> True` gives pages. `ScrollPosition` and `MaxItems` pin a first page, which is all a static environment draws: those rows, then a `Skeleton` row for the rest.
- `TableViewBoxHeaders` are the column headings, known before any row is.
