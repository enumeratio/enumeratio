---
name: PrimeZetaP
domain: Special functions
signature: PrimeZetaP(s)
summary: The prime zeta function $P(s) = \sum_p p^{-s}$, the sum over primes. Computed via the Möbius/ζ identity $P(s) = \sum_{k \ge 1} \mu(k)/k \cdot \ln\zeta(ks)$ rather than sieving primes directly — the identity converges geometrically, sieving does not.
signatures:
  - call: PrimeZetaP(s)
    description: $P(s)$, for $\operatorname{Re}(s) > 0$.
    library: "@enumeratio/analytic"
    type: (number) -> number
primitive: kernel
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/prime-zeta.ts
seeAlso:
  - Zeta
names:
  wolframIdentity: true
---

- Reuses this package's own `Zeta` (already extended to complex arguments) rather than a fresh prime-summation kernel; $\ln\zeta(ks) \to 0$ geometrically as $k$ grows, so the sum settles in a few dozen terms at double precision.
- For $\operatorname{Re}(s) \le 1$ the identity is an analytic continuation, and each $\ln\zeta(x)$, $x = ks$, takes Wolfram's branch: the principal logarithm when $\operatorname{Re}(x) \ge 1/2$, and $x\ln 2 + (x-1)\ln\pi + \operatorname{Log}\sin(\pi x/2) + \operatorname{LogGamma}(1-x) + \operatorname{Log}\zeta(1-x)$ (the functional equation, each piece principal) when $\operatorname{Re}(x) < 1/2$. For real $s$ both are the principal logarithm, so $\operatorname{Im} P(s) = \pi \sum_{ks < 1} \mu(k)/k$. For complex $s$ the second differs from the first by a multiple of $2\pi i$ that grows with $\operatorname{Im}(s)$, and the value is not continuous across the real axis.
- $s = 1/k$ for a squarefree $k$ is `ComplexInfinity`, as in Wolfram; $1/4$ is finite because $\mu(4) = 0$.
- It declines (stays unevaluated) for $\operatorname{Re}(s) \le 0$, at a zero of $\zeta(ks)$ and where $\zeta(ks)$ lies on the logarithm's cut, for $\operatorname{Re}(s)$ below about $0.005$, and for $|\operatorname{Im}(ks)| > 350$ while $\operatorname{Re}(ks) < 1/2$.
- Checked against `wolframscript`'s `N[PrimeZetaP[s], 30]` over a grid of real and complex $s$ in the strip, matching to 30 digits on the bignum path (where it answers) and to about $10^{-12}$ at doubles.
- `N(x, d)` past a double's digits runs the same sum on the BigDecimal $\zeta$ kernel, for real and complex $s$, to $d$ digits; it declines at an approximated pole, and where the terms (about $3.4 d/\operatorname{Re}(s)$) would be too many.
