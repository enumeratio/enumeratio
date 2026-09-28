---
name: ModularClass
domain: The modular group
signature: ModularClass(word)
summary: "The canonical name of a conjugacy class: the lexicographically least rotation of its $LR$ word."
signatures:
  - call: ModularClass(word)
    description: the least rotation
    library: enumeratio-modular
    type: (expression<ModularMatrix> | list | string) -> string
seeAlso:
  - ModularClasses
  - ModularWord
---
