---
name: SliderBox
domain: Boxes
signature: SliderBox(binding, domain, options)
summary: "A track with a thumb that moves a number: `Slider` lowers to it."
signatures:
  - call: SliderBox(binding, domain, options)
    description: "A track with a thumb that moves a number: `Slider` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - Slider2DBox
  - AnimatorBox
  - DynamicBox
names:
  wolframIdentity: true
---

- The binding is a `DynamicBox` over the variable, or over `(x, start)`; the domain is `(min, max)` or `(min, max, step)`, `Automatic` when there is none.
- `Appearance -> "Vertical"` stands it up (`VerticalSlider`). `Readout`, `Play` and the other options ride as written.
- Its intent is continuous: a host without sliders draws a track with a marker and the value.
