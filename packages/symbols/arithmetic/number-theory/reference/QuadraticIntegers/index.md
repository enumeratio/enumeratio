---
name: QuadraticIntegers
domain: Number theory
signature: QuadraticIntegers(d)
summary: 'The ring of integers of $\mathbb{Q}(\sqrt d)$: $\mathbb{Z}[\omega]$ with $\omega = (-1 + \sqrt d)/2$ when $d \equiv 1 \pmod 4$, else $\sqrt d$.'
signatures:
  - call: QuadraticIntegers(d)
    description: the ring of integers of $\mathbb{Q}(\sqrt d)$, for a non-square integer $d$; a square factor of $d$ names the same field
    library: enumeratio-number-theory
    type: (integer) -> set<quadratic_integer>
seeAlso:
  - QuadraticInteger
  - GaussianIntegers
  - IsPrime
  - FactorInteger
catalog:
  - system: mathlib4
    identity: NumberField.RingOfIntegers
    url: https://leanprover-community.github.io/mathlib4_docs/Mathlib/NumberTheory/NumberField/Basic.html
  - system: sage
    identity: QuadraticField(d).ring_of_integers()
    url: https://doc.sagemath.org/html/en/reference/number_fields/sage/rings/number_field/number_field.html
bindings:
  - origin: mapped
    form: wolfram
    counterpart: false
    note: "Wolfram has no ring-of-integers value to pass as a domain: its number-theory heads take GaussianIntegers -> True for Z[i] only, and NumberFieldClassNumber and friends take an algebraic number, not a ring."
  - origin: mapped
    form: sage
    template: QuadraticField($1).ring_of_integers()
    arity: 1
---

- A value for the `Over` option: `IsPrime(x, Over -> QuadraticIntegers(-5))` asks whether $x$ is prime in $\mathbb{Z}[\sqrt{-5}]$. `IsPrime`, `IsComposite`, `FactorInteger`, `Divisors`, `PrimeNu`, `PrimeOmega`, `MoebiusMu` and `IsSquareFree` read it
- `QuadraticIntegers(-1)` is [[GaussianIntegers]], answered with the Gaussian conventions
- Primality holds in every ring: $x$ is prime when the ideal $(x)$ is prime. Most of these rings do not factor uniquely ($6 = 2 \cdot 3 = (1 + \sqrt{-5})(1 - \sqrt{-5})$ in $\mathbb{Z}[\sqrt{-5}]$), so `FactorInteger`, `Divisors` and the counting heads answer only where the class number is 1, and stay unevaluated elsewhere
- An irreducible that is not prime is not composite either: `IsComposite(2, Over -> QuadraticIntegers(-5))` is `False`, and so is `IsPrime`
- The guide [Quadratic integers](https://enumeratio.dev/docs/number-theory/quadratic-integers) draws these rings as lattices
