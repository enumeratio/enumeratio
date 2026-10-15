---
name: Abundance
domain: Number theory
signature: Abundance(n)
summary: 'How far the divisors of n overshoot twice n: $\sigma(n) - 2n$.'
signatures:
  - call: Abundance(n)
    description: $\sigma(n) - 2n$, where $\sigma$ is the sum of the divisors of $|n|$.
    library: enumeratio-number-theory
    type: (integer) -> integer
seeAlso:
  - AliquotSum
  - DivisorSigma
  - IsPerfect
  - PerfectNumber
references:
  - system: wikipedia
    identity: Abundant number
  - system: mathworld
    identity: Abundance
  - system: oeis
    identity: A033880
bindings:
  - origin: mapped
    form: wolfram
    template: DivisorSigma[1, Abs[$1]] - 2 Abs[$1]
    arity: 1
    threadArg: 1
    note: Wolfram has no head for it; this is its definition, with the sign of n a unit.
  - origin: mapped
    form: sympy
    template: abundance(abs($1))
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.14.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: sigma(abs($1), 1) - 2*abs($1)
    arity: 1
    threadArg: 1
    note: Sage has no head for it; this is its definition, with the sign of n a unit.
---

- Positive for an abundant number, zero for a perfect one, negative for a deficient one.
- Defined on nonzero integers, with the sign of $n$ a unit as in [[DivisorSigma]]: $\mathrm{Abundance}(-n)=\mathrm{Abundance}(n)$. At 0 it stays unevaluated.
- $\mathrm{Abundance}(n) = \mathrm{AliquotSum}(n) - n$, which makes [[IsPerfect]] the test for 0.
- Neither Wolfram nor Sage names it; SymPy's `abundance` answers positive integers only.
