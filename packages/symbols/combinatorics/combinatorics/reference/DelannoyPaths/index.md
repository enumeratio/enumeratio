---
name: DelannoyPaths
domain: Collections
signature: DelannoyPaths(n)
summary: Lattice paths from $(0,0)$ to $(n,n)$ using East, North, and Diagonal steps.
signatures:
  - call: DelannoyPaths(n)
    description: Lattice paths from $(0,0)$ to $(n,n)$ using East, North, and Diagonal steps
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - DyckPaths
references:
  - system: oeis
    identity: A001850
catalog:
  - system: oeis
    identity: A001850
    url: https://oeis.org/A001850
grades:
  - name: n
    role: axis
carrier: DelannoyPath
---

- Count is the central Delannoy number (A001850).
