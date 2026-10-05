---
name: JacobiZN
domain: Special functions
signature: JacobiZN(u, m)
summary: Wolfram's Jacobi zeta function $Z(u,m) = E(\operatorname{am}(u,m),m) - \dfrac{E(m)}{K(m)}u$, in Wolfram/mpmath's $m=k^2$ convention.
signatures:
  - call: JacobiZN(u, m)
    description: the Jacobi zeta function, argument u, parameter m.
    library: "@enumeratio/analytic"
    type: (number, number) -> number
seeAlso:
  - JacobiAmplitude
  - EllipticE
  - EllipticK
names:
  wolframIdentity: true
---

- $m = k^2$, the same convention [[EllipticK]] / [[EllipticF]] use.
- Composed from [[JacobiAmplitude]]'s amplitude and the already-declared [[IncompleteEllipticE]], [[EllipticE]], [[EllipticK]] (DLMF 22.16.31) — not a separate numeric method.
- Real m between 0 and 1 only, inheriting [[JacobiAmplitude]]'s restriction (no verified amplitude transform for m outside that range).
- Z(0,m) = 0, for any m in range; Z(u,0) = 0, for any u — am(u,0) = u makes E(am,0) = u exactly, canceling the E(0)/K(0)·u = u term.
- Numeric only — a symbolic argument (outside the exact table above) stays unevaluated; a floating-point argument (or `N()`) evaluates directly.
- `N(x, d)` past a double's digits runs the AGM amplitude in BigDecimal and takes $E$ and $K$ from the Carlson kernels, for real $u$ and $0 < m < 1$; anything else stays unevaluated there rather than print a double's digits as more.
