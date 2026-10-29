---
name: Involutions
domain: Combinatorial collections
signature: Involutions(n)
summary: The self-inverse permutations of $\{1, \dots, n\}$ (only fixed points and 2-cycles).
signatures:
  - call: Involutions(n)
    description: the self-inverse permutations of $n$ elements
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<permutation>
seeAlso:
  - SymmetricGroup
  - Derangements
references:
  - system: wikipedia
    identity: Involution (mathematics)
  - system: mathworld
    identity: PermutationInvolution
  - system: oeis
    identity: A000085
catalog:
  - system: oeis
    identity: A000085
    url: https://oeis.org/A000085
  - system: sympy
    identity: generate_involutions
    url: https://docs.sympy.org/latest/modules/utilities/iterables.html#sympy.utilities.iterables.generate_involutions
    note: 0-indexed tuples, shift +1
  - system: wikipedia
    identity: Involution (mathematics)
    url: https://en.wikipedia.org/wiki/Involution_(mathematics)
    relation: conceptual
grades:
  - name: size
    role: axis
carrier: Permutation
bindings:
  - origin: mapped
    form: combinatorica
    template: Involutions[Range[$1]]
    arity: 1
    note: Combinatorica lists the involutions of a permutation; ours are those of 1..n.
  - origin: mapped
    form: mathlib4
    template: "((((Finset.univ : Finset (Equiv.Perm (Fin ($1 : ℕ)))).filter (fun p => p * p = 1)).val.map (fun p => List.ofFn (fun i : Fin ($1 : ℕ) => (p i).val + 1))).sort (· ≤ ·))"
    arity: 1
    note: The permutations of Fin n with p * p = 1, each as a 1-based one-line list, in lexicographic order
---

- Count satisfies $a(n) = a(n-1) + (n-1)\,a(n-2)$
- A sub-family of [[SymmetricGroup]]
