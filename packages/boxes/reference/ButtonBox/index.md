---
name: ButtonBox
domain: Boxes
signature: ButtonBox(label, options)
summary: 'A link: `BaseStyle -> "Hyperlink"` to a URL, `BaseStyle -> "Link"` to a head''s page.'
signatures:
  - call: ButtonBox(label, options)
    description: 'A link: `BaseStyle -> "Hyperlink"` to a URL, `BaseStyle -> "Link"` to a head''s page.'
    library: enumeratio-boxes
    type: (boxes, expression*) -> boxes
seeAlso:
  - TextData
names:
  wolframIdentity: true
---

- `ButtonData` is the target: the URL, or the head's name (markdown's `[[Head]]`).
- `ButtonFunction -> "Set(_e, value)"` is a setter: a click sets the variable `e` in the scope it sits in. It is what `StringTemplate`'s `{Setter(_e, value, "label")}` lowers to.
- The web draws a link as an anchor and a setter as an anchor in a `button-box`, the one element that listens.
