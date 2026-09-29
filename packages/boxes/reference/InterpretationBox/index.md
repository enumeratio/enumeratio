---
name: InterpretationBox
domain: Boxes
signature: InterpretationBox(box, expr)
summary: Boxes that display one way and stand for exactly the expression they carry.
signatures:
  - call: InterpretationBox(box, expr)
    description: Boxes that display one way and stand for exactly the expression they carry.
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
attributes:
  - HoldAll
seeAlso:
  - TagBox
  - ToBoxes
names:
  wolframIdentity: true
---

- The expression is held, as Wolfram holds it.
- MathML's `semantics`, with the expression's MathJSON as the annotation (`application/mathjson+json`).
