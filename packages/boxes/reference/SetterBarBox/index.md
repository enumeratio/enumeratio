---
name: SetterBarBox
domain: Boxes
signature: SetterBarBox(binding, domain, options)
summary: "A bar of buttons, one pressed: `SetterBar` lowers to it."
signatures:
  - call: SetterBarBox(binding, domain, options)
    description: "A bar of buttons, one pressed: `SetterBar` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - SetterBox
  - RadioButtonBarBox
  - TogglerBarBox
---

- Wolfram lowers a `SetterBar` to a `GridBox` row of `SetterBox`es, one per entry, each setting the variable to its own value. One binding with the list of entries is what a reader of the controls needs (one control, one variable), so the bar is a box of its own over the same binding; `SetterBox` is a bar of one.
- The domain is the list of entries, as for a `PopupMenuBox`. Its intent is a choice.
