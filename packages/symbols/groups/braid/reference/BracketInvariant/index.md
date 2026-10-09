---
name: BracketInvariant
domain: Braids and knots
signature: BracketInvariant(knot)
summary: The writhe-corrected Kauffman bracket $(-A^3)^{-w}\langle L\rangle$ of a knot or link — already an invariant, unlike [[KauffmanBracket]] on its own.
signatures:
  - call: BracketInvariant(knot)
    description: $(-A^3)^{-w}\langle L\rangle$, already an invariant
    library: enumeratio-braid
    type: (expression<Braid> | expression<FigureEightKnot> | expression<Link> | expression<PretzelKnot> | expression<TorusKnot> | expression<TwistKnot> | string) -> expression
seeAlso:
  - KauffmanBracket
  - JonesPolynomial
  - BraidWrithe
---
