---
name: CheckboxBox
domain: Boxes
signature: CheckboxBox(binding, domain, options)
summary: "A box that is ticked or not: `Checkbox` lowers to it."
signatures:
  - call: CheckboxBox(binding, domain, options)
    description: "A box that is ticked or not: `Checkbox` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - TogglerBox
  - SliderBox
names:
  wolframIdentity: true
---

- The binding holds `True` or `False`; the domain is `Automatic`.
- Its intent is a toggle.
