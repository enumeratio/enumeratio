---
name: AlgebraicIntegers
domain: Number theory
signature: AlgebraicIntegers(a)
summary: 'The ring of integers $\mathcal{O}_K$ of the number field $K = \mathbb{Q}(a)$: every element of $K$ that is a root of a monic polynomial over $\mathbb{Z}$, its maximal order.'
signatures:
  - call: AlgebraicIntegers(a)
    description: the maximal order of $\mathbb{Q}(a)$, for $a$ a radical of a rational, $i$, the golden ratio or a [[PolynomialRoot]]; in degree 1 it is `Integers`, in degree 2 `QuadraticIntegers(d)`
    library: enumeratio-number-theory
    type: (number) -> set<number>
seeAlso:
  - AlgebraicOrder
  - QuadraticIntegers
  - NumberFieldIntegralBasis
  - IsPrime
catalog:
  - system: sage
    identity: NumberField(f, 'a').maximal_order()
    url: https://doc.sagemath.org/html/en/reference/number_fields/sage/rings/number_field/order.html
  - system: pari
    identity: nfinit(f)
    url: https://pari.math.u-bordeaux.fr/dochtml/html/General_number_fields.html
bindings:
  - origin: mapped
    form: wolfram
    counterpart: false
    note: "Wolfram names no ring of integers: its NumberField* functions take the algebraic number and work in this ring."
---

- A value for `Over`: `IsPrime(x, Over -> AlgebraicIntegers(a))` asks whether $(x)$ is a prime ideal, that is whether $\mathcal{O}_K/(x)$ is a field. With $|N(x)| = p^f$ that is $p \in (x)$, Frobenius injective on the quotient and fixing only $\mathbb{F}_p$, all linear algebra over $\mathbb{F}_p$
- $\mathcal{O}_K$ is found as [[NumberFieldDiscriminant]] finds it, and stays unevaluated where that declines
- Past degree 2 it stays `AlgebraicIntegers(a)`; [[NumberFieldIntegralBasis]] lists a basis
