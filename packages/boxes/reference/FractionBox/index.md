---
name: FractionBox
domain: Boxes
signature: FractionBox(numerator, denominator)
summary: A numerator over a denominator.
signatures:
  - call: FractionBox(numerator, denominator)
    description: A numerator over a denominator.
    library: enumeratio-boxes
    type: (boxes, boxes, expression*) -> boxes
seeAlso:
  - SqrtBox
  - GridBox
names:
  wolframIdentity: true
---

- `FractionLine -> False` drops the bar, as a binomial coefficient's stack does.
- MathML's `mfrac`.
