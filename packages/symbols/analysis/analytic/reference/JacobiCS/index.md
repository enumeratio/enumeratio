---
name: JacobiCS
domain: Special functions
signature: JacobiCS(u, m)
summary: The Jacobi elliptic function $\operatorname{cs}(u,m) = \operatorname{cn}(u,m)/\operatorname{sn}(u,m)$ (Glaisher's notation), in Wolfram/mpmath's $m=k^2$ convention.
signatures:
  - call: JacobiCS(u, m)
    description: the Jacobi elliptic function cs, argument u, parameter m.
    library: "@enumeratio/analytic"
    type: (number, number) -> number
seeAlso:
  - JacobiCN
  - JacobiSN
  - JacobiSC
names:
  wolframIdentity: true
---

- $m = k^2$, the same convention [[EllipticK]] / [[EllipticF]] use.
- $\operatorname{cs}(u,m) = \operatorname{cn}(u,m)/\operatorname{sn}(u,m)$ — [[JacobiCN]] and [[JacobiSN]] share this head's numeric kernel and exact-value coverage (m outside [0,1] via the reciprocal- and imaginary-modulus transformations, complex u, a genuinely complex m declined).
- cs has a pole at u = 0 (sn(0,m) = 0, for any m).
- Numeric only — a symbolic argument stays unevaluated; a floating-point argument (or `N()`) evaluates directly.
- `N(x, d)` past a double's digits runs the same AGM in BigDecimal for real $u$ and $0 < m < 1$; complex $u$ and other $m$ stay unevaluated there rather than print a double's digits as more.
- Derivatives of every order in $u$ and in $m$ are closed forms in sn, cn, dn and the Jacobi epsilon $\mathcal{E}(u,m)=Z(u,m)+u\,E(m)/K(m)$ (DLMF 22.13): `D`, `Series` in $u$ at $0$ or at a symbolic point, and `Series` in $m$ at $m=0$ all give concrete coefficients. The $m$-derivatives evaluate numerically for real $u$ and $m$ between 0 and 1. At the pole $u=0$ the series in $u$ is the Laurent series, its coefficients polynomials in $m$.
