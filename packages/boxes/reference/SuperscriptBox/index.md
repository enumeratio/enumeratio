---
name: SuperscriptBox
domain: Boxes
signature: SuperscriptBox(base, script)
summary: "A base with a superscript: $x^2$."
signatures:
  - call: SuperscriptBox(base, script)
    description: "A base with a superscript: $x^2$."
    library: enumeratio-boxes
    type: (boxes, boxes, expression*) -> boxes
seeAlso:
  - SubscriptBox
  - SubsuperscriptBox
  - OverscriptBox
names:
  wolframIdentity: true
---

- MathML's `msup`.
