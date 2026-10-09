---
name: TogglerBox
domain: Boxes
signature: TogglerBox(binding, domain, options)
summary: "A button that cycles through its entries: `Toggler` lowers to it."
signatures:
  - call: TogglerBox(binding, domain, options)
    description: "A button that cycles through its entries: `Toggler` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - CheckboxBox
  - SetterBox
names:
  wolframIdentity: true
---

- The domain is the list of entries; a press moves to the next.
- Its intent is a toggle.
