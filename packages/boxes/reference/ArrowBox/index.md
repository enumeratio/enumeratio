---
name: ArrowBox
domain: Boxes
signature: ArrowBox(options)
summary: "A polyline with an arrowhead at its end: `Points`."
signatures:
  - call: ArrowBox(options)
    description: "A polyline with an arrowhead at its end: `Points`."
    library: enumeratio-boxes
    type: (expression*) -> boxes
seeAlso:
  - LineBox
  - DiskBox
names:
  wolframIdentity: true
---

- A Wolfram `Arrow` primitive in a drawing; the head sits on the last point.
- `Arrowheads` is the head's length in pixels (8 when absent); a vector field's short arrows take a smaller one.
