---
name: SubsuperscriptBox
domain: Boxes
signature: SubsuperscriptBox(base, sub, sup)
summary: 'A base with a subscript and a superscript: $\int_0^1$.'
signatures:
  - call: SubsuperscriptBox(base, sub, sup)
    description: 'A base with a subscript and a superscript: $\int_0^1$.'
    library: enumeratio-boxes
    type: (boxes, boxes, boxes, expression*) -> boxes
seeAlso:
  - SubscriptBox
  - SuperscriptBox
names:
  wolframIdentity: true
---

- MathML's `msubsup`.
