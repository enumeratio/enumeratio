---
name: MakeBoxes
domain: Boxes
signature: MakeBoxes(expr)
summary: The boxes of an expression's traditional notation, without evaluating it.
signatures:
  - call: MakeBoxes(expr)
    description: The boxes of an expression's traditional notation, without evaluating it.
    library: enumeratio-boxes
    type: (any) -> boxes
attributes:
  - HoldAll
seeAlso:
  - ToBoxes
  - DisplayForm
names:
  wolframIdentity: true
---

- Holds its argument, so the notation is of what was written.
