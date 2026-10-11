---
name: Graphics3DBox
domain: Boxes
signature: Graphics3DBox(box, options)
summary: "A drawing in space: 3-D primitives in a frame's coordinates, looked at from a `ViewPoint`."
signatures:
  - call: Graphics3DBox(box, options)
    description: "A drawing in space: 3-D primitives in a frame's coordinates, looked at from a `ViewPoint`."
    library: enumeratio-boxes
    type: (boxes | list, expression*) -> boxes
seeAlso:
  - GraphicsBox
  - GraphicsComplex3DBox
  - Polygon3DBox
  - Line3DBox
  - Point3DBox
  - CuboidBox
names:
  wolframIdentity: true
---

- `Plot3D`, `ListPlot3D`, `BarChart3D` and a curve in space (`Graphics3D(Line(points))`) lower to it, and every environment draws the same primitives.
- `ViewPoint` is where the viewer stands, `{x, y, z}` from the center of the box; `Axes`, `PlotRange`, `ScalingFunctions`, `PlotLabel` and `BoxRatios` are Wolfram's options. An orthographic view: only the direction of `ViewPoint` counts.
- Colors are resolved into the primitives (`FaceColors`, `VertexColors`), so a drawer needs no gradient table.
- Prints as `-Graphics3D-` in text, as Wolfram does.
- Wolfram holds the primitives in a list; a built box here holds them in a `RowBox` (or a single complex), so the example states the empty form as inert data.
