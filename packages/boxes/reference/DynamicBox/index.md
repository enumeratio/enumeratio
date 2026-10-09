---
name: DynamicBox
domain: Boxes
signature: DynamicBox(expression, options)
summary: "An expression the environment re-evaluates when the variables it reads move: what `Dynamic` lowers to."
signatures:
  - call: DynamicBox(expression, options)
    description: "An expression the environment re-evaluates when the variables it reads move: what `Dynamic` lowers to."
    library: enumeratio-boxes
    type: (expression, expression*) -> boxes
attributes:
  - HoldAll
seeAlso:
  - DynamicModuleBox
  - SliderBox
names:
  wolframIdentity: true
---

- The expression is held. Inside a control box it is the binding: the variable, or `(x, start)`.
- It is its own element: a readout re-draws without its parent.
