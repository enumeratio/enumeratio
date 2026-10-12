---
name: ContourPlot
domain: Graphics
signature: ContourPlot(...)
summary: Wolfram's own ContourPlot, held inert -- the expression is what a worksheet or REPL draws, not something this library computes (see @enumeratio/formats/src/graphics.ts).
names:
  wolframIdentity: true
signatures:
  - call: ContourPlot(...)
    description: Wolfram's own ContourPlot, held inert -- the expression is what a worksheet or REPL draws, not something this library computes (see @enumeratio/formats/src/graphics.ts).
    library: enumeratio-formats
    type: (any*) -> any
---

Draws as a `GraphicsBox` of data coordinates: a `LineBox` per level, colored along the gradient (`ColorFunction`, `Reverse`), or with `Filled -> True` one `RasterBox` of the bands between them. `Levels` is a count or a list of values; `N` is the samples per side.

`XLabel` and `YLabel` caption the frame, `PlotLabel` (`Label`) the figure.
