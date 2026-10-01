---
name: Imaginary
domain: Compute engine
signature: Imaginary(complex | infinity) -> number
summary: Imaginary part of a complex number.
signatures:
  - call: Imaginary(complex | infinity) -> number
    description: as compute-engine declares it
  - call: Imaginary(complex | infinity) -> number
    description: the imaginary part; of a directed infinity, the infinity of its sign, or 0 when it has none.
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
names:
  fungrim: Im
  wolfram: Im
---
