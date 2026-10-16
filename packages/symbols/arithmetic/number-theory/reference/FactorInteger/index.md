---
name: FactorInteger
domain: Number theory
signature: FactorInteger(n)
summary: The prime factorisation of n as a list of [prime, exponent] pairs.
signatures:
  - call: FactorInteger(n)
    description: prime factorization of $n$ as $[\mathrm{prime}, \mathrm{exponent}]$ pairs.
  - call: FactorInteger(n, Over -> GaussianIntegers)
    description: 'the factorisation in $\mathbb{Z}[i]$: a unit first when it is not 1, then first-quadrant primes; a complex $n$ is always factored there'
    library: enumeratio-number-theory
    type: (number | quadratic_integer, any*) -> list
    overrides: compute-engine
  - call: FactorInteger(n, Over -> QuadraticIntegers(d))
    description: the prime factorisation of $n$ in the ring of integers of $\mathbb{Q}(\sqrt d)$, where that ring factors uniquely
    library: enumeratio-number-theory
    type: (number | quadratic_integer, any*) -> list
    overrides: compute-engine
seeAlso:
  - NthPrime
  - Divisors
  - PrimeNu
  - PrimeOmega
references:
  - system: wikipedia
    identity: Integer factorization
  - system: mathworld
    identity: PrimeFactorization
  - system: rosettacode
    identity: Prime decomposition
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_factor_integer($1)
    arity: 1
    note: Sage has no unit factor for 1, 0 or a negative n — a shape difference from compute-engine's explicit 1^1/0^1/-1^1, not a bug.
  - origin: mapped
    form: sympy
    template: list(factorrat(S($1)).items())
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.14.0
      on: 2026-10-12
    note: "factorrat is SymPy's factorint that also takes a rational, giving the denominator's primes negative exponents as ours does. SymPy has no factor for 1, writes the -1 of a negative integer after the primes and a negative rational's between the numerator's primes and the denominator's, and lists factors in the order it finds them, which for a large n is not always ascending. A Complex operand is not emitted: factorrat takes rationals only."
  - origin: mapped
    form: julia
    template: enumeratio_factor_integer($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---

- For $n=p_1^{k_1}\cdots p_m^{k_m}$, returns the pairs $\{p_1,k_1\},\ldots,\{p_m,k_m\}$ in increasing order of prime.
- Multiplying the $p^e$ factors back together recovers $n$.
- compute-engine represents 1 as $1^1$ and 0 as $0^1$.
- Negative $n$ carries an explicit $-1^1$ unit factor ahead of the prime factors.
- compute-engine handles ordinary integers only.
