---
name: GridBox
domain: Boxes
signature: GridBox([[box11, box12, …], …])
summary: "A two-dimensional array of boxes: a matrix's body, a piecewise definition's cases."
signatures:
  - call: GridBox([[box11, box12, …], …])
    description: "A two-dimensional array of boxes: a matrix's body, a piecewise definition's cases."
    library: enumeratio-boxes
    type: (list<list<boxes>>, expression*) -> boxes
seeAlso:
  - RowBox
  - FractionBox
names:
  wolframIdentity: true
---

- Rows are lists of boxes, as in Wolfram's `GridBox[{{…}, …}]`.
- MathML's `mtable`.
- Layout reads `ColumnAlignments`, `ColumnSpacings`, `RowSpacings`, `GridBoxFrame` and `GridBoxDividers`; a cell that is `SpanFromLeft` (or `SpanFromAbove`) continues the cell beside (above) it.
- `Column`, `Grid` and `Labeled` lower to a `GridBox` in a `TagBox` that names the head.
