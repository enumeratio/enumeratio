---
name: AnimatorBox
domain: Boxes
signature: AnimatorBox(binding, domain, options)
summary: "A slider that plays: `Animator` lowers to it."
signatures:
  - call: AnimatorBox(binding, domain, options)
    description: "A slider that plays: `Animator` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - SliderBox
  - DynamicBox
names:
  wolframIdentity: true
---

- The domain is the range it sweeps; the play button and the readout are on by default.
- Its intent is playback: the value moves by itself.
