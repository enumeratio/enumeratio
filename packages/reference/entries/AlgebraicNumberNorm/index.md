---
name: AlgebraicNumberNorm
domain: Number theory
signature: AlgebraicNumberNorm(a)
primitive: kernel
summary: 'The norm of $a$ over $\mathbb{Q}$ in the field $\mathbb{Q}(a)$: the product of its conjugates.'
signatures:
  - call: AlgebraicNumberNorm(a)
    description: the product of $a$'s conjugates, $(-1)^d$ times its minimal polynomial's constant term over its leading one
    library: enumeratio-number-theory
    type: (number) -> number
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/ce-patches/src/compute-engine/library/algebraic-numbers.ts
  - origin: mapped
    form: wolfram
    template: AlgebraicNumberNorm[$1]
    arity: 1
seeAlso:
  - AlgebraicNumberTrace
  - MinimalPolynomial
names:
  wolframIdentity: true
---

- In $\mathbb{Q}(a)$, the field $a$ generates; in a larger field of degree $n$ the norm is this to the power $n/d$
