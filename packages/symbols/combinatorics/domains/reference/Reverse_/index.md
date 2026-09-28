---
name: Reverse_
domain: Combinatorial maps
signature: Reverse_(x)
summary: The private-name copy of compute-engine's own [[Reverse]], kept so its collection handlers survive being extended with a carrier-typed case; prints under this name only when a result on it stays unevaluated.
signatures:
  - call: Reverse_(x)
    description: the private-name copy of compute-engine's own [[Reverse]], kept so its collection handlers survive extension with a carrier-typed case
    library: enumeratio-domains
    type: "((T) -> T where T: string) & ((T) -> T where T: list) & ((indexed_collection<T>) -> list<T> where T)"
seeAlso:
  - Reverse
---
