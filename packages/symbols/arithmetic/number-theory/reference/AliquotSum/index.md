---
name: AliquotSum
domain: Number theory
signature: AliquotSum(n)
summary: 'The sum of the proper divisors of n: $\sigma(n) - n$.'
signatures:
  - call: AliquotSum(n)
    description: $s(n)=\sigma(n) - n$, the sum of the divisors of $|n|$ other than $|n|$ itself.
    library: enumeratio-number-theory
    type: (integer) -> integer
seeAlso:
  - Abundance
  - DivisorSigma
  - Divisors
  - IsPerfect
references:
  - system: wikipedia
    identity: Aliquot sum
  - system: mathworld
    identity: RestrictedDivisorFunction
  - system: oeis
    identity: A001065
bindings:
  - origin: mapped
    form: wolfram
    template: DivisorSigma[1, Abs[$1]] - Abs[$1]
    arity: 1
    threadArg: 1
    note: Wolfram has no head for it; this is its definition, with the sign of n a unit.
  - origin: mapped
    form: sympy
    template: divisor_sigma(abs($1)) - abs($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.14.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: sigma(abs($1), 1) - abs($1)
    arity: 1
    threadArg: 1
    note: Sage has no head for it; this is its definition, with the sign of n a unit.
---

- A prime has aliquot sum 1, and $s(1)=0$ since 1 has no proper divisor.
- Defined on nonzero integers, with the sign of $n$ a unit, as in [[PrimeOmega]]: $s(-n)=s(n)$. At 0 it stays unevaluated.
- Iterating $s$ gives the aliquot sequence; $n$ is perfect when $s(n)=n$, and $m, n$ are amicable when $s(m)=n$ and $s(n)=m$.
- Neither Wolfram, Sage nor SymPy names it.
