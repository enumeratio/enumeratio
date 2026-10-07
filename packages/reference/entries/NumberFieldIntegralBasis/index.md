---
name: NumberFieldIntegralBasis
domain: Number theory
signature: NumberFieldIntegralBasis(a)
primitive: kernel
summary: A $\mathbb{Z}$-basis of the ring of integers of $\mathbb{Q}(a)$, written on $a$'s powers as Wolfram writes it.
signatures:
  - call: NumberFieldIntegralBasis(a)
    description: 'a basis of $\mathcal{O}_K$: the $i$-th element $a^i/d_i$ plus lower powers, each lower coefficient reduced'
    library: enumeratio-number-theory
    type: (number) -> list
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/ce-patches/src/compute-engine/library/algebraic-numbers.ts
  - origin: mapped
    form: wolfram
    template: NumberFieldIntegralBasis[$1]
    arity: 1
seeAlso:
  - NumberFieldDiscriminant
  - AlgebraicIntegers
names:
  wolframIdentity: true
---

- The basis is triangular on $1, a, \ldots, a^{n-1}$, as Wolfram's is; any other basis differs by a matrix in $\mathrm{GL}_n(\mathbb{Z})$
