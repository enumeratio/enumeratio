---
name: AppellF1
domain: Compute engine
signature: AppellF1(complex | infinity, complex | infinity, complex | infinity, complex | infinity, complex | infinity, complex | infinity) -> number
summary: Appell hypergeometric function F₁(a; b₁, b₂; c; x, y), double series for |x|, |y| < 1.
signatures:
  - call: AppellF1(complex | infinity, complex | infinity, complex | infinity, complex | infinity, complex | infinity, complex | infinity) -> number
    description: as compute-engine declares it
stub: engine
bindings:
  - origin: mapped
    form: mpmath
    template: appellf1($1, $2, $3, $4, $5, $6)
    arity: 6
    checked:
      version: 1.3.0
      on: 2026-10-15
---
