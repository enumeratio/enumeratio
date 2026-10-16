---
name: NthPrime
domain: Number theory
signature: NthPrime(n)
summary: The nth prime number (NthPrime(1) = 2).
signatures:
  - call: NthPrime(n)
    description: the $n$th prime, with $\mathrm{NthPrime}(1)=2$.
  - call: NthPrime(n)
    description: The nth prime number (NthPrime(1) = 2).
    library: enumeratio-number-theory
    type: (integer) -> integer
    overrides: compute-engine
seeAlso:
  - FactorInteger
  - PrimePi
references:
  - system: wikipedia
    identity: Prime number
  - system: oeis
    identity: A000040
names:
  wolfram: Prime
bindings:
  - origin: mapped
    form: sympy
    template: prime($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.14.0
      on: 2026-10-12
    note: prime(n) is SymPy's n-th prime.
  - origin: mapped
    form: sage
    template: nth_prime($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: nth_prime($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: primal 0.3.3
      on: 2026-10-16
---

- Inverse of [[PrimePi]]: $\pi(p_n)=n$.
- Grows asymptotically like $n\ln n$, by the prime number theorem.
- n must be a positive integer; compute-engine leaves non-positive n, including NthPrime(0), unevaluated.
- Threads element-wise over a list, as Wolfram's Listable heads do.
