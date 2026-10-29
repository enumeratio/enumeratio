---
name: ClearAttributes
domain: Collections
signature: ClearAttributes(f, attr)
summary: Turns off one of the Wolfram-named properties Attributes can report.
signatures:
  - call: ClearAttributes(f, attr)
    description: Turns $attr$ off for $f$'s operator definition, in place.
    library: enumeratio-combinatorics
    type: (symbol, any) -> any
  - call: ClearAttributes(f, {attr1, attr2, ...})
    description: Turns off several attributes at once.
    library: enumeratio-combinatorics
seeAlso:
  - Attributes
  - SetAttributes
names:
  wolframIdentity: true
attributes:
  - HoldAll
---

- The inverse of [[SetAttributes]], over the same $\{Flat, HoldAll, Listable, Orderless\}$. Declines (stays unevaluated) for an undeclared $f$ or any other attribute name.
- A declared head is `Protected`: `ClearAttributes` leaves the call unevaluated and says `ClearAttributes::write` (`Tag f in f is Protected.`), where Wolfram, whose `Protected` guards definitions rather than attributes, makes the change.
- Always returns $Nothing$, like Wolfram's own $Null$.
