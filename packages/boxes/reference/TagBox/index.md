---
name: TagBox
domain: Boxes
signature: TagBox(box, tag)
summary: Boxes labelled with a tag saying how to read them back as an expression.
signatures:
  - call: TagBox(box, tag)
    description: Boxes labelled with a tag saying how to read them back as an expression.
    library: enumeratio-boxes
    type: (boxes, symbol | string, expression*) -> boxes
seeAlso:
  - InterpretationBox
names:
  wolframIdentity: true
---

- The tag is a symbol, or a string where it is not one's name (a figure's marks are tagged with their addresses).
- A lighter hint than `InterpretationBox`: the boxes are still parsed, guided by the tag.
- MathML's `semantics`, with the tag as the annotation.
