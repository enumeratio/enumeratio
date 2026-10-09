---
name: KnotCurve
domain: Braids and knots
signature: KnotCurve(knot, samples?)
summary: The sampled points of a knot's embedding in space — only a torus knot has a parameterisation on file, so any other knot declines rather than guessing one from a braid word.
signatures:
  - call: KnotCurve(knot, samples?)
    description: the sampled points of $T(p,q)$'s torus embedding
    library: enumeratio-braid
    type: (expression<Braid> | expression<FigureEightKnot> | expression<Link> | expression<PretzelKnot> | expression<TorusKnot> | expression<TwistKnot> | string, integer?) -> list<list<real>>
seeAlso:
  - ParametricCurve
  - TorusKnot
---
