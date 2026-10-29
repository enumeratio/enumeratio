---
name: IntegerLength
domain: Numeral systems
signature: IntegerLength(n, base?)
summary: The number of digits of $n$ in the given base — base 10 by default.
signatures:
  - call: IntegerLength(n)
    description: the number of base-10 digits of $n$
    library: enumeratio-numerals
    type: (integer, integer?) -> integer
  - call: IntegerLength(n, base)
    description: the number of digits in the given base
seeAlso:
  - IntegerDigits
  - IntegerReverse
  - IntegerString
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: mathlib4
    template: ((Nat.digits 10 $1).length)
    arity: 1
    note: The length of Nat.digits, which is [] at 0, so 0 has length 0 as ours; natural n only.
  - origin: mapped
    form: mathlib4
    template: ((Nat.digits $2 $1).length)
    arity: 2
    note: As the one-argument row, in an integer base.
---

- The sign of $n$ is not counted — `IntegerLength(-123)` is 3, same as `IntegerLength(123)`
- `IntegerLength(0)` is 0, unlike [[IntegerDigits]]'s one-element `{0}` — there is no shortest numeral for 0, only the empty one
