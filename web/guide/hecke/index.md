# Hecke Algebras

The [Iwahori–Hecke algebra](https://en.wikipedia.org/wiki/Iwahori%E2%80%93Hecke_algebra)
$H_n(q)$ is parameterised differently from every other family here. The
[hypercomplex units](/guide/hypercomplex/) vary their _generators_; the
[diagram algebras](/guide/diagram-algebras/) vary _which diagrams are admitted_.
$H_n(q)$ keeps the basis of the symmetric group algebra **exactly** — one element $T_w$
per permutation, so the dimension is $n!$ — and deforms the **multiplication** by a
parameter $q$.

The whole algebra is one rule, applied one simple reflection at a time:

$$T_s \cdot T_w = \begin{cases} T_{sw} & \ell(sw) > \ell(w) \\ q\,T_{sw} + (q-1)\,T_w & \ell(sw) < \ell(w)\end{cases}$$

The second line is the deformation, and it is the only place $q$ enters. Note what it
does: a product of two basis elements is a **linear combination**, not one basis element
times a scalar. That is new here — every earlier family's product landed back on a
single basis element.

## Length up, length down

When multiplying raises the Coxeter length, nothing happens but bookkeeping. When it
lowers the length, $q$ appears.

<Story title="The two cases">
<template #description>First: ℓ goes up, so the product is a single T. Second: T_s² has ℓ going down, giving the quadratic relation q·T_e + (q−1)·T_s.</template>
<notatio-cell value="CircleTimes(HeckeT([2, 1, 3]), HeckeT([1, 3, 2]))" />
<notatio-cell value="CircleTimes(HeckeT([2, 1, 3]), HeckeT([2, 1, 3]))" />
</Story>

The quadratic relation $T_s^2 = q + (q-1)T_s$ — equivalently $(T_s - q)(T_s + 1) = 0$ —
is what replaces $s^2 = 1$ in the Coxeter group. At $q = 1$ the two roots collide back
onto $\pm 1$ and you recover an involution.

## The braid relations survive the deformation

What does _not_ change is the braid relations: $T_sT_tT_s = T_tT_sT_t$ for adjacent
generators, and $T_sT_t = T_tT_s$ for distant ones. That is exactly why $T_w$ is
well defined — it is the product over **any** reduced word for $w$, and the tests check
that for every $w$ in $S_4$.

<Story title="Braid, and commutation">
<template #description>Both sides of the braid relation, then two distant generators in either order.</template>
<notatio-cell value="CircleTimes(HeckeT([2, 1, 3]), HeckeT([1, 3, 2]), HeckeT([2, 1, 3]))" />
<notatio-cell value="CircleTimes(HeckeT([1, 3, 2]), HeckeT([2, 1, 3]), HeckeT([1, 3, 2]))" />
</Story>

## q = 1 is the symmetric group

This is the claim that makes "deformation" the right word, and it is the strongest test
in the package: at $q = 1$ the rule's two cases become one, and $T_u \cdot T_v = T_{uv}$
for **every** pair — checked exhaustively across $S_2$, $S_3$ and $S_4$.

<Story title="Specialising the parameter">
<template #description>q·T_e + (q−1)·T_s at q = 1 is just T_e — the group algebra. At q = 2 it stays spread.</template>
<notatio-cell value="HeckeSpecialize(CircleTimes(HeckeT([2, 1, 3]), HeckeT([2, 1, 3])), 1)" />
<notatio-cell value="HeckeSpecialize(CircleTimes(HeckeT([2, 1, 3]), HeckeT([2, 1, 3])), 2)" />
</Story>

So $H_n(1) = \mathbb{Z}S_n$, and the [symmetric group
algebra](/guide/diagram-algebras/) reached as a diagram algebra is the same object by
another route. Everything interesting — Kazhdan–Lusztig bases, the Jones polynomial via
the Temperley–Lieb quotient, the representation theory at roots of unity — lives at
$q \ne 1$.

## Things worth knowing

**Coefficients are exact polynomials in $q$.** They are compute-engine expressions, so
they stay symbolic and simplify themselves; `HeckeSpecialize(element, q)` substitutes
and drops whatever vanishes.

**Sums compose.** Because a product returns a linear combination, the parser reads sums
back in — the result of one product is a valid operand for the next, which the tests
check directly.

**Dimension is $n!$**, and `Basis` lists the $T_w$ up to $n = 6$; past that the
dimension still answers from the closed form.

**Not built yet.** The Kazhdan–Lusztig basis and the KL polynomials — the real reason
anyone builds $H_n(q)$ — and the Temperley–Lieb quotient, which would connect this page
directly to the [diagram algebras](/guide/diagram-algebras/) and to the Jones
polynomial. Also only type A: the same rule works for any Coxeter system given its
length function.
