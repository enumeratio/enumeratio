---
name: SternBrocotPath
domain: The modular group
signature: SternBrocotPath(p, q)
summary: "The Stern–Brocot path of a positive rational $p/q$: its sequence of left and right turns down the tree from $1/1$."
signatures:
  - call: SternBrocotPath(p, q)
    description: the path, as a word of $L$s and $R$s
    library: enumeratio-modular
    type: (integer, integer) -> string
seeAlso:
  - FromSternBrocotPath
  - ModularWord
---
