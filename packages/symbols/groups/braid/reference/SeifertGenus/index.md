---
name: SeifertGenus
domain: Braids and knots
signature: SeifertGenus(knot)
summary: "The Seifert genus of a knot: the closed form for a named torus, twist or pretzel knot, otherwise Bennequin's $(c-s+1)/2$ on a positive braid's closure."
signatures:
  - call: SeifertGenus(knot)
    description: $(p-1)(q-1)/2$ for $T(p,q)$, $1$ for a twist or pretzel knot, else a positive braid's $(c-s+1)/2$
    library: enumeratio-braid
    type: (expression<Braid> | expression<FigureEightKnot> | expression<Link> | expression<PretzelKnot> | expression<TorusKnot> | expression<TwistKnot> | string) -> integer
seeAlso:
  - AlexanderPolynomial
  - BraidIsPositive
---
