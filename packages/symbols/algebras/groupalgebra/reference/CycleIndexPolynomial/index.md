---
name: CycleIndexPolynomial
domain: Permutations
signature: CycleIndexPolynomial(group, {x1, x2, ...})
summary: The cycle index $Z(G) = \frac{1}{|G|}\sum_{g \in G} \prod_i x_i^{c_i(g)}$ of a permutation group, with $c_i(g)$ the number of $i$-cycles of $g$ and $x_i$ the $i$th variable. Evaluated at $x_i = k$ it counts the colorings with $k$ colors up to the group (Pólya).
signatures:
  - call: CycleIndexPolynomial(group, {x1, x2, ...})
    description: the cycle index of `group` in the variables `x1, x2, ...`, `x_i` marking the cycles of length $i$
    library: enumeratio-groupalgebra
    type: (expression<AlternatingGroup> | expression<CyclicGroup> | expression<DihedralGroup> | expression<GroupDirectProduct> | expression<PermutationGroup> | expression<SymmetricGroup> | indexed_collection<list<integer>>, list) -> number
seeAlso:
  - GroupOrder
  - GroupElements
  - PermutationGroup
  - CyclicGroup
  - DihedralGroup
  - KNecklaces
  - KBracelets
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: combinatorica
    template: With[{g = $1}, If[MatchQ[g, {{__Integer}..}], Module[{v = $2}, ReplaceAll[CycleIndex[g, x], Thread[Array[x, Length[v]] -> v]]], Missing["NotCombinatorica"]]]
    arity: 2
    note: Combinatorica's groups are lists of permutations, which core `CycleIndexPolynomial` does not take; its `CycleIndex` is in `x[i]`, renamed to the variable list here. Covered for the groups Combinatorica builds (a list of one-line permutations), not a `PermutationGroup` of Cycles, which its `GroupElements` rejects.
---

- The groups act as Wolfram's do: [[CyclicGroup]] and [[DihedralGroup]] on the $n$ vertices of an $n$-gon (rotations, and with the reflections), [[SymmetricGroup]] and [[AlternatingGroup]] on $n$ points, a [[PermutationGroup]] on the points it moves. $D_1$ swaps two points and $D_2$ is the Klein four-group on four points
- Those four are summed by closed formulas, not by listing their elements (the symmetric and alternating groups run over the partitions of $n$, up to $n = 35$); a [[PermutationGroup]] is listed
- The variable list must reach the group's degree, or the call stays unevaluated (Wolfram answers with a polynomial in the wrong variables); extra variables are ignored
- Pólya's count: setting every $x_i$ to $k$ gives the colorings with $k$ colors up to the group. For $C_n$ that is the necklace count of [[KNecklaces]], for $D_n$ the bracelet count of [[KBracelets]]
