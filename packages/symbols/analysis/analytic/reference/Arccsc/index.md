---
name: Arccsc
domain: Elementary functions
signature: Arccsc(x)
summary: Arccosecant, the inverse of [[Csc]].
signatures:
  - call: Arccsc(x)
    description: the value $y$ with $\csc(y) = x$.
  - call: Arccsc(x)
    description: Arccosecant, the inverse of [[Csc]].
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
seeAlso:
  - Csc
  - Arcsin
names:
  wolfram: ArcCsc
---
