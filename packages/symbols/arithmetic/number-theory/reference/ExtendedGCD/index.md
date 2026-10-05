---
name: ExtendedGCD
domain: Number theory
signature: ExtendedGCD(a, b, …)
summary: The GCD of the arguments together with Bézout coefficients x₁, x₂, … such that a₁·x₁ + a₂·x₂ + … = GCD(a₁, a₂, …).
signatures:
  - call: ExtendedGCD(a, b)
    description: $\gcd(a,b)$ together with Bézout coefficients $x,y$ satisfying $ax+by=\gcd(a,b)$.
  - call: ExtendedGCD(a, b, c, …)
    description: $\gcd$ of any number of arguments, together with one Bézout coefficient per argument, folded pairwise from the two-argument case.
    library: enumeratio-number-theory
    type: (number, number*) -> tuple
    overrides: compute-engine
seeAlso:
  - GCD
references:
  - system: wikipedia
    identity: Extended Euclidean algorithm
  - system: rosettacode
    identity: Modular inverse
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: wolfram
    template: ExtendedGCD[$1, $2]
    arity: 2
    checked:
      version: 15.0.0
      on: 2026-09-28
    note: "Shape difference, not a value one: Wolfram's ExtendedGCD returns {g, {s, t}}, nested; ours returns the flat Tuple(g, s, t) compute-engine's own Tuple head calls for. The Bezout coefficients also aren't unique, so an occasional case lands on another valid (s, t) pair than Wolfram's Euclid would pick; ours still satisfies s*a + t*b = g."
---

- Implements the extended Euclidean algorithm, the standard way to compute modular inverses. See [[PowerMod]].
- The coefficients are not unique; the algorithm returns one particular solution, by folding the two-argument case pairwise across the arguments left to right.
- When $a=0$, the coefficients reduce to $x=0,\,y=1$.
