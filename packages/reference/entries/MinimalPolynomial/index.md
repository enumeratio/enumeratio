---
name: MinimalPolynomial
domain: Number theory
signature: MinimalPolynomial(a, x)
primitive: kernel
summary: 'The minimal polynomial of the algebraic number $a$ in $x$: the irreducible polynomial over $\mathbb{Z}$ with positive leading coefficient that $a$ is a root of.'
signatures:
  - call: MinimalPolynomial(a, x)
    description: the minimal polynomial of $a$, for $a$ written in one radical of a rational, $i$, the golden ratio or one [[PolynomialRoot]]
    library: enumeratio-number-theory
    type: (number, any) -> expression
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/ce-patches/src/compute-engine/library/algebraic-numbers.ts
  - origin: mapped
    form: wolfram
    template: MinimalPolynomial[$1, $2]
    arity: 2
seeAlso:
  - AlgebraicIntegerQ
  - AlgebraicNumberNorm
  - PolynomialRoot
names:
  wolframIdentity: true
---

- $a$ is read as a polynomial in one generator: $1 + \sqrt[3]{2}$, $(1 + \sqrt{-3})/2$ or $\theta^2 - \theta$ for $\theta$ a [[PolynomialRoot]]; with two generators ($\sqrt 2 + \sqrt 3$) it stays unevaluated
- Its degree is $[\mathbb{Q}(a) : \mathbb{Q}]$; $a$ is an algebraic integer exactly when the polynomial is monic ([[AlgebraicIntegerQ]])
