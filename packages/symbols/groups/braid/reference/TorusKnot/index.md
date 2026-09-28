---
name: TorusKnot
domain: Braids and knots
signature: TorusKnot(p, q)
summary: The torus knot $T(p,q)$, winding $p$ times one way and $q$ the other round a torus — a value carrying both a closed form and, when a word for it exists, the [[TorusBraid]] it closes from.
signatures:
  - call: TorusKnot(p, q)
    description: $T(p,q)$ as a knot — the closed form, with no braid involved
    library: enumeratio-braid
    type: (integer, integer) -> expression<TorusKnot>
seeAlso:
  - TorusBraid
  - AlexanderPolynomial
  - JonesPolynomial
---
