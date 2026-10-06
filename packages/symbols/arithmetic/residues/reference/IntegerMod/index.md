---
name: IntegerMod
domain: Modular arithmetic
signature: IntegerMod(k, n)
summary: "$k \\bmod n$ as a VALUE, after Sage's `Mod(k, n)`: [[ResidueClass]] whose classes of different moduli combine in $\\mathbb{Z}/\\gcd(m, n)$."
signatures:
  - call: IntegerMod(k, n)
    description: the class of $k$, normalised into $[0, n)$, as for ResidueClass(k, n)
    library: enumeratio-residues
    type: (any, any) -> value
  - call: IntegerMod(u/v, n)
    description: a rational reads as $u \cdot v^{-1}$, when $v$ is a unit mod $n$
seeAlso:
  - ResidueClass
  - QuotientRing
  - Mod
  - ChineseRemainder
bindings:
  - origin: mapped
    form: wolfram
    counterpart: false
    note: "Wolfram has no residue value that follows Sage's coercion: Mod/PowerMod answer a plain Integer, and FiniteField[n] keeps a residue as a persistent value but only for prime n (FiniteField[4] is GF(2^2), not Z/4Z), with no coercion between fields."
    checked:
      version: 15.0.0
      on: 2026-10-05
  - origin: mapped
    form: sage
    template: Mod($1, $2)
    arity: 2
    checked:
      version: "10.9"
      on: 2026-10-05
attributes:
  - HoldAll
---

- The Sage-flavoured sibling of [[ResidueClass]], which is compute-engine's strict head and never combines classes of two moduli. `IntegerMod` is built on it: same normalisation, same ring arithmetic, and `ChineseRemainder`, `MultiplicativeOrder` and membership in [[QuotientRing]](Integers, n) read it as the class it is
- Two classes meet in $\mathbb{Z}/\gcd(m, n)$, the largest ring both reduce to, and the answer lives there: $(2 \bmod 4) + (1 \bmod 6) = 1 \bmod 2$. This is Sage's coercion, and the divergence from compute-engine, which leaves that sum as written
- A bare integer next to a class is read in the class's ring, never the other way: $(2 \bmod 4) \cdot 5 = 2 \bmod 4$
- Equality and `!=` compare in the common ring too, so `IntegerMod(2, 4) == IntegerMod(0, 2)` is `True`
- Moduli with $\gcd = 1$ have no ring but the trivial one, which Sage rejects; the call stays as written. Dividing by a class that is not a unit in the common ring stays unevaluated too, with a `ResidueClass::ninv` message
- A `ResidueClass` next to an `IntegerMod` never combines: pick one head, as the two behaviours differ, and the sum stays as written
- [[Mod]] and `IntegerMod` differ: `Mod(17, 5)` is the remainder $2$, a plain number, while `IntegerMod(17, 5)` is the class $2 \bmod 5$ and keeps its modulus. Sage's `Mod(a, m)` builds a class, so it is `IntegerMod(a, m)` here, and compute-engine's `Mod` follows Wolfram's
- Written and read as $(a\;\mathrm{mod}\;m)$, fenced whole so sums and products of classes stay unambiguous. `a \pmod{n}` reads as [[ResidueClass]] and `a \bmod n` as [[Mod]], so type this form or the call to get an `IntegerMod`
