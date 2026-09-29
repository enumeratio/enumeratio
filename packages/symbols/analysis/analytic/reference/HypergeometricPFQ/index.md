---
name: HypergeometricPFQ
domain: Special functions
signature: HypergeometricPFQ(a, b, z)
summary: The generalized hypergeometric function ${}_pF_q(a; b; z)$, built on the same series machinery (`pfqSeries`) as this package's 0F1/1F1Regularized/2F1Regularized/3F2Regularized, generalized to arbitrary $p$ and $q$.
signatures:
  - call: HypergeometricPFQ(a, b, z)
    description: ${}_pF_q(a; b; z)$, for parameter lists `a` (length $p$) and `b` (length $q$).
    library: "@enumeratio/analytic"
    type: (list, list, number) -> number
primitive: kernel
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/hypergeometric-pfq.ts
seeAlso:
  - Hypergeometric0F1
  - Hypergeometric2F1Regularized
  - Hypergeometric3F2Regularized
names:
  wolframIdentity: true
---

The generalized hypergeometric function ${}_pF_q(a_1,\dots,a_p; b_1,\dots,b_q; z) = \sum_{k\ge0} \dfrac{(a_1)_k \cdots (a_p)_k}{(b_1)_k \cdots (b_q)_k}\dfrac{z^k}{k!}$ (DLMF 16.2.1) is the family this package's other hypergeometric heads specialize: [[Hypergeometric0F1]] is $p=0,q=1$; [[Hypergeometric2F1Regularized]] is the $p=2,q=1$ regularized case. Convergence follows from the parameter counts alone (DLMF §16.2(ii)–(iv)): entire in $z$ for $p \le q$, radius 1 for $p=q+1$ (unless an upper parameter terminates the series into a polynomial), and generically divergent for $p > q+1$.

- Three closed forms stay exact ahead of the numeric series, symbolic $z$ (and parameters) included: ${}_0F_0(;;z) = e^z$; ${}_1F_0(a;;z) = (1-z)^{-a}$; and $\mathrm{HypergeometricPFQ}(\ldots; 0) = 1$ for any parameter lists (the series' own leading term).
- Otherwise: $p \le q$ converges for any $z$; $p = q+1$ only inside the unit disc, matching this package's Regularized forms — declined outside it rather than attempting an analytic continuation.
