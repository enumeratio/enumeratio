---
name: QuadraticOrder
domain: Number theory
signature: QuadraticOrder(D)
summary: 'The quadratic order of discriminant $D = f^2 D_K$: $\mathbb{Z} + f\,\mathcal{O}_K$, the subring of conductor $f$ in the ring of integers of $\mathbb{Q}(\sqrt D)$. $\mathbb{Z}[\sqrt{d}]$ is $\mathrm{QuadraticOrder}(4d)$.'
signatures:
  - call: QuadraticOrder(D)
    description: the order of discriminant $D$, for $D \equiv 0$ or $1 \pmod 4$ not a square; the field's own discriminant gives its ring of integers
    library: enumeratio-number-theory
    type: (integer) -> set<quadratic_integer>
seeAlso:
  - QuadraticIntegers
  - QuadraticInteger
  - IsPrime
catalog:
  - system: sage
    identity: QuadraticField(d).order_of_conductor(f)
    url: https://doc.sagemath.org/html/en/reference/number_fields/sage/rings/number_field/number_field.html
  - system: pari
    identity: quadclassunit(D)
    url: https://pari.math.u-bordeaux.fr/dochtml/html/Arithmetic_functions.html
bindings:
  - origin: mapped
    form: wolfram
    counterpart: false
    note: "Wolfram has no quadratic orders: its number-field heads take an algebraic number, and work in the maximal order."
---

- A value for the `Over` option, as [[QuadraticIntegers]] is: `IsPrime(x, Over -> QuadraticOrder(-12))` asks whether $x$ is prime in $\mathbb{Z}[\sqrt{-3}]$. An element is written as any number of the field is, and belongs to the order when its coordinate on $\omega_K$ is a multiple of $f$
- Orders of conductor $f > 1$ have fewer units ($\mathbb{Z}[\sqrt{-3}]$ has only $\pm 1$, against six in $\mathbb{Z}[\omega]$) and never factor uniquely, since they are not integrally closed: $4 = 2 \cdot 2 = -(1 + \sqrt{-3})(-1 + \sqrt{-3})$ in $\mathbb{Z}[\sqrt{-3}]$, so `FactorInteger` stays unevaluated
- At a prime $p$ dividing $f$ the ideals are not all invertible, and an element is prime exactly when $\mathcal{O}/(x)$ is a field, irreducible when nothing of a smaller norm divides it
- `QuadraticOrder(D)` for the field's discriminant ($D_K = d$ or $4d$) is `QuadraticIntegers(d)`
