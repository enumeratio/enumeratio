---
name: ComplexPlot3D
domain: Graphics
signature: ComplexPlot3D(...)
summary: Wolfram's own ComplexPlot3D, held inert -- the expression is what a worksheet or REPL draws, not something this library computes (see @enumeratio/formats/src/graphics.ts).
names:
  wolframIdentity: true
signatures:
  - call: ComplexPlot3D(...)
    description: Wolfram's own ComplexPlot3D, held inert -- the expression is what a worksheet or REPL draws, not something this library computes (see @enumeratio/formats/src/graphics.ts).
    library: enumeratio-formats
    type: (any*) -> any
---

Lowers to a `Graphics3DBox` with `Producer -> ComplexPlot3D`: |f| as heights over the window, each face colored by the argument of f. On the web the grid is evaluated on the GPU; elsewhere, on the CPU. A pole rises to `MaxHeight` rather than tearing a hole.
