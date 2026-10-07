---
name: AlgebraicNumberTrace
domain: Number theory
signature: AlgebraicNumberTrace(a)
primitive: kernel
summary: 'The trace of $a$ over $\mathbb{Q}$ in the field $\mathbb{Q}(a)$: the sum of its conjugates.'
signatures:
  - call: AlgebraicNumberTrace(a)
    description: the sum of $a$'s conjugates
    library: enumeratio-number-theory
    type: (number) -> number
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/ce-patches/src/compute-engine/library/algebraic-numbers.ts
  - origin: mapped
    form: wolfram
    template: AlgebraicNumberTrace[$1]
    arity: 1
seeAlso:
  - AlgebraicNumberNorm
  - MinimalPolynomial
names:
  wolframIdentity: true
---

- In $\mathbb{Q}(a)$, the field $a$ generates
