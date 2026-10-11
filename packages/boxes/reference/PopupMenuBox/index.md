---
name: PopupMenuBox
domain: Boxes
signature: PopupMenuBox(binding, domain, options)
summary: "A menu of entries, one chosen: `PopupMenu` lowers to it."
signatures:
  - call: PopupMenuBox(binding, domain, options)
    description: "A menu of entries, one chosen: `PopupMenu` lowers to it."
    library: enumeratio-boxes
    type: (expression, expression, expression*) -> boxes
seeAlso:
  - SetterBox
  - TogglerBox
names:
  wolframIdentity: true
---

- The domain is a rule list of `value -> label`, as in Wolfram's `PopupMenuBox[Dynamic[c], {a -> "a", ...}]`; an entry written `Labeled(value, label)` shows one thing and binds another. The example's `expected` shows `Tuple`: compute-engine reads a symbol-keyed pair as one.
- Its intent is a choice.
