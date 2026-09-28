---
name: LabeledGraph
domain: Combinatorics
signature: LabeledGraph(...)
summary: As a single-graded labeled_graph
catalogCarrier: true
mapOn:
  - LabeledGraph
stub: carrier
signatures:
  - call: LabeledGraph(...)
    description: As a single-graded labeled_graph
    library: enumeratio-domains
    type: (tuple<integer, list<integer>>) -> labeled_graph
---
