---
name: ModularInverse
domain: Modular arithmetic
signature: ModularInverse(a, m)
summary: The $x$ with $a x \equiv 1 \pmod m$, when $a$ is a unit mod $m$.
signatures:
  - call: ModularInverse(a, m)
    description: the inverse of $a$ modulo $m$, in $[0, m)$
  - call: ModularInverse(z, m)
    description: over the Gaussian integers
    library: enumeratio-number-theory
    type: (number, number) -> number
    overrides: compute-engine
details:
  - Exists exactly when $\gcd(a, m)$ is a unit; the call is otherwise left unevaluated.
  - Read off the Bézout coefficient of [[ExtendedGCD]].
  - For Gaussian integers, Wolfram reduces the inverse into $[0, m)$ part by part for a positive rational-integer $m$, and as [[Mod]] does otherwise.
seeAlso:
  - PowerMod
  - ExtendedGCD
  - PowerModList
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: wolfram
    template: ModularInverse[$1, $2]
    arity: 2
    checked:
      version: 15.0.0
      on: 2026-09-28
    note: "Wolfram's own ModularInverse (not PowerMod[a, -1, m]): PowerMod's negative-exponent path checks invertibility of a mod the NORM of a Gaussian m, not m itself, and wrongly declines some invertible cases ModularInverse gets right — e.g. ModularInverse(11 - 7i, 7 + 4i) = -1 + 2i, where PowerMod[11 - 7I, -1, 7 + 4I] errors because 11 - 7i shares a factor with N(7 + 4i) = 65."
  - origin: mapped
    form: sage
    template: inverse_mod($1, $2)
    arity: 2
---
