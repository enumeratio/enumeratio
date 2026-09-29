---
name: UnderscriptBox
domain: Boxes
signature: UnderscriptBox(base, under)
summary: 'A box set below a base: the limit under $\lim$.'
signatures:
  - call: UnderscriptBox(base, under)
    description: 'A box set below a base: the limit under $\lim$.'
    library: enumeratio-boxes
    type: (boxes, boxes, expression*) -> boxes
seeAlso:
  - OverscriptBox
  - UnderoverscriptBox
names:
  wolframIdentity: true
---

- MathML's `munder`.
