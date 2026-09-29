---
name: HypergeometricU
domain: Special functions
signature: HypergeometricU(a, b, z)
summary: Tricomi's confluent hypergeometric function $U(a,b,z)$, for $b$ not an integer — see [[HypergeometricUStar]] for the $z^a$-regularized form Fungrim builds most of its identities from. Provided by `@enumeratio/analytic`.
signatures:
  - call: HypergeometricU(a, b, z)
    description: Tricomi's confluent hypergeometric $U(a,b,z)$.
    library: "@enumeratio/analytic"
    type: (number, number, number) -> number
primitive: numeric
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/hypergeometric-ustar.ts
  - origin: mapped
    form: wolfram / mpmath
    environment: external
    note: HypergeometricU[a,b,z]; mpmath.hyperu(a,b,z).
seeAlso:
  - HypergeometricUStar
  - Hypergeometric1F1Regularized
names:
  wolframIdentity: true
---

Tricomi's function $U(a,b,z)$ is the confluent hypergeometric equation's other standard solution, the one recessive as $z \to \infty$ where Kummer's $M(a,b,z)$ (${}_1F_1(a;b;z)$) grows. It specializes to elementary and other special functions at particular parameters — $U(a,a+1,z) = z^{-a}$ (DLMF 13.6.4), and $U(1,1,z) = e^z\,\Gamma(0,z) = e^z E_1(z)$, the exponential integral (DLMF 13.6.6 at $a=1$: $U(a,a,z) = e^z\,\Gamma(1-a,z)$; see [[Gamma]]).

- compute-engine 0.128 references this head only inside its identity rules (relating it to `HypergeometricUStar`) but never actually declares it as an operator, so there was nothing to extend — it is declared directly here, reusing the same Kummer connection-formula kernel as `HypergeometricUStar`.
- $b$ at (or very near) an integer is declined, for the same reason `HypergeometricUStar` declines there: the connection formula's $\Gamma(1-b)$ and $\Gamma(b-1)$ blow up, and the log-case limit that resolves it is not implemented.
- $U(a,b,z) \cdot z^a$ equals `HypergeometricUStar(a,b,z)` exactly (fungrim:c8fcc7), which is how this is cross-checked.
