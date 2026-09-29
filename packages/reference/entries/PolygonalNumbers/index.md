---
name: PolygonalNumbers
domain: Collections
signature: PolygonalNumbers(k)
summary: The $k$-gonal figurate numbers $P(k, n) = \big((k-2)n^2 - (k-4)n\big)/2$, one lazy indexed collection per polygon size $k \ge 3$.
signatures:
  - call: PolygonalNumbers(k)
    description: $P(k, n)$ for $n = 1, 2, 3, …$, the $k$-gonal numbers.
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<integer>
enumerate:
  expr: Take(PolygonalNumbers(5), 20)
seeAlso:
  - TriangularNumbers
  - SquareNumbers
  - PentagonalNumbers
  - HexagonalNumbers
  - Count
  - At
  - Element
bindings:
  - origin: mapped
    form: wolfram
    counterpart: false
    note: "Wolfram's own PolygonalNumber[r, n] gives one term (kernel-verified: matches ours termwise) but there's no lazy collection to Take from -- only Table[PolygonalNumber[r, n], {n, 1, count}], which a per-head template on PolygonalNumbers alone can't compose with the outer Take call. Wolfram Function Repository searched; PolygonalDiagram found but it's a visualization (draws the dot array), not a term source."
    checked:
      version: 15.0.0
      on: 2026-09-28
grades:
  - name: k
    role: param
carrier: Numeric
unbounded: true
---

- A lazy indexed family for each $k \ge 3$: $Count(PolygonalNumbers(k)) = +\infty$, and $At(PolygonalNumbers(k), n)$ unranks $P(k, n)$ in closed form -- $At(PolygonalNumbers(5), 3) = 12$.
- $k = 3, 4, 5, 6, 7, 8$ reproduce [[TriangularNumbers]], [[SquareNumbers]], [[PentagonalNumbers]], [[HexagonalNumbers]], [[HeptagonalNumbers]] and [[OctagonalNumbers]] termwise; those fixed-$k$ names exist as their own lazy collections for convenience, not as a separate definition.
- Membership goes through [[Element]] by inverting the quadratic in $n$ exactly for the given $k$ -- $Element(12, PolygonalNumbers(5))$ is true, $Element(13, PolygonalNumbers(5))$ is false.
