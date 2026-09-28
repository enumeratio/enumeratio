---
name: UnderoverscriptBox
domain: Boxes
signature: UnderoverscriptBox(base, under, over)
summary: 'A base with boxes below and above it: $\sum_{n=1}^{10}$.'
signatures:
  - call: UnderoverscriptBox(base, under, over)
    description: 'A base with boxes below and above it: $\sum_{n=1}^{10}$.'
    library: enumeratio-boxes
    type: (boxes, boxes, boxes, expression*) -> boxes
details:
  - MathML's `munderover`.
seeAlso:
  - UnderscriptBox
  - OverscriptBox
names:
  wolframIdentity: true
---
