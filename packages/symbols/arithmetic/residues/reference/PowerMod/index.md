---
name: PowerMod
domain: Modular arithmetic
signature: PowerMod(a, b, m)
summary: "Modular exponentiation: a^b mod m, computed without forming a^b directly."
signatures:
  - call: PowerMod(a, b, m)
    description: modular exponentiation, $a^b \bmod m$.
  - call: PowerMod(a, 1/r, m)
    description: the least $x \ge 0$ with $x^r \equiv a \pmod m$; more generally $s/r$ for $x^r \equiv a^s$
  - call: PowerMod(u/v, b, m)
    description: a rational base, read in $\mathbb{Z}/m$ as $u \cdot v^{-1}$, a list of bases, and an exponent of 0 at any modulus
    library: enumeratio-residues
    type: (number, number, number) -> number
    overrides: compute-engine
  - call: PowerMod(a, b, m)
    description: "Modular exponentiation: a^b mod m, computed without forming a^b directly."
    library: enumeratio-number-theory
    type: (number, number, number) -> number
    overrides: enumeratio-residues
seeAlso:
  - Mod
  - PowerModList
  - ModularInverse
references:
  - system: wikipedia
    identity: Modular exponentiation
  - system: rosettacode
    identity: Modular exponentiation
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: oscar
    template: powermod(ZZ($1), ZZ($2), ZZ($3))
    arity: 3
  - origin: mapped
    form: wolfram
    template: PowerMod[$1, $2, $3]
    arity: 3
    checked:
      version: 15.0.0
      on: 2026-09-28
    note: For a negative exponent and a Gaussian modulus m, Wolfram checks invertibility of a mod N(m) (a rational integer) rather than mod m itself, so it occasionally declines a case ours answers — e.g. PowerMod[11 - 7I, -4, 7 + 4I] errors since 11 - 7i shares a factor with N(7 + 4i) = 65, though gcd(11 - 7i, 7 + 4i) = 1.
  - origin: mapped
    form: sage
    template: enumeratio_power_mod($1, $2, $3)
    arity: 3
    note: Sage's power_mod takes a negative exponent, like ours; no rational base or exponent. The helper reduces into the sign of the modulus and runs over the Gaussian integers, where power_mod has no method.
  - origin: mapped
    form: rust
    template: powermod($1, $2, $3)
    arity: 3
    note: Sage's power_mod takes a negative exponent, like ours; no rational base or exponent.
  - origin: mapped
    form: sympy
    template: pow(ZZ.convert($1), ZZ.convert($2), ZZ.convert($3))
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    checked:
      version: 1.14.0
      on: 2026-10-12
    note: "SymPy has no PowerMod function; this is Python's three-argument pow over SymPy's ZZ integers (pure-Python ones, as the runner pins), which takes a negative exponent through the modular inverse and gives the result the sign of the modulus, where ours declines a modulus below 1 unless the exponent is 0. The emit varies with the operands: a rational exponent s/r is the least root of x^r = a^s through nthroot_mod, as PowerModList (None where there is no root); a symbolic, rational or Gaussian operand goes to pow on SymPy numbers, which holds it (Mod((2 + I)**2, 3)) or ignores the modulus for a rational base. A list threads over whichever argument holds it."
  - origin: mapped
    form: julia
    template: powermod(ZZ($1), ZZ($2), ZZ($3))
    arity: 3
    threadArgOnly:
      - 1
      - 2
      - 3
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---

- Computed by repeated squaring, without ever forming $a^b$ directly -- efficient even for huge $b$.
- A negative $b$ gives the modular inverse of $a$ raised to $|b|$, when it exists.
- The inverse is undefined whenever $\gcd(a,m)\neq1$; compute-engine leaves such calls unevaluated.
- Equal to $\mathrm{Mod}(a^b, m)$ for positive $b$, just far more efficient. See [[Mod]].
- A rational exponent $s/r$ gives the least $x$ with $x^r \equiv a^s$ — the first element of [[PowerModList]] — and stays unevaluated when there is none.
- Threads over lists in any argument.
- Gaussian integers are reduced as [[Mod]] reduces them; a rational-integer modulus must be positive, and a result that comes out real is reported in $[0, m)$.
