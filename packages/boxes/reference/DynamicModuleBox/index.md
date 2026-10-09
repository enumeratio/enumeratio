---
name: DynamicModuleBox
domain: Boxes
signature: DynamicModuleBox(box, options)
summary: "A scope: the controls and readouts inside bind the same variables. `DynamicModule` lowers to it."
signatures:
  - call: DynamicModuleBox(box, options)
    description: "A scope: the controls and readouts inside bind the same variables. `DynamicModule` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression*) -> boxes
seeAlso:
  - DynamicBox
  - SliderBox
names:
  wolframIdentity: true
---

- `TrackedSymbols` makes the scope reactive; `Evaluator -> "Worker"` evaluates in a worker.
- A page with controls and readouts and no module around them is in one: the page's.
