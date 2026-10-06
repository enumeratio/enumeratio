---
name: Insert
domain: Compute engine
signature: Insert(indexed_collection<T>, integer, T) -> list<T> where T
summary: Return a copy of the indexed collection with `value` inserted before the 1-based `index`. `index` may range from 1 to n+1 (n+1 appends). A negative index counts from the end, with -1 appending at the end (Elixir semantics). An out-of-range, zero, or non-integer index leaves the expression unevaluated.
signatures:
  - call: Insert(indexed_collection<T>, integer, T) -> list<T> where T
    description: as compute-engine declares it
stub: engine
names:
  wolframIdentity: true
---
