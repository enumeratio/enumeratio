---
name: Derangements
domain: Combinatorial collections
signature: Derangements(n)
summary: The permutations of $\{1, \dots, n\}$ with no fixed point.
signatures:
  - call: Derangements(n)
    description: the fixed-point-free permutations of $n$ elements
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<permutation>
seeAlso:
  - SymmetricGroup
  - Involutions
  - Subfactorial
references:
  - system: wikipedia
    identity: Derangement
  - system: mathworld
    identity: Derangement
  - system: oeis
    identity: A000166
catalog:
  - system: mathlib4
    identity: derangements (Fin n)
    url: https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Derangements/Basic.html
    note: "exact: derangements α : Set (Equiv.Perm α), the permutations with no fixed point"
  - system: oeis
    identity: A000166
    url: https://oeis.org/A000166
  - system: sage
    identity: Derangements(n)
    url: https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/derangements.html
  - system: sympy
    identity: generate_derangements
    url: https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.generate_derangements
  - system: wikipedia
    identity: Derangement
    url: https://en.wikipedia.org/wiki/Derangement
    relation: conceptual
  - system: wolfram
    identity: Subfactorial
    url: https://reference.wolfram.com/language/ref/Subfactorial.html
grades:
  - name: size
    role: axis
carrier: Permutation
bindings:
  - origin: mapped
    form: combinatorica
    template: Derangements[Range[$1]]
    arity: 1
    note: Combinatorica lists the derangements of a permutation; ours are those of 1..n.
  - origin: mapped
    form: mathlib4
    template: "((((Finset.univ : Finset (derangements (Fin ($1 : ℕ))))).val.map (fun p => List.ofFn (fun i : Fin ($1 : ℕ) => (p.1 i).val + 1))).sort (· ≤ ·))"
    arity: 1
    note: "Mathlib's derangements of Fin n, each as a 1-based one-line list, in lexicographic order"
---

- Count is the subfactorial $!n$ (see [[Subfactorial]])
- A sub-family of [[SymmetricGroup]]
