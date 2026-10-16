---
name: HypercubeGraph
domain: Collections
signature: HypercubeGraph(n)
summary: The $n$-dimensional hypercube graph — $2^n$ vertices (bit strings), edges between strings differing in one bit.
signatures:
  - call: HypercubeGraph(n)
    description: vertex $i$ (1-based) labels the bit pattern $i - 1$; edges join patterns at Hamming distance 1.
    library: enumeratio-combinatorics
    type: (integer) -> value
seeAlso:
  - GridGraph
  - CompleteGraph
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_graph(graphs.CubeGraph($1))
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
