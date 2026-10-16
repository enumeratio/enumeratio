---
name: PermutationSupport
domain: Permutation statistics
signature: PermutationSupport(p)
summary: The points $p$ moves, in increasing order.
statOn:
  - Permutation
signatures:
  - call: PermutationSupport(p)
    description: The points $p$ moves, in increasing order.
    library: enumeratio-combinatorics
    type: (permutation) -> list<integer>
references:
  - system: wolfram
    identity: PermutationLength
    url: https://reference.wolfram.com/language/ref/PermutationLength.html
    note: Length(PermutationSupport(p))
    relation: aggregate
  - system: wolfram
    identity: PermutationMax
    url: https://reference.wolfram.com/language/ref/PermutationMax.html
    note: Max(0, PermutationSupport(p)) — Max of the empty support is not 0
    relation: aggregate
  - system: wolfram
    identity: PermutationMin
    url: https://reference.wolfram.com/language/ref/PermutationMin.html
    note: Min(Infinity, PermutationSupport(p)) — Min of the empty support is not infinity here
    relation: aggregate
  - system: findstat
    identity: St000673
    url: https://www.findstat.org/St000673
    note: Length(PermutationSupport(p)), the number of non-fixed points; agrees on every value tried
    relation: aggregate
names:
  wolframIdentity: true
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Wolfram's `Cycles` input is not read here: wrap a one-line word in `Permutation`, or turn `Cycles` into one with [[PermutationList]] first
- The identity has an empty support. Its size, largest and smallest points are `Length`, `Max` and `Min` of it: Wolfram's PermutationLength, PermutationMax and PermutationMin are not heads here
- `Max` and `Min` of an empty list are NaN in compute-engine, not Wolfram's −∞ and ∞. Wolfram's PermutationMax and PermutationMin of the identity are 0 and ∞, so those compositions carry the bound: `Max(0, …)` and `Min(Infinity, …)`
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
