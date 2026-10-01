---
name: Finset
domain: Collections
signature: Finset(tuple)
summary: The singular-inhabitant constructor for a subset of $\{1, \dots, n\}$, as $n$ and its members.
catalogCarrier: true
signatures:
  - call: Finset(tuple)
    description: The singular-inhabitant constructor for a subset of $\{1, \dots, n\}$, as $n$ and its members.
    library: enumeratio-combinatorics
    type: ((tuple<integer, list<integer>>) -> finset) & ((binary_word) -> finset)
laws:
  - inverse: BinaryWord
---

- A [[Subsets]] element: `Finset(Tuple(n, members))`, the members ascending.
- `Finset(word)` reads a characteristic word: the positions holding 1. Over [[BinaryWords]], that lists the subsets of $\{1, \dots, n\}$ in their words' order, where [[Subsets]] lists them by size, then lex.
