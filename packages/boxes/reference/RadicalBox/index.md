---
name: RadicalBox
domain: Boxes
signature: RadicalBox(radicand, index)
summary: An $n$th-root sign over a box, the index in its crook.
signatures:
  - call: RadicalBox(radicand, index)
    description: An $n$th-root sign over a box, the index in its crook.
    library: enumeratio-boxes
    type: (boxes, boxes, expression*) -> boxes
seeAlso:
  - SqrtBox
names:
  wolframIdentity: true
---

- MathML's `mroot`.
