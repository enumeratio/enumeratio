---
name: ListPickerBox
domain: Boxes
signature: ListPickerBox(binding, domain, options)
summary: "A list of entries to pick from: `ListPicker` lowers to it."
signatures:
  - call: ListPickerBox(binding, domain, options)
    description: "A list of entries to pick from: `ListPicker` lowers to it."
    library: enumeratio-boxes
    type: (expression, expression, expression*) -> boxes
seeAlso:
  - PopupMenuBox
  - SetterBox
  - DynamicBox
names:
  wolframIdentity: true
---

- The domain is a rule list of `value -> label`, as for a `PopupMenuBox`; `Multiselection -> True` picks several.
- Its intent is a choice.
