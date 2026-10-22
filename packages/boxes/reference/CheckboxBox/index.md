---
name: CheckboxBox
domain: Boxes
signature: CheckboxBox(binding, domain?, options)
summary: "A box that is ticked or not: `Checkbox` lowers to it."
signatures:
  - call: CheckboxBox(binding, domain?, options)
    description: "A box that is ticked or not: `Checkbox` lowers to it."
    library: enumeratio-boxes
    type: (expression, expression*) -> boxes
seeAlso:
  - TogglerBox
  - SliderBox
names:
  wolframIdentity: true
---

- The binding holds `True` or `False`.
- Its intent is a toggle.
- The domain is optional, as in Wolfram: `CheckboxBox(Dynamic(b))` has none, `CheckboxBox(Dynamic(b), (0, 1))` names the two values.
