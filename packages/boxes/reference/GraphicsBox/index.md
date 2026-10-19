---
name: GraphicsBox
domain: Boxes
signature: GraphicsBox(primitives, options)
summary: "A drawing: primitives in a frame's coordinates, with `ColorRules`, `ColorMixing`, `BoundaryStyle`, `Selection` and `ViewKind` as options."
signatures:
  - call: GraphicsBox(primitives, options)
    description: "A drawing: primitives in a frame's coordinates, with `ColorRules`, `ColorMixing`, `BoundaryStyle`, `Selection` and `ViewKind` as options."
    library: enumeratio-boxes
    type: (boxes | list, expression*) -> boxes
seeAlso:
  - GraphicsComplexBox
  - StyleBox
names:
  wolframIdentity: true
---

- The one box every environment draws a figure from: a canvas, a terminal and a native view read the same primitives, tagged by address. `Show` lowers to it.
- Rules stay data; each drawer resolves them per mark.
- Prints as `-Graphics-` in text, as Wolfram does.
- Holds its primitives in a list, as Wolfram does: `GraphicsBox[{}]` when empty. A figure or plot that remembers the expression it came from is wrapped whole in an `InterpretationBox`.
