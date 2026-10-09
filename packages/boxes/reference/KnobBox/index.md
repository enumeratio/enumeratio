---
name: KnobBox
domain: Boxes
signature: KnobBox(binding, domain, options)
summary: "A number you drag in place, with a ladder of step sizes: `Knob` lowers to it."
signatures:
  - call: KnobBox(binding, domain, options)
    description: "A number you drag in place, with a ladder of step sizes: `Knob` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - SliderBox
  - StepperBox
  - DynamicBox
---

- Wolfram has no knob; this box is ours, with the same shape as `SliderBox`: the binding, then `(min, max)` or `(min, max, step)`.
- Its intent is continuous: a host without the web's widgets draws a track with a marker and the value.
