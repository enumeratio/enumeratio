---
name: SubscriptBox
domain: Boxes
signature: SubscriptBox(base, script)
summary: "A base with a subscript: $x_1$."
signatures:
  - call: SubscriptBox(base, script)
    description: "A base with a subscript: $x_1$."
    library: enumeratio-boxes
    type: (boxes, boxes, expression*) -> boxes
seeAlso:
  - SuperscriptBox
  - SubsuperscriptBox
  - UnderscriptBox
names:
  wolframIdentity: true
---

- MathML's `msub`.
