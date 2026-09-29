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
