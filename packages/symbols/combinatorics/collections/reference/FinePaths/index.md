---
name: FinePaths
domain: Collections
signature: FinePaths(n)
summary: Dyck paths of semilength $n$ with no hills — an elementary up/down step touching the ground on both sides.
signatures:
  - call: FinePaths(n)
    description: Dyck paths of semilength $n$ with no hills — an elementary up/down step touching the ground on both sides
    library: enumeratio-collections
    type: (integer<0..>) -> indexed_collection<list<integer>>
details:
  - Count is the Fine number (A000957).
seeAlso:
  - DyckPaths
references:
  - system: oeis
    identity: A000957
grades:
  - name: n
    role: axis
carrier: DyckPath
---
