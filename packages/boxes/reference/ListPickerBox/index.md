---
name: ListPickerBox
domain: Boxes
signature: ListPickerBox(binding, domain, options)
summary: "A list of entries to pick from: `ListPicker` lowers to it."
signatures:
  - call: ListPickerBox(binding, domain, options)
    description: "A list of entries to pick from: `ListPicker` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - PopupMenuBox
  - SetterBarBox
  - DynamicBox
names:
  wolframIdentity: true
---

- The domain is the list of entries, as for a `PopupMenuBox`; `Multiselection -> True` picks several.
- Its intent is a choice.
