---
name: DiskBox
domain: Boxes
signature: DiskBox(options)
summary: "A disk, or a sector of one: `Radius`, a `Center` unless its address gives one, and `Angles` for a sector."
signatures:
  - call: DiskBox(options)
    description: "A disk, or a sector of one: `Radius`, a `Center` unless its address gives one, and `Angles` for a sector."
    library: enumeratio-boxes
    type: (expression*) -> boxes
seeAlso:
  - PolygonBox
  - LineBox
names:
  wolframIdentity: true
---

- A Wolfram `Disk` primitive in a drawing. `Angles` is `{θ1, θ2}` in radians, counterclockwise from the
  positive x axis, as `Disk[c, r, {θ1, θ2}]`; a wedge of a pie chart.
