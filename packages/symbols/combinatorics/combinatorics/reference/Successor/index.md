---
name: Successor
domain: Collections
signature: Successor(collection, x)
summary: The element after $x$ in the collection's own order.
signatures:
  - call: Successor(collection, x)
    description: the element of `collection` that follows `x`, that is $At(collection, k + 1)$ where `x` is the $k$-th element.
    library: enumeratio-combinatorics
    type: (indexed_collection<any>, any) -> unknown
seeAlso:
  - At
  - IndexOf
  - Count
  - Mod
  - KSubsets
  - SymmetricGroup
  - IntegerPartitions
catalog:
  - system: combinatorica
    identity: NextPermutation
    note: Successor(SymmetricGroup(n), p), in lexicographic order.
  - system: combinatorica
    identity: NextPartition
    note: Successor(IntegerPartitions(n), p).
  - system: combinatorica
    identity: NextComposition
    note: Successor(WeakCompositions(n, k), c) where the orders agree; ours is not lexicographic.
  - system: combinatorica
    identity: NextKSubset
    note: Successor(KSubsets(n, k), s).
  - system: combinatorica
    identity: NextSubset
    note: Successor(Subsets(n), s), by size and then lexicographically.
  - system: combinatorica
    identity: NextLexicographicSubset
    note: no counterpart; the lexicographic order of all subsets is not a collection here.
  - system: combinatorica
    identity: NextTableau
    note: Successor(StandardTableaux(n), t) within one shape.
  - system: combinatorica
    identity: NextBinarySubset
    note: Successor(BinaryStrings(n), w), reading a word as the set of its 1 positions.
  - system: combinatorica
    identity: NextGrayCodeSubset
    note: Successor(GrayCodeSubsets(n), s); NextGrayCodeSubset follows our order for the first six subsets of 1..3, then goes wrong.
bindings:
  - origin: mapped
    form: combinatorica
    template: Module[{c = $1, x = $2, n, m, ind, refl}, n = Round[Log[2, Length[c]]]; m = Max[Append[Flatten[c], 0]]; ind[s_] := Table[Boole[MemberQ[s, i]], {i, n}]; refl[s_] := Sort[n + 1 - s]; Which[c === Permutations[Range[Length[x]]], NextPermutation[x], c === Partitions[Total[x]], NextPartition[x], c === Compositions[Total[x], Length[x]], NextComposition[x], c === Flatten[Map[Tableaux, Partitions[Length[Flatten[x]]]], 1], NextTableau[x], c === Subsets[Range[n]], NextSubset[Range[n], x], c === KSubsets[Range[m], Length[x]], NextKSubset[Range[m], x], c === Map[ind, BinarySubsets[Range[n]]], ind[NextBinarySubset[Range[n], Flatten[Position[x, 1]]]], c === Map[refl, GrayCodeSubsets[Range[n]]], NextGrayCodeSubset[Range[n], x], True, Missing["NotCombinatorica"]]]
    arity: 2
    note: One head for Combinatorica's Next* functions. The template recognizes the collection by its Combinatorica listing and calls the matching function, which wraps around at the last element where ours stays unevaluated; the collection and element are otherwise read as the family bindings read them.
---

- The next element in the collection's order, by rank: $Successor(c, x) = At(c, k + 1)$ where $k$ is the position of $x$ in $c$. Families rank by arithmetic, so the call never builds the collection: the successor of the second-to-last permutation of twelve things is immediate.
- Past the last element it stays unevaluated, and so does an $x$ that is not an element of $c$. There is no wraparound: write it with [[At]] and [[Mod]], as in $At(c, Mod(IndexOf(c, x), Count(c)) + 1)$.
- Defined in Epsil as `At` at the position `IndexOf` finds, one on; a declared family answers by its rank kernel, and `tests/successor.test.ts` holds the two together at every element of several small families.
- The order is the collection's own: lexicographic for [[KSubsets]] and [[SymmetricGroup]], largest part first for [[IntegerPartitions]], and each family's record says the rest. Combinatorica's nine `Next*` functions are this one head over its listing orders; they wrap at the end, and `NextTableau` stays inside one shape where [[StandardTableaux]] goes on to the next.
- Also reads a plain list: $Successor({5, 7, 9}, 7)$ is $9$.
- Not a Wolfram head: Wolfram has no successor of a collection element.
