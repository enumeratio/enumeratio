---
name: OrderOfElement
domain: Structures
signature: OrderOfElement(g)
summary: The order of a group element, the least n ≥ 1 with $g^n$ the identity, or Infinity when there is none.
signatures:
  - call: OrderOfElement(g)
    description: The `Monoid` protocol's member for the order of an element, answered by whichever type g belongs to.
    library: enumeratio-structures
    type: (any) -> unknown
  - call: OrderOfElement(g)
    description: The order of a group element, the least n ≥ 1 with $g^n$ the identity, or Infinity when there is none.
    library: enumeratio-residues
    type: (any) -> unknown
    overrides: enumeratio-structures
    on:
      - IntegerMod
      - ResidueClass
seeAlso:
  - PermutationOrder
  - MultiplicativeOrder
references:
  - system: wikipedia
    identity: Order (group theory)
  - system: mathworld
    identity: GroupOrder
catalog:
  - system: mathlib4
    identity: orderOf
    url: https://leanprover-community.github.io/mathlib4_docs/Mathlib/GroupTheory/OrderOfElement.html
    note: orderOf answers 0 for an element of infinite order; OrderOfElement answers Infinity. GAP's Order is the same head.
---

- The `Monoid` protocol's member: a type conforms by saying how it finds the order of one of its values. Not named `Order`, which is Wolfram's comparison `Order[a, b]`.
- A permutation's order is the lcm of its cycle lengths: [[PermutationOrder]]'s value.
- A unit of $\mathbb{Z}/m$, a `ResidueClass`, has [[MultiplicativeOrder]]'s value. A non-unit has no order (no power of it reaches 1) and stays unevaluated.
- Among the exact numbers, only roots of unity have finite order: 1 has order 1, $-1$ has order 2, $i$ and $-i$ have order 4, and every other rational or Gaussian rational has infinite order. An inexact or symbolic number stays unevaluated.
- A matrix stays unevaluated: finite order is detectable by repeated multiplication, but infinite order is not, so none is guessed.
