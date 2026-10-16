---
name: DivisorSigma
domain: Number theory
signature: DivisorSigma(k, n)
summary: The sum of the kth powers of the divisors of n.
signatures:
  - call: DivisorSigma(k, n)
    description: sum of the $k$th powers of the divisors of $n$.
  - call: DivisorSigma(k, n)
    description: The sum of the kth powers of the divisors of n.
    library: enumeratio-number-theory
    type: (number, number, any*) -> number
    overrides: compute-engine
seeAlso:
  - Divisors
references:
  - system: wikipedia
    identity: Divisor function
  - system: mathworld
    identity: DivisorFunction
  - system: dlmf
    identity: "27.2"
names:
  dlmf: sum of powers of divisors of a number
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: divisor_sigma($2, $1)
    arity: 2
    threadArgOnly:
      - 2
      - 1
    checked:
      version: 1.14.0
      on: 2026-10-12
    note: SymPy's divisor_sigma takes (n, k), the reverse of our (k, n).
  - origin: mapped
    form: sage
    template: sigma($2, $1)
    arity: 2
    threadArgOnly:
      - 2
      - 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: divisor_sigma(ZZ($2), Int($1))
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---

- $k=0$ gives the divisor count $d(n)$; $k=1$ gives the ordinary sum of divisors.
- Multiplicative: $\sigma_k(mn)=\sigma_k(m)\sigma_k(n)$ whenever $\gcd(m,n)=1$.
- A perfect number $n$ satisfies $\sigma_1(n)=2n$, as with 6 and 28.
- A negative order sums reciprocal powers: $\sigma_{-k}(n) = \sigma_k(n)/n^k$.
