---
name: ComposeApply
domain: Combinatorial maps
signature: ComposeApply(steps, subject)
summary: The fold behind [[Compose]] — applies the head names in `steps` to `subject` right to left, each through its own declared head so every intermediate value stays a properly typed carrier.
signatures:
  - call: ComposeApply(steps, subject)
    description: apply `steps` (a list of head names) to `subject` right to left, one declared head at a time
    library: enumeratio-domains
    type: (list<any>, any) -> any
seeAlso:
  - Compose
---
