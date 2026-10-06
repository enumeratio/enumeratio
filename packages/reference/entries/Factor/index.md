---
name: Factor
domain: Compute engine
signature: Factor(value, symbol?) -> value
summary: "Factor a polynomial expression into a product of irreducible factors. Supports perfect square trinomials, difference of squares, and quadratic factoring with rational roots. Example: Factor(x² + 5x + 6) → (x+2)(x+3), Factor(x² + 2x + 1) → (x+1)²"
signatures:
  - call: Factor(value, symbol?) -> value
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
---
