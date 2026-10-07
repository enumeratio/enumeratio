---
name: NumberFieldDiscriminant
domain: Number theory
signature: NumberFieldDiscriminant(a)
primitive: kernel
summary: 'The discriminant of the number field $\mathbb{Q}(a)$: of its ring of integers $\mathcal{O}_K$.'
signatures:
  - call: NumberFieldDiscriminant(a)
    description: "the discriminant of $\\mathcal{O}_K$ for $K = \\mathbb{Q}(a)$; it divides the minimal polynomial's discriminant by the square of $[\\mathcal{O}_K : \\mathbb{Z}[a]]$"
    library: enumeratio-number-theory
    type: (number) -> integer
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/ce-patches/src/compute-engine/library/algebraic-numbers.ts
  - origin: mapped
    form: wolfram
    template: NumberFieldDiscriminant[$1]
    arity: 1
seeAlso:
  - NumberFieldIntegralBasis
  - NumberFieldSignature
  - AlgebraicIntegers
names:
  wolframIdentity: true
---

- $\mathcal{O}_K$ is found by enlarging $\mathbb{Z}[a]$ at each prime $p$ with $p^2$ dividing its discriminant, while some element of $\frac1p\mathbb{Z}[a]$ outside it is integral; the search declines (stays unevaluated) when it runs past its cap or the discriminant can't be factored
