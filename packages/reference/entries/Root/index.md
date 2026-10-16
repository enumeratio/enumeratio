---
name: Root
domain: Arithmetic
signature: Root(x, n)
summary: 'The nth root of x: $\sqrt[n]{x} = x^{1/n}$.'
signatures:
  - call: Root(x, n)
    description: the nth root $\sqrt[n]{x} = x^{1/n}$.
seeAlso:
  - Sqrt
  - Square
references:
  - system: wikipedia
    identity: Nth root
  - system: mathworld
    identity: nthRoot
bindings:
  - origin: mapped
    form: mpmath
    template: (-root(-($1), $2) if im($1) == 0 and re($1) < 0 and ($2) % 2 == 1 else root($1, $2))
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.3.0
      on: 2026-10-15
    note: An odd root of a negative real is the real one, as ours; mpmath's root is the principal root.
  - origin: mapped
    form: sage
    template: real_nth_root($1, $2)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: "10.9"
      on: 2026-10-16
---

- The nth root: $\mathrm{Root}(x, n) = x^{1/n}$. See [[Sqrt]] for the special case $n = 2$.
- Odd roots of a negative number stay real: $\sqrt[3]{-8} = -2$. Even roots of a negative number canonicalize toward [[Sqrt]] instead, and evaluate exactly only when the radicand is itself a perfect power.
- A negative index gives the reciprocal root: $\mathrm{Root}(x, -n) = x^{-1/n}$.
- Both arguments are required -- unlike [[Sqrt]], there's no default index.
- Evaluates exactly only when x is a perfect nth power; otherwise it stays in symbolic form, like $\sqrt[3]{2}$.
