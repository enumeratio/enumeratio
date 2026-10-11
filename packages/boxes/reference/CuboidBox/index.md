---
name: CuboidBox
domain: Boxes
signature: CuboidBox(options)
summary: An axis-aligned box in space, from `Min` to `Max`.
signatures:
  - call: CuboidBox(options)
    description: An axis-aligned box in space, from `Min` to `Max`.
    library: enumeratio-boxes
    type: (expression*) -> boxes
seeAlso:
  - Graphics3DBox
  - Polygon3DBox
names:
  wolframIdentity: true
---

- A Wolfram `Cuboid` primitive in a `Graphics3D`; a bar of `BarChart3D` is one, standing on the floor of the chart.
- Only the faces turned to the viewer are drawn: the top and the two sides toward the viewer, the sides shaded darker.
