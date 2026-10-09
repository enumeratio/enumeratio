---
name: InputFieldBox
domain: Boxes
signature: InputFieldBox(binding, domain, options)
summary: "A field you type a value into: `InputField` lowers to it."
signatures:
  - call: InputFieldBox(binding, domain, options)
    description: "A field you type a value into: `InputField` lowers to it."
    library: enumeratio-boxes
    type: (boxes, expression, expression*) -> boxes
seeAlso:
  - SliderBox
  - CheckboxBox
names:
  wolframIdentity: true
---

- The binding holds what was typed, read as an expression.
- Its intent is text.
