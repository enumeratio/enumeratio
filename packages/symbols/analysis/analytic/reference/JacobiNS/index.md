---
name: JacobiNS
domain: Special functions
signature: JacobiNS(u, m)
summary: The Jacobi elliptic function $\operatorname{ns}(u,m) = 1/\operatorname{sn}(u,m)$ (Glaisher's notation), in Wolfram/mpmath's $m=k^2$ convention.
signatures:
  - call: JacobiNS(u, m)
    description: the Jacobi elliptic function ns, argument u, parameter m.
    library: "@enumeratio/analytic"
    type: (number, number) -> number
seeAlso:
  - JacobiSN
  - JacobiSC
  - JacobiSD
names:
  wolframIdentity: true
---

- $m = k^2$, the same convention [[EllipticK]] / [[EllipticF]] use.
- $\operatorname{ns}(u,m) = 1/\operatorname{sn}(u,m)$ — [[JacobiSN]] shares this head's numeric kernel and exact-value coverage (m outside [0,1] via the reciprocal- and imaginary-modulus transformations, complex u, a genuinely complex m declined).
- ns has a pole at u = 0 (sn(0,m) = 0, for any m).
- Numeric only — a symbolic argument stays unevaluated; a floating-point argument (or `N()`) evaluates directly.
- `N(x, d)` past a double's digits runs the same AGM in BigDecimal for real $u$ and $0 < m < 1$; complex $u$ and other $m$ stay unevaluated there rather than print a double's digits as more.
