---
name: BraidClosure
domain: Braids and knots
signature: BraidClosure(braid)
summary: The link a braid closes to — each out strand joined to the in slot below it, round the side. By Alexander's theorem every link is one, and a cell that evaluates it draws the closed braid.
signatures:
  - call: BraidClosure(braid)
    description: the closure of a braid, as a link
    library: enumeratio-braid
    type: (expression<Braid> | string) -> expression<Link>
seeAlso:
  - Braid
  - TorusBraid
  - TorusKnot
  - AlexanderPolynomial
  - JonesPolynomial
references:
  - system: wikipedia
    identity: Braid theory
---

- Inert, like `Braid`: it is a value. The knot-polynomial heads (`JonesPolynomial`, `AlexanderPolynomial`, `KauffmanBracket`, `BracketInvariant`) take it and read the braid it closes
- Drawn as a `StrandDiagram` of the closure: the arcs join each out slot to the in slot below it, and a click follows a whole link component
- Wolfram Language has no counterpart. `KnotData` names knots by entity and returns braid properties of them, but no head closes a braid; neither a `BraidData` nor a `BraidClosure` is among Wolfram's system names. Not checked against a kernel (none on this box)
