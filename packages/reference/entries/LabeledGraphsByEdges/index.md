---
name: LabeledGraphsByEdges
domain: Combinatorics
signature: LabeledGraphsByEdges(...)
summary: Graphs on [n] with exactly m edges — the (n,m) refinement of labeled_graphs.
grades:
  - name: n
    role: axis
  - name: m
    role: axis
carrier: LabeledGraph
stub: carrier
signatures:
  - call: LabeledGraphsByEdges(...)
    description: Graphs on [n] with exactly m edges — the (n,m) refinement of labeled_graphs.
    library: enumeratio-collections
    type: (integer<0..>, integer<0..>) -> indexed_collection<list<list<integer>>>
---
