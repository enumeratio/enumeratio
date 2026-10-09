---
name: SetterBox
domain: Boxes
signature: SetterBox(binding, domain, options)
summary: One button, pressed when the variable holds its entry; a bar of them is a `SetterBarBox`.
signatures:
  - call: SetterBox(binding, domain, options)
    description: One button, pressed when the variable holds its entry; a bar of them is a `SetterBarBox`.
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - SetterBarBox
  - PopupMenuBox
  - TogglerBox
names:
  wolframIdentity: true
---

- Wolfram's `SetterBar` is a `GridBox` row of these, one per entry. The domain is the one entry, as `[a]`.
- Its intent is a choice.
