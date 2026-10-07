---
name: AlgebraicIntegerQ
domain: Number theory
signature: AlgebraicIntegerQ(a)
primitive: kernel
summary: 'Whether the algebraic number $a$ is an algebraic integer: a root of a monic polynomial over $\mathbb{Z}$.'
signatures:
  - call: AlgebraicIntegerQ(a)
    description: whether $a$ is an algebraic integer; unevaluated when $a$ isn't read as an algebraic number
    library: enumeratio-number-theory
    type: (number) -> boolean
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/ce-patches/src/compute-engine/library/algebraic-numbers.ts
  - origin: mapped
    form: wolfram
    template: AlgebraicIntegerQ[$1]
    arity: 1
seeAlso:
  - MinimalPolynomial
  - AlgebraicIntegers
names:
  wolframIdentity: true
---

- Wolfram answers `False` for anything it doesn't recognize as an algebraic integer, a symbol included; this stays unevaluated instead
