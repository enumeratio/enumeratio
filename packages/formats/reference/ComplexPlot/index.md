---
name: ComplexPlot
domain: Graphics
signature: ComplexPlot(...)
summary: Wolfram's own ComplexPlot, held inert -- the expression is what a worksheet or REPL draws, not something this library computes (see @enumeratio/formats/src/graphics.ts).
names:
  wolframIdentity: true
signatures:
  - call: ComplexPlot(...)
    description: Wolfram's own ComplexPlot, held inert -- the expression is what a worksheet or REPL draws, not something this library computes (see @enumeratio/formats/src/graphics.ts).
    library: enumeratio-formats
    type: (any*) -> any
---

Lowers to a `GraphicsBox` holding a `RasterBox` with `Producer -> ComplexPlot`: color is the argument on a gradient (`phase`, the hue wheel, unless `ColorFunction` says otherwise), brightness a compressed log-magnitude, poles white and zeros black. `Extent` is the window's height, `Center` its middle, `Mask` a radius outside which the plane is dimmed.

On the web a WebGPU shader fills the raster, one invocation per pixel, so a drag or a `Manipulate` slider redraws at frame rate. Everywhere else (Node, a build) the cells are evaluated on the CPU by the same coloring.
