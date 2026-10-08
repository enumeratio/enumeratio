---
name: JacobiSC
domain: Special functions
signature: JacobiSC(u, m)
summary: The Jacobi elliptic function $\operatorname{sc}(u,m) = \operatorname{sn}(u,m)/\operatorname{cn}(u,m)$ (Glaisher's notation), in Wolfram/mpmath's $m=k^2$ convention.
signatures:
  - call: JacobiSC(u, m)
    description: the Jacobi elliptic function sc, argument u, parameter m.
    library: "@enumeratio/analytic"
    type: (number, number) -> number
seeAlso:
  - JacobiSN
  - JacobiCN
  - JacobiCS
names:
  wolframIdentity: true
---

- $m = k^2$, the same convention [[EllipticK]] / [[EllipticF]] use.
- $\operatorname{sc}(u,m) = \operatorname{sn}(u,m)/\operatorname{cn}(u,m)$ — [[JacobiSN]] and [[JacobiCN]] share this head's numeric kernel and exact-value coverage (m outside [0,1] via the reciprocal- and imaginary-modulus transformations, complex u, a genuinely complex m declined).
- sc(0,m) = 0, for any m.
- Numeric only — a symbolic argument stays unevaluated; a floating-point argument (or `N()`) evaluates directly.
- `N(x, d)` past a double's digits runs the same AGM in BigDecimal for real $u$ and $0 < m < 1$; complex $u$ and other $m$ stay unevaluated there rather than print a double's digits as more.
