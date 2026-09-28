---
name: RowBox
domain: Boxes
signature: RowBox([box1, box2, …])
summary: "A row of boxes, juxtaposed left to right: the box a sequence of tokens makes."
signatures:
  - call: RowBox([box1, box2, …])
    description: "A row of boxes, juxtaposed left to right: the box a sequence of tokens makes."
    library: enumeratio-boxes
    type: (list<boxes>) -> boxes
details:
  - The argument is a list, as in Wolfram's `RowBox[{…}]`; each entry is a box or a string token.
  - Presentation MathML's `mrow`.
seeAlso:
  - TextBox
  - GridBox
  - ToBoxes
names:
  wolframIdentity: true
---
