---
name: IntervalSliderBox
domain: Boxes
signature: IntervalSliderBox(binding, domain, options)
summary: "A track with two thumbs that bound an interval: `IntervalSlider` lowers to it."
signatures:
  - call: IntervalSliderBox(binding, domain, options)
    description: "A track with two thumbs that bound an interval: `IntervalSlider` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - SliderBox
  - Slider2DBox
  - DynamicBox
bindings:
  - origin: mapped
    form: wolfram
    counterpart: false
    note: Wolfram draws IntervalSlider as an InterpretationBox wrapping a DynamicBox, with no box head of its own; this box is ours.
    checked:
      version: 15.0.0
      on: 2026-10-10
---

- Wolfram draws an `IntervalSlider` as an `InterpretationBox` wrapping a `DynamicBox`, with no box head of its own; this box is ours, with the shape of `SliderBox`. The binding holds the interval, `(r, (1, 3))`; the domain is `(min, max)`.
- Its intent is an interval: a host without sliders draws a track with a marker at each end.
