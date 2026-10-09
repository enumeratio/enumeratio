---
name: PopupMenuBox
domain: Boxes
signature: PopupMenuBox(binding, domain, options)
summary: "A menu of entries, one chosen: `PopupMenu` lowers to it."
signatures:
  - call: PopupMenuBox(binding, domain, options)
    description: "A menu of entries, one chosen: `PopupMenu` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - SetterBox
  - TogglerBox
names:
  wolframIdentity: true
---

- The domain is the list of entries; `Labeled(value, label)` shows one thing and binds another.
- Its intent is a choice.
