---
name: Attributes
domain: Collections
signature: Attributes(f)
summary: The Wolfram-named properties compute-engine tracks for a head's operator.
signatures:
  - call: Attributes(f)
    description: The subset of $\{Flat, HoldAll, Listable, Orderless\}$ $f$'s operator definition carries, and $Protected$ for a declared head, alphabetically.
    library: enumeratio-combinatorics
    type: (symbol) -> list<symbol>
seeAlso:
  - SetAttributes
  - ClearAttributes
names:
  wolframIdentity: true
attributes:
  - HoldAll
---

- Maps compute-engine's own operator flags to the closest genuine Wolfram attribute name, and no further: $associative \to Flat$, $lazy \to HoldAll$, $broadcastable \to Listable$, $commutative \to Orderless$.
- Compute-engine's `idempotent` and `involution` flags are deliberately excluded: real algebraic properties it tracks for pattern matching, but not Wolfram `Attributes` names — Wolfram has no such entries, so reporting them would claim a fact that doesn't exist.
- `HoldAll` for `lazy` is an approximation: compute-engine's `lazy` means "operands arrive unevaluated", the effect of Wolfram's `HoldAll` without distinguishing it from `HoldFirst`/`HoldRest`/`HoldAllComplete`.
- `Protected` is reported for every head we declare — compute-engine's own and every package's — and for no symbol of your own. Nothing sets or clears it: [[SetAttributes]] and [[ClearAttributes]] refuse on a protected head.
- An undeclared symbol reads as no attributes.
