---
name: Hypergeometric0F1
domain: Special functions
signature: Hypergeometric0F1(b, z)
summary: The confluent hypergeometric limit function ${}_0F_1(b; z) = \sum_{k\ge0} z^k / ((b)_k\,k!)$ — entire in $z$, related to the Bessel functions. Provided by `@enumeratio/analytic`.
signatures:
  - call: Hypergeometric0F1(b, z)
    description: ${}_0F_1(b; z)$, by its defining series.
    library: "@enumeratio/analytic"
    type: (number, number) -> number
primitive: numeric
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/hypergeometric.ts
  - origin: mapped
    form: wolfram / mpmath
    environment: external
    note: Hypergeometric0F1[b,z]; mpmath.hyp0f1(b,z).
seeAlso:
  - Hypergeometric0F1Regularized
  - BesselJ
names:
  wolframIdentity: true
---

- The confluent hypergeometric limit function ${}_0F_1(b; z) = \sum_{k\ge0} z^k / ((b)_k\,k!)$ is the $p=0$, $q=1$ case of [[HypergeometricPFQ]] (DLMF 16.2.1) and, having no upper parameter, is entire in $z$ for every $b$. It is Bessel's equation in series form: $J_\nu(z) = \dfrac{(z/2)^\nu}{\Gamma(\nu+1)}\,{}_0F_1(\nu+1; -z^2/4)$ (DLMF 10.16.9), and likewise for $I_\nu$ with $z^2/4$ in place of $-z^2/4$.
- compute-engine 0.128 does not declare this head at all — no `Hypergeometric1F1`-style native to extend — so it is supplied here directly, by the term-ratio recurrence (Fungrim's own `Hypergeometric0F1` identities relate it to `AiryAi`, `Sin` and `Sinc`).
- Poles at $b$ a nonpositive integer $0, -1, -2, \dots$ stay symbolic; see [[Hypergeometric0F1Regularized]] for the entire version.
