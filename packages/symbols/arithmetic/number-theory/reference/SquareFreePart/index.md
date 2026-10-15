---
name: SquareFreePart
domain: Number theory
signature: SquareFreePart(n)
summary: 'The square-free part $q$ of $n=\pm s^2 q$: the product of the primes dividing $n$ to an odd power.'
signatures:
  - call: SquareFreePart(n)
    description: $q$ in $|n|=s^2 q$ with $q$ square-free; the sign of $n$ is a unit and is dropped.
    library: enumeratio-number-theory
    type: (integer) -> integer
seeAlso:
  - SquarePartRoot
  - IsSquareFree
  - FactorInteger
  - MoebiusMu
references:
  - system: wikipedia
    identity: Square-free integer
  - system: oeis
    identity: A007913
bindings:
  - origin: mapped
    form: wolfram
    template: Function[n, Times @@ (First[#]^Mod[Last[#], 2] & /@ FactorInteger[Abs[n]]), Listable][$1]
    arity: 1
    threadArg: 1
    note: Wolfram has no head for it; this is its definition over FactorInteger, with the sign of n a unit.
  - origin: mapped
    form: sage
    template: abs($1).squarefree_part()
    arity: 1
    threadArg: 1
    note: Sage's squarefree_part keeps the sign of n; this reads |n|.
---

- Every nonzero integer is $\pm s^2 q$ for a unique $s\ge1$ and square-free $q\ge1$; this is $q$, and [[SquarePartRoot]] is $s$. $n$ is square-free exactly when $s=1$, and a perfect square (up to sign) when $q=1$.
- The sign is a unit, as in [[PrimeOmega]], so $q\ge1$ always: $\mathrm{SquareFreePart}(-12)=3$. Sage's `squarefree_part` keeps the sign instead.
- Defined on nonzero integers; 0 stays unevaluated.
- Also called the square-free kernel; that name is more often given to the radical, the product of the *distinct* primes, which is a different function. The radical is Wolfram Function Repository's `IntegerRadical`.
