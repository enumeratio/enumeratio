---
name: OrbitInventory
domain: Permutations
signature: OrbitInventory(ci, {x1, x2, ...}, weights)
summary: Pólya's enumeration theorem. The inventory of the colorings a group acts on, up to the group, from a cycle index $Z$ and the weights of the colors, each $x_i$ becoming the power sum $p_i = \sum_j w_j^i$. A single number $k$ for the weights gives the count of $k$-colorings.
signatures:
  - call: OrbitInventory(ci, {x1, x2, ...}, {w1, w2, ...})
    description: the cycle index `ci`, in the variables `x_i`, with each `x_i` replaced by $w_1^i + w_2^i + \cdots$, expanded. The coefficient of $w_1^{a_1} w_2^{a_2} \cdots$ counts the colorings using color $j$ exactly $a_j$ times, up to the group
    library: enumeratio-groupalgebra
    type: (number, list, list | number) -> number
  - call: OrbitInventory(ci, {x1, x2, ...}, k)
    description: the cycle index `ci` with every `x_i` replaced by `k`, the number of colorings with $k$ colors up to the group
    library: enumeratio-groupalgebra
    type: (number, list, list | number) -> number
seeAlso:
  - CycleIndexPolynomial
  - KNecklaces
  - KBracelets
  - PermutationGroup
catalog:
  - system: combinatorica
    identity: OrbitInventory
    note: same value; Combinatorica's formal variable `x[i]` is the variable list here, because `CycleIndexPolynomial` names its variables.
bindings:
  - origin: mapped
    form: combinatorica
    template: Module[{v = $2}, OrbitInventory[ReplaceAll[$1, Thread[v -> Array[x, Length[v]]]], x, $3]]
    arity: 3
    note: our cycle index is in the variables listed, Combinatorica's in `x[i]`, so the template renames them first.
  - origin: mapped
    form: sage
    template: enumeratio_orbit_inventory($1, $2, $3)
    arity: 3
    note: Sage has no `OrbitInventory`; its `cycle_index()` with each `x_i` replaced by the power sum of the weights (or the number of colors) is the definition.
  - origin: mapped
    form: wolfram
    template: Module[{v = $2, w = $3}, Expand[ReplaceAll[$1, Thread[v -> Table[If[ListQ[w], Total[w^i], w], {i, Length[v]}]]]]]
    arity: 3
    note: Wolfram has no `OrbitInventory` (it is Combinatorica's); this is Pólya's substitution of the power sums of the weights, or of the number of colors, into the cycle index. `ReplaceAll` with a rule list is simultaneous, as ours is.
---

- Combinatorica's name and argument order, `OrbitInventory[ci, x, w]`, with the one difference that the second argument is the list of variables the cycle index is written in (what [[CycleIndexPolynomial]] was given), since ours has no indexed variable $x[i]$
- With a list of weights the answer is the expanded polynomial; with one number $k$ it is the cycle index at $x_i = k$, which is the same as $k$ weights of $1$. Either way it is Pólya's theorem: the cycle index of the group, with $x_i \to \sum_j w_j^i$
- The variables must be distinct symbols and the weights a nonempty list or a number, else the call stays unevaluated. A weight may share a name with a variable: the substitution is simultaneous
- Defined in Epsil as a substitution into the cycle index (the variables renamed apart, then replaced by the power sums and expanded); there is no kernel
- Every example here was checked against Combinatorica's `OrbitInventory[CycleIndex[group, x], x, w]` and Sage's `cycle_index()` with the same substitution. The oracle lane takes no free symbols, so the records hold no scan rows
- The count of necklaces and bracelets is [[KNecklaces]] and [[KBracelets]], whose own counts agree with this one: two colors give OEIS A000031 under $C_n$ and A000029 under $D_n$. A group with no named head, like the rotations of a cube, goes through [[PermutationGroup]]
