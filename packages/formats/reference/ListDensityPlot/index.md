---
name: ListDensityPlot
domain: Graphics
signature: ListDensityPlot(...)
summary: Wolfram's own ListDensityPlot, held inert -- the expression is what a worksheet or REPL draws, not something this library computes (see @enumeratio/formats/src/graphics.ts).
names:
  wolframIdentity: true
signatures:
  - call: ListDensityPlot(...)
    description: Wolfram's own ListDensityPlot, held inert -- the expression is what a worksheet or REPL draws, not something this library computes (see @enumeratio/formats/src/graphics.ts).
    library: enumeratio-formats
    type: (any*) -> any
---

A grid of values as cells, lowered whole: row 0 is the least y, at the bottom of the frame. Options as `DensityPlot`'s.
