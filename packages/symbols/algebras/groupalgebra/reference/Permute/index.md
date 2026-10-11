---
name: Permute
domain: Permutations
signature: Permute(list, perm)
summary: Move the item at position $i$ of `list` to position $\sigma(i)$, for a permutation `perm` given as [[Cycles]] or a one-line word. Given a [[PermutationGroup]] instead, returns `list` permuted by every element of the group.
signatures:
  - call: Permute(list, perm)
    description: list with position $i$ moved to $\sigma(i)$
    library: enumeratio-groupalgebra
    type: (list<any>, expression<Cycles> | expression<PermutationGroup> | list<integer>) -> list<any> | list<list<any>>
  - call: Permute(list, group)
    description: one permuted copy of `list` per element of `group`
    library: enumeratio-groupalgebra
seeAlso:
  - Cycles
  - PermutationCycles
  - PermutationGroup
  - GroupElements
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: combinatorica
    template: If[ListQ[$2] && PermutationQ[$2] && Length[$1] == Length[$2], Permute[$1, InversePermutation[$2]], Missing["NotCombinatorica"]]
    arity: 2
    note: Combinatorica's Permute applies the inverse of the permutation ours applies. Covered for a one-line permutation of the same length, not Cycles or a padded word.
---

- `Permute` and [[PermutationCycles]]/[[InversePermutation]] all read $\sigma$ the same way: a one-line word `{v1, ..., vn}` means $\sigma(i) = v_i$
- A cycle or one-line word longer than `list` leaves the call unevaluated — there is nowhere for the extra positions to go
- The `PermutationGroup` form orders its output the way [[GroupElements]] orders that group
