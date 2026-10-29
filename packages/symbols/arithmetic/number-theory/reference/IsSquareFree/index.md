---
name: IsSquareFree
domain: Number theory
signature: IsSquareFree(n)
summary: Tests whether n has no repeated prime factors.
signatures:
  - call: IsSquareFree(n)
    description: tests whether $n$ has no repeated prime factor.
  - call: IsSquareFree(f)
    description: for a polynomial $f$, whether it has no repeated irreducible factor.
    library: enumeratio-number-theory
    type: (expression | number | quadratic_integer, any*) -> boolean
    overrides: compute-engine
  - call: IsSquareFree(f, x)
    description: whether $f$ has no repeated factor as a polynomial in $x$ alone.
    library: enumeratio-number-theory
seeAlso:
  - MoebiusMu
  - FactorInteger
references:
  - system: wikipedia
    identity: Square-free integer
  - system: mathworld
    identity: Squarefree
  - system: oeis
    identity: A005117
names:
  wolfram: SquareFreeQ
bindings:
  - origin: mapped
    form: sage
    template: is_squarefree($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: is_squarefree(ZZ($1))
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: is_square_free($1)
    arity: 1
    threadArgOnly: 1
    note: Every exponent of the factorization is 1.
    checked:
      version: primal 0.3.3
      on: 2026-10-16
  - origin: mapped
    form: sympy
    template: (mobius(abs($1)) != 0 if $1 != 0 else False)
    arity: 1
    threadArgOnly:
      - 1
    checked:
      version: 1.14.0
      on: 2026-10-28
  - origin: mapped
    form: mathlib4
    template: "(decide (Squarefree ($1 : ℕ)))"
    arity: 1
    note: Squarefree on the natural numbers, so Squarefree 0 is false and a negative n fails to typecheck.
---

- An integer is squarefree if it is divisible by no perfect square other than 1.
- Every prime is squarefree; 1 is vacuously squarefree.
- Equivalent to $\mu(n)\neq0$. See [[MoebiusMu]].
- Returns False unless $n$ is provably squarefree.
