---
name: SquarePartRoot
domain: Number theory
signature: SquarePartRoot(n)
summary: 'The root $s$ of the square part of $n=\pm s^2 q$: the largest $s$ with $s^2$ dividing $n$.'
signatures:
  - call: SquarePartRoot(n)
    description: $s$ in $|n|=s^2 q$ with $q$ square-free; the largest $s$ whose square divides $n$.
    library: enumeratio-number-theory
    type: (integer) -> integer
seeAlso:
  - SquareFreePart
  - IsSquareFree
  - FactorInteger
  - IntegerExponent
references:
  - system: oeis
    identity: A000188
bindings:
  - origin: mapped
    form: wolfram
    template: Function[n, Times @@ (First[#]^Quotient[Last[#], 2] & /@ FactorInteger[Abs[n]]), Listable][$1]
    arity: 1
    threadArg: 1
    note: Wolfram has no head for it; this is its definition over FactorInteger, with the sign of n a unit.
  - origin: mapped
    form: sage
    template: isqrt(abs($1)//abs($1).squarefree_part())
    arity: 1
    threadArg: 1
    note: Sage has no head for it; $s=\sqrt{n/q}$ from its squarefree_part, reading |n|.
---

- Every nonzero integer is $\pm s^2 q$ for a unique $s\ge1$ and square-free $q\ge1$; this is $s$, and [[SquareFreePart]] is $q$. $n$ is square-free exactly when $s=1$.
- The sign is a unit, as in [[PrimeOmega]]: $\mathrm{SquarePartRoot}(-12)=2$. Defined on nonzero integers; 0 stays unevaluated.
- Halves every exponent in the factorization of $|n|$, rounding down.
