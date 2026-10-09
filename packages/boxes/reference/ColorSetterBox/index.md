---
name: ColorSetterBox
domain: Boxes
signature: ColorSetterBox(binding, domain, options)
summary: "A swatch or a spectrum to pick a color from: `ColorSlider` lowers to it."
signatures:
  - call: ColorSetterBox(binding, domain, options)
    description: "A swatch or a spectrum to pick a color from: `ColorSlider` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - SliderBox
  - DynamicBox
names:
  wolframIdentity: true
---

- The domain is the swatch's look, `"SwatchSpectrum"` for a `ColorSlider`.
- Its intent is a color: a host without a picker draws the value.
