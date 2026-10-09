---
name: StepperBox
domain: Boxes
signature: StepperBox(binding, domain, options)
summary: An integer in a sentence, stepped in place with arrows.
signatures:
  - call: StepperBox(binding, domain, options)
    description: An integer in a sentence, stepped in place with arrows.
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - KnobBox
  - SliderBox
  - DynamicBox
---

- Wolfram has no stepper; this box is ours, with the same shape as `SliderBox`: the binding, then `(min, max)`. No head lowers to it; a `StringTemplate` hole for an integer variable is one.
- Its intent is continuous: a host without the web's widgets draws a track with a marker and the value.
