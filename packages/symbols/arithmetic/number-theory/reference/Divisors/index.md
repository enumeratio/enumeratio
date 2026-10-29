---
name: Divisors
domain: Number theory
signature: Divisors(n)
summary: All positive divisors of n, in increasing order.
signatures:
  - call: Divisors(n)
    description: all positive divisors of $n$, increasing.
  - call: Divisors(n, Over -> GaussianIntegers)
    description: the first-quadrant divisors in $\mathbb{Z}[i]$, by real part then imaginary
    library: enumeratio-number-theory
    type: (number | quadratic_integer, any*) -> list
    overrides: compute-engine
seeAlso:
  - FactorInteger
  - DivisorSigma
references:
  - system: wikipedia
    identity: Divisor
  - system: mathworld
    identity: Divisor
  - system: rosettacode
    identity: Proper divisors
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: oscar
    template: sort(divisors(ZZ($1)))
    arity: 1
  - origin: mapped
    form: sage
    template: enumeratio_divisors($1)
    arity: 1
  - origin: mapped
    form: sympy
    template: divisors($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.14.0
      on: 2026-10-12
    note: SymPy's divisors is over the integers (positive divisors of |n|); a Gaussian integer is not one, and the Over -> GaussianIntegers form has no counterpart.
  - origin: mapped
    form: julia
    template: sort(divisors(ZZ($1)))
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: mathlib4
    template: (Finset.sort (Nat.divisors $1))
    arity: 1
    note: Nat.divisors sorted ascending into a list; natural n only, with divisors 0 = the empty list.
---

- Includes both 1 and $n$ itself; a prime's only divisors are those two.
- The count of divisors, $d(n)$, equals $\sigma_0(n)$. See [[DivisorSigma]].
- Highly composite numbers (like 720) pack unusually many divisors relative to their size.
- compute-engine only returns ordinary positive divisors.
- Threads element-wise over a list, as Wolfram's Listable heads do.
