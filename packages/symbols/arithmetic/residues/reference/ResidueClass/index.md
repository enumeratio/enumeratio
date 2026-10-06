---
name: ResidueClass
domain: Modular arithmetic
signature: ResidueClass(k, n)
summary: "$k \\bmod n$ as a VALUE — an element of $\\mathbb{Z}/n\\mathbb{Z}$ that arithmetic stays inside, after Sage's `Mod(a, m)`. compute-engine's head, strict about moduli: [[IntegerMod]] is its Sage-flavoured sibling."
signatures:
  - call: ResidueClass(k, n)
    description: the residue class of $k$, normalised into $[0, n)$
  - call: ResidueClass(u/v, n)
    description: a rational reads as $u \cdot v^{-1}$, when $v$ is a unit mod $n$
  - call: ResidueClass(ResidueClass(k, m), n)
    description: the same class read in $\mathbb{Z}/n\mathbb{Z}$, for $n \mid m$
    library: enumeratio-residues
    type: (any, any) -> value
    overrides: compute-engine
seeAlso:
  - IntegerMod
  - QuotientRing
  - Mod
  - ChineseRemainder
  - AdicNumeral
bindings:
  - origin: mapped
    form: wolfram
    counterpart: false
    note: "Wolfram's Mod/PowerMod answer a plain Integer, not a persistent ring element -- the same distinction this head's own details draw against our own [[Mod]]. FiniteField/FiniteFieldElement DOES keep a residue as a persistent value with +, ·, ^-1 (kernel-verified: FiniteField[7][3]+FiniteField[7][5] = FiniteFieldElement[.., {1}], FiniteField[7][3]^-1 = {5}, matching this head's own examples) -- but only for prime modulus; FiniteField[4] silently reinterprets 4 as GF(2^2), a different structure with no zero divisors, not the ring Z/4Z this head also supports (kernel-verified wrong for our composite-modulus examples), and FiniteField[6] errors outright. No single template is safe across this head's mixed prime/composite examples, so it stays unmapped for wolfram."
    checked:
      version: 15.0.0
      on: 2026-09-28
  - origin: mapped
    form: sage
    template: Mod($1, $2)
    arity: 2
    checked:
      version: "10.9"
      on: 2026-09-27
attributes:
  - HoldAll
---

- [[Mod]] answers an integer; `ResidueClass` IS the class, so `+`, `·`, `/` and powers of it are computed in $\mathbb{Z}/n\mathbb{Z}$ — a negative power inverts, and dividing by a non-unit leaves the call standing
- A bare integer or rational next to a class is read in the same ring
- Classes of different moduli never combine: the sum stays as written, so $x + y - y = x$ holds. Sage's coercion to $\mathbb{Z}/\gcd(m, n)$ is not followed; [[IntegerMod]] follows it
- [[ChineseRemainder]] of classes is the class mod $\operatorname{lcm}$ that reduces to each, and [[MultiplicativeOrder]] of a unit is its order
- The elements of [[QuotientRing]](Integers, n), $\mathbb{Z}/n\mathbb{Z}$
- Written $\overline{k}_{n}$; `a \pmod{n}` is read as a class too, `a \bmod n` is still [[Mod]], and `a \equiv b \pmod{n}` is still a congruence
- A call that declines — dividing by a non-unit — stays unevaluated with a `ResidueClass::ninv` message, after Wolfram's `PowerMod::ninv`
- [[IntegerMod]], the head's old name, is now the Sage-flavoured sibling: the same arithmetic, with classes of different moduli combined in $\mathbb{Z}/\gcd(m, n)$
