---
name: NumberFieldSignature
domain: Number theory
signature: NumberFieldSignature(a)
primitive: kernel
summary: 'The signature $(r_1, r_2)$ of $\mathbb{Q}(a)$: its real embeddings, and its pairs of complex conjugate ones.'
signatures:
  - call: NumberFieldSignature(a)
    description: $(r_1, r_2)$ with $r_1 + 2r_2$ the degree, $r_1$ counted by a Sturm sequence
    library: enumeratio-number-theory
    type: (number) -> list<integer>
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/ce-patches/src/compute-engine/library/algebraic-numbers.ts
  - origin: mapped
    form: wolfram
    template: NumberFieldSignature[$1]
    arity: 1
seeAlso:
  - NumberFieldDiscriminant
names:
  wolframIdentity: true
---

- By Dirichlet's unit theorem the units of $\mathcal{O}_K$ have rank $r_1 + r_2 - 1$
