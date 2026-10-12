---
name: Graphics3D
domain: Graphics
signature: Graphics3D(primitives..., options...)
summary: Wolfram's own Graphics3D, held inert -- the expression is what a worksheet or REPL draws, not something this library computes (see @enumeratio/formats/src/graphics.ts).
names:
  wolframIdentity: true
signatures:
  - call: Graphics3D(primitives..., options...)
    description: Wolfram's own Graphics3D, held inert -- the expression is what a worksheet or REPL draws, not something this library computes (see @enumeratio/formats/src/graphics.ts).
    library: enumeratio-formats
    type: (any*) -> any
seeAlso:
  - Line
  - Plot3D
---

`Graphics3D(Line(KnotCurve(TorusKnot(2, 3))), Closed -> True)` draws a curve in space: the nearer strand
passes in front of the farther, and color runs along the parameter (`ColorFunction -> "Viridis"`
changes the gradient). `Torus -> (2, 1)` draws the tube the curve lies on, faintly behind it, and
`Clock -> True` sends a marker along the curve with the page's clock.

Only a `Line` of points is drawn so far. `Azimuth`, `Elevation` and `Zoom` are ours, where Wolfram has
`ViewPoint`; `Closed` is ours too, as a knot is a loop and Wolfram repeats the first point.
