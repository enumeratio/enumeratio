---
name: TogglerBox
domain: Boxes
signature: TogglerBox(binding, domain, shown, options)
summary: "A button that cycles through its entries: `Toggler` lowers to it."
signatures:
  - call: TogglerBox(binding, domain, shown, options)
    description: "A button that cycles through its entries: `Toggler` lowers to it."
    library: enumeratio-boxes
    type: (expression, expression, boxes, expression*) -> boxes
seeAlso:
  - CheckboxBox
  - SetterBox
names:
  wolframIdentity: true
---

- The domain is a rule list of `value -> label`, and the third argument is `DynamicBox(ToBoxes(x, StandardForm))`, the variable's value as it is shown, both as Wolfram boxes a `Toggler`; a press moves to the next. Where Wolfram's absent range is `{True -> True, False -> False}`, ours is `Automatic`.
- Its intent is a toggle.
