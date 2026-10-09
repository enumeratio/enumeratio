---
name: RadioButtonBarBox
domain: Boxes
signature: RadioButtonBarBox(binding, domain, options)
summary: "A bar of radio buttons, one on: `RadioButtonBar` lowers to it."
signatures:
  - call: RadioButtonBarBox(binding, domain, options)
    description: "A bar of radio buttons, one on: `RadioButtonBar` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - SetterBarBox
  - TogglerBarBox
---

- Wolfram lowers a `RadioButtonBar` to a row of `GridBox`es holding a `RadioButtonBox` and its label each. One binding with the list of entries is what a reader of the controls needs, so the bar is a box of its own, as for `SetterBarBox`.
- The domain is the list of entries. Its intent is a choice.
