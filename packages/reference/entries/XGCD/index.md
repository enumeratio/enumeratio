---
name: XGCD
domain: Number theory
signature: XGCD(a, b)
summary: The extended Euclidean algorithm -- $(g, x, y)$ with $g = \gcd(a, b) = ax + by$.
signatures:
  - call: XGCD(a, b) -> Tuple(g, x, y)
    description: Bezout coefficients alongside the gcd
    library: "@enumeratio/analytic"
    type: (integer, integer) -> tuple<integer, integer, integer>
seeAlso:
  - GCD
  - ExtendedGCD
---
