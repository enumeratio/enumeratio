---
name: LineBox
domain: Boxes
signature: LineBox(options)
summary: "A polyline: `Points`, and `Breaks`, the indices where the pen lifts."
signatures:
  - call: LineBox(options)
    description: "A polyline: `Points`, and `Breaks`, the indices where the pen lifts."
    library: enumeratio-boxes
    type: (expression*) -> boxes
seeAlso:
  - PolygonBox
  - DiskBox
names:
  wolframIdentity: true
---

- The segment ending at a break is not drawn.
