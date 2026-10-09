---
name: SetterBox
domain: Boxes
signature: SetterBox(binding, domain, options)
summary: "A bar of buttons, one pressed: `SetterBar` lowers to it."
signatures:
  - call: SetterBox(binding, domain, options)
    description: "A bar of buttons, one pressed: `SetterBar` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - PopupMenuBox
  - TogglerBox
names:
  wolframIdentity: true
---

- The domain is the list of entries, as for a `PopupMenuBox`.
- Its intent is a choice.
