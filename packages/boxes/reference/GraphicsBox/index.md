---
name: GraphicsBox
domain: Boxes
signature: GraphicsBox(box, options)
summary: "A drawing: primitives in a frame's coordinates, with `ColorRules`, `ColorMixing`, `BoundaryStyle`, `Selection` and `ViewKind` as options."
signatures:
  - call: GraphicsBox(box, options)
    description: "A drawing: primitives in a frame's coordinates, with `ColorRules`, `ColorMixing`, `BoundaryStyle`, `Selection` and `ViewKind` as options."
    library: enumeratio-boxes
    type: (boxes, expression*) -> boxes
seeAlso:
  - GraphicsComplexBox
  - StyleBox
names:
  wolframIdentity: true
---

- The one box every environment draws a figure from: a canvas, a terminal and a native view read the same primitives, tagged by address. `Show` lowers to it.
- Rules stay data; each drawer resolves them per mark.
- Prints as `-Graphics-` in text, as Wolfram does.
