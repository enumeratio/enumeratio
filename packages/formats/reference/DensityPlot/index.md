---
name: DensityPlot
domain: Graphics
signature: DensityPlot(...)
summary: Wolfram's own DensityPlot, held inert -- the expression is what a worksheet or REPL draws, not something this library computes (see @enumeratio/formats/src/graphics.ts).
names:
  wolframIdentity: true
signatures:
  - call: DensityPlot(...)
    description: Wolfram's own DensityPlot, held inert -- the expression is what a worksheet or REPL draws, not something this library computes (see @enumeratio/formats/src/graphics.ts).
    library: enumeratio-formats
    type: (any*) -> any
---

Draws as a `GraphicsBox` holding a `RasterBox`: one cell per sample, colored along the gradient by value (`ColorFunction`, `Reverse`). `PlotLegends -> True` adds a color bar, and `PlotRange -> (zmin, zmax)` pins the scale so several plots compare on one. `N` is the samples per side.
