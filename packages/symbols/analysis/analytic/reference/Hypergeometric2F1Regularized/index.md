---
name: Hypergeometric2F1Regularized
domain: Special functions
signature: Hypergeometric2F1Regularized(a, b, c, z)
summary: The regularized Gauss hypergeometric function ${}_2F_1(a,b,c;z) / \Gamma(c)$ (fungrim:fe6e74) — entire in $c$; only converges for $|z| < 1$. Provided by `@enumeratio/analytic`.
signatures:
  - call: Hypergeometric2F1Regularized(a, b, c, z)
    description: ${}_2F_1(a,b,c;z) / \Gamma(c)$.
    library: "@enumeratio/analytic"
    type: (number, number, number, number) -> number
primitive: numeric
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/hypergeometric.ts
  - origin: mapped
    form: wolfram / mpmath
    environment: external
    note: Hypergeometric2F1Regularized[a,b,c,z]; mpmath's own regularized series (rgamma per term).
seeAlso:
  - Hypergeometric3F2Regularized
  - Hypergeometric1F1Regularized
names:
  wolframIdentity: true
---

The regularized Gauss hypergeometric function $\mathbf{F}(a,b;c;z) = {}_2F_1(a,b;c;z)/\Gamma(c)$ (DLMF 15.2.2, fungrim:fe6e74) divides [[Hypergeometric2F1]] by $\Gamma(c)$, but — unlike doing that division after the fact — is entire in $c$: it stays finite exactly where $\Gamma(c)$ has a pole, at $c$ a nonpositive integer. At such a $c = -n$ it reduces to an ordinary (unregularized) hypergeometric function at shifted parameters, $\mathbf{F}(a,b;-n;z) = \dfrac{(a)_{n+1}(b)_{n+1}}{(n+1)!}\,z^{n+1}\,{}_2F_1(a{+}n{+}1,b{+}n{+}1;n{+}2;z)$ (DLMF 15.2.3_5).

- Computed by the $1/\Gamma$-per-term series ($p = q + 1$ here), so it stays finite at $c$ a nonpositive integer rather than dividing `Hypergeometric2F1` by `Gamma(c)`'s pole there.
- The series only converges for $|z| < 1$; outside the unit disc this stays symbolic rather than answering with a guessed analytic continuation. The exception is `N(…, d)` past a double's digits at real $z < 1$, which maps $z < -\tfrac12$ into the disc by Pfaff's transformation, $\mathbf{F}(a,b;c;z) = (1-z)^{-a}\,\mathbf{F}(a,c-b;c;\tfrac{z}{z-1})$ (DLMF 15.8.1), and declines at $z \ge 1$ and where the series cannot settle ($z$ near $-\infty$). Several of Fungrim's own identities for this head (e.g. fungrim:90ac58) rewrite to a different argument first — that rewrite belongs in the identity layer, not here.
