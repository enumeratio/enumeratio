---
name: TogglerBarBox
domain: Boxes
signature: TogglerBarBox(binding, domain, options)
summary: "A bar of buttons, any number pressed: `TogglerBar` lowers to it."
signatures:
  - call: TogglerBarBox(binding, domain, options)
    description: "A bar of buttons, any number pressed: `TogglerBar` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - SetterBarBox
  - TogglerBox
  - CheckboxBox
---

- Wolfram lowers a `TogglerBar` to a `GridBox` row of `SetterBox`es, each over `MemberQ[x, entry]`. One binding holding the list of the pressed entries is what a reader of the controls needs, so the bar is a box of its own.
- The domain is the list of entries; the binding holds the pressed ones, in bar order. Its intent is a choice, several at once.
