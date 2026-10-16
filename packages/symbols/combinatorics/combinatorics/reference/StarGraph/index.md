---
name: StarGraph
domain: Collections
signature: StarGraph(n)
summary: The star graph on $n$ vertices — one centre joined to $n - 1$ leaves.
signatures:
  - call: StarGraph(n)
    description: vertex 1 is the centre, joined to vertices $2, \dots, n$.
    library: enumeratio-combinatorics
    type: (integer) -> value
seeAlso:
  - PathGraph
  - CompleteKaryTree
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_graph(graphs.StarGraph($1 - 1))
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
