# Hypercomplex Algebras

A [hypercomplex number](https://en.wikipedia.org/wiki/Hypercomplex_number) is an element
of a finite-dimensional algebra over the reals — you take ℝ, adjoin some units that are
not real numbers, and say what happens when you multiply them. The complex numbers are
the smallest interesting case: one unit, `i`, with `i² = −1`. Everything else on this
page is what you get by making other choices. Let a unit square to `+1` instead and you
have the split-complex numbers, which contain zero divisors and are not a field. Let it
square to `0` and you have the dual numbers, where `f(a + ε)` carries `f'(a)`. Adjoin
several units and decide whether they commute: keep them commuting and you climb the
multicomplex tower ℂ₁ ⊂ ℂ₂ ⊂ ℂ₃ …; let them anticommute and you get the Clifford
algebras, among them the quaternions.

They are all the same construction with different dials, which is why one implementation
covers them: `@enumeratio/hypercomplex` adds them to the shared engine so that ordinary
arithmetic — `+ - × ÷`, integer powers, `Norm`, `Conjugate`, division — just works on
them, with exact coefficients.

## Hypercomplex units

A generator is fixed by just two facts — **what it squares to**, and **whether it
commutes** — so the families are the whole 3 × 2 grid and there is nothing else to add:

|                   | $\sqrt{-1}$                     | $\sqrt{1}$               | $\sqrt{0}$        |
| ----------------- | ------------------------------- | ------------------------ | ----------------- |
| **commuting**     | `i_k` — multicomplex ℂₙ         | `j_k` — split / perplex  | `ε_k` — dual      |
| **anticommuting** | `f_k` — Clifford Cl(0,n), and ℍ | `e_k` — Clifford Cl(n,0) | `θ_k` — Grassmann |

Read a column as "a square root of that", and a row as whether the roots commute with
each other. `i_k` is the familiar one; `f_1` and `f_2` together are the quaternions;
`θ_k` are the fermionic generators. All the anticommuting generators anticommute
across families too, as they must in a superalgebra.

A generator is an ordinary subscripted symbol, so the **notation costs nothing** —
compute-engine's LaTeX parser already reads `1 + 2i_1 - 3i_1i_2` as one sum over three
basis units. What the package adds is the _algebra_: `+ - × ÷` and integer powers
reduce to a canonical form, and `Norm`, `Conjugate` and division come along with it.

Everything else is untouched: `x_1` is still a variable, `e` is still Euler's number,
and compute-engine's own `i` is still its native complex unit.

> These units are not only formal — ℤ/m is full of them, one per CRT channel.
> [**Finite: ℤ/m and the places**](/guide/hypercomplex/finite) follows that all the
> way down.

## Multicomplex: the commuting tower

Each generator squares to −1, and distinct generators commute — so this is the
commutative corner of the hypercomplex world, not the quaternions.

<Story title="The defining relation, and commutativity">
<notatio-cell value="i_1 ^ 2" />
<notatio-cell value="i_2 * i_1" />
</Story>

The signature is **mixed**, which is the whole story of ℂₙ for n ≥ 2: the blade
`i_1i_2` squares to `i_1²i_2² = (−1)(−1) = +1`, so ℂ₂ contains a square root of +1
that is not ±1 — and with it zero divisors and idempotents that ℂ₁ has none of.

<Story title="A blade that squares to +1">
<template #description>Sign follows the popcount of the index: (−1) to the power of the number of units in the blade.</template>
<notatio-cell value="(i_1 * i_2) ^ 2" />
<notatio-cell value="(i_1 * i_2 * i_3) ^ 2" />
</Story>

<Story title="Products expand over the basis">
<notatio-cell value="(1 + i_1) ^ 2" />
<notatio-cell value="(1 + i_1) * (1 + i_2)" />
<notatio-cell value="(a + b * i_1) ^ 2" />
</Story>

Coefficients are kept as expressions rather than floats, so rationals stay rational
and free symbols ride along — `(a + b i_1)²` comes back as `a² − b² + 2ab·i_1`.

## Conjugation, and why the norm is a determinant

`\overline{z}` sends every generator to its negative, so odd-grade blades flip sign.

<Story title="Conjugation">
<notatio-cell value="OverBar(1 + i_1 + i_2 + i_1 * i_2)" />
</Story>

For the Gaussians `z·conj(z)` is the norm. Above n = 1 **it is not even a scalar**:

<Story title="z·conj(z) keeps a blade">
<template #description>The i_1i_2 part is 2(ad − bc) — it only vanishes by accident.</template>
<notatio-cell value="(1 + 2i_1 + 3i_2 + 4 * i_1 * i_2) * OverBar(1 + 2i_1 + 3i_2 + 4 * i_1 * i_2)" />
</Story>

So `Norm` is the **algebra norm**: the determinant of multiplication-by-z on the
2ⁿ-dimensional space. It is computed through the tower ℂₙ = ℂₙ₋₁[iₙ]/(iₙ²+1), where
`z = u + iₙ·v` gives `N(z) = N(u² + v²)` one level down — n squarings, not a
2ⁿ × 2ⁿ elimination. At n = 1 it collapses to the Gaussian `a² + b²`.

<Story title="The algebra norm">
<template #description>25 = 3²+4². And Norm(1 + 2i_1 + 3i_1i_2) = 160 is the determinant of [1 −2 0 3; 2 1 −3 0; 0 −3 1 −2; 3 0 2 1].</template>
<notatio-cell value="Norm(3 + 4i_1)" />
<notatio-cell value="Norm(1 + 2i_1 + 3 * i_1 * i_2)" />
</Story>

## Units, zero divisors, idempotents

An element is invertible exactly when its norm is — and division is exact.

<Story title="Inverses">
<notatio-cell value="1 / (1 + i_1)" />
<notatio-cell value="i_1 ^ (-1)" />
<notatio-cell value="(1 + 2i_1 + 3 * i_1 * i_2) * (1 + 2i_1 + 3 * i_1 * i_2) ^ (-1)" />
</Story>

`1 + i_1i_2` has norm 0. It is a genuine zero divisor, so division by it is left
standing rather than answered with something false.

<Story title="A zero divisor, and the idempotent beside it">
<notatio-cell value="Norm(1 + i_1 * i_2)" />
<notatio-cell value="(1 + i_1 * i_2) * (1 - i_1 * i_2)" />
<notatio-cell value="1 / (1 + i_1 * i_2)" />
<notatio-cell value="((1 + i_1 * i_2) / 2) ^ 2" />
</Story>

## Split (perplex) units: `j_k² = +1`

The same machinery with the sign flipped. The norm becomes `a² − b²`, which is
indefinite — so the split algebra is full of zero divisors, and `(1 ± j_1)/2` are the
two orthogonal idempotents that resolve the identity.

<Story title="Split-complex arithmetic">
<notatio-cell value="j_1 ^ 2" />
<notatio-cell value="Norm(3 + 4j_1)" />
<notatio-cell value="(1 + j_1) * (1 - j_1)" />
<notatio-cell value="(1 + j_1) / 2 * ((1 - j_1) / 2)" />
</Story>

Families mix freely — `i_1j_1` squares to `(−1)(+1) = −1`.

<Story title="Mixing families">
<notatio-cell value="(i_1 * j_1) ^ 2" />
</Story>

## Dual units: `ε_k² = 0`

Nilpotent generators give the dual numbers, where a cube carries its own derivative:
`(2 + ε)³ = 8 + 12ε`, and 12 is `d/dx x³` at 2.

<Story title="Dual numbers differentiate">
<notatio-cell value="epsilon_1 ^ 2" />
<notatio-cell value="(2 + epsilon_1) ^ 3" />
<notatio-cell value="(2 + epsilon_1) ^ (-1)" />
</Story>

## Clifford units: `e_k` anticommute

`e_1e_2 = -e_2e_1`, and getting that sign out of compute-engine takes some care:
`Multiply` is declared commutative, so canonicalisation sorts its operands before any
handler runs, and by then the transposition sign is gone beyond recovery.

Juxtaposition escapes it, because juxtaposition is not `Multiply` yet — it parses to
`InvisibleOperator`, one step upstream of the sort, where a product whose sign is at
stake is rerouted onto the ordered head. So `e_2e_1` written out reads correctly.
An explicit `\times` or `\cdot` has no such step: it parses straight to `Multiply`,
already sorted. Rather than return a sign it cannot justify, `×` declines there and
leaves the product inert — write `⊗` (or `NonCommutativeMultiply`) instead.

A separate head is the standard answer to this, not a workaround. Wolfram puts the
non-commutative product on its own head — `NonCommutativeMultiply`, infix `**` — and
matrix multiplication on another, `Dot`, infix `.`, for exactly the same reason;
compute-engine's own `Dot` is likewise declared `commutative: false`, which is why
`Dot(A,B)` and `Dot(B,A)` stay apart while `Multiply` would collapse them. So the
ordered product here is `NonCommutativeMultiply`, with `GeometricProduct` as an alias
for the geometric-algebra reading. Both work on the commuting families too, where they
just agree with `×`.

<Story title="The ordered product">
<template #description>Juxtaposition agrees with it; explicit × is the one that has to decline.</template>
<notatio-cell value="e_1 ^ 2" />
<notatio-cell value="NonCommutativeMultiply(e_1, e_2)" />
<notatio-cell value="NonCommutativeMultiply(e_2, e_1)" />
<notatio-cell value="GeometricProduct(e_1, e_2, e_1, e_2)" />
<notatio-cell in-form="latex" value="e_2e_1" />
<notatio-cell in-form="latex" value="e_1e_2e_1" />
<notatio-cell value="e_2 * e_1" />
</Story>

## Quaternions and Grassmann: the anticommuting half

`f_k` squares to −1 _and_ anticommutes, which is Cl(0,n) — and Cl(0,2) is exactly the
quaternions. Take i = `f_1`, j = `f_2`, k = `f_1f_2`: all three square to −1, and
`ijk = −1`.

<Story title="⟨f_1, f_2⟩ is ℍ">
<template #description>k² = −1, and ij·k = −1 — the quaternion relations.</template>
<notatio-cell value="f_1 ^ 2" />
<notatio-cell value="CircleTimes(f_1, f_2, f_1, f_2)" />
<notatio-cell value="CircleTimes(f_2, f_1)" />
</Story>

Anticommuting _nilpotents_ have a use too: `θ_k` are the fermionic / Grassmann
generators, and their blades span the exterior algebra Λ(ℝⁿ). Any repeated generator
kills the blade, which is why Λ(ℝⁿ) stops at grade n.

<Story title="Grassmann generators">
<notatio-cell value="theta_1 ^ 2" />
<notatio-cell value="CircleTimes(theta_2, theta_1)" />
<notatio-cell value="CircleTimes(theta_1, theta_2, theta_1)" />
</Story>

There is a second route to an imaginary anticommuting generator, since `i` commutes:
`(i·e_1)² = i²e_1² = (−1)(+1) = −1`. So `i e_k` behaves like `f_k`; `f_k` is just the
direct spelling.

## Named algebras

An algebra here is nothing but an **ordered list of generators** — the families already
carry the squares and the commutation rules — so naming one is a way to say "these
generators" and get its basis, dimension and signature back, in the spirit of Wolfram's
`CliffordAlgebra`.

`CliffordAlgebra(p, q)` takes p generators squaring to +1 and q squaring to −1;
`MulticomplexAlgebra(n)`, `SplitAlgebra(n)`, `DualAlgebra(n)` and `GrassmannAlgebra(n)`
name the commuting corners. The ones with names of their own can be written that way:
`Quaternions` (or `\mathbb{H}`), `BicomplexNumbers`, `TricomplexNumbers`,
`SplitComplexNumbers` and `DualNumbers`.

<Story title="ℍ is Cl(0,2)">
<template #description>Basis order is grade then generator, so ℍ comes back as (1, i, j, k).</template>
<notatio-cell value="Basis(Quaternions)" />
<notatio-cell value="AlgebraSignature(Quaternions)" />
<notatio-cell value="AlgebraDimension(CliffordAlgebra(2, 1))" />
<notatio-cell value="Basis(BicomplexNumbers)" />
</Story>

No element constructor is needed: `Dot` already threads a tuple of scalars over a
basis, so an algebra's elements are one composition away.

<Story title="Elements from a coefficient tuple">
<notatio-cell value="Dot([1, 2, 3, 4], Basis(Quaternions))" />
</Story>

And because they name generator sets, the algebras work as **sets**: containment asks
whether every unit occurring in an element belongs to the algebra. A free symbol gets no
answer rather than a presumptuous one.

<Story title="Containment">
<notatio-cell value="f_1 * f_2 in $\mathbb{H}$" />
<notatio-cell value="f_3 in $\mathbb{H}$" />
<notatio-cell value="i_1 in BicomplexNumbers" />
<notatio-cell value="i_3 in BicomplexNumbers" />
</Story>

## These units already live inside ℤ/m

A **split unit** is an x with x² = 1 and x ≠ ±1 — and ℤ/m is full of them. By CRT,
ℤ/m ≅ ∏ ℤ/pᵢ^aᵢ, a square root of 1 is a root in every channel independently, and an odd
prime power has exactly the two roots ±1. So for odd m the roots of 1 are the
**2^ω(m) spectral sign vectors**, ω(m) = the number of distinct primes.

<Story title="The split units of a modulus">
<template #description>15 = 3·5, so ω = 2 and there are 2² = 4 roots of 1: the trivial ±1 pair plus 4 and 11.</template>
<notatio-cell value="PowerModList(1, 1 / 2, 15)" />
<notatio-cell value="PowerModList(-1, 1 / 2, 65)" />
</Story>

Sending `j_1 ↦ 4` is a ring homomorphism ℝ[j]/(j²−1) → ℤ/15, so the identities the
symbolic algebra proves come back as facts about ℤ/15. That, and the place-by-place
story behind it, is the subject of
[**Finite: ℤ/m and the places**](/guide/hypercomplex/finite).

## Things worth knowing

**`Norm` depends on the ambient algebra.** It is taken over the subalgebra generated
by the units that actually occur, and adjoining a generator _squares_ the determinant
(`N` at level n+1 is `N` at level n, squared). So `N` is multiplicative on a fixed
unit set — that is the theorem — but the two cells below are 2 and 2 while their
product is 16, not 4.

<Story title="The norm is relative to a level">
<notatio-cell value="Norm(1 + i_1)" />
<notatio-cell value="Norm((1 + i_1) * (1 + i_2))" />
</Story>

**compute-engine's `i` stays a scalar.** It is a number literal, not a symbol, so it
lives inside coefficients and native complex arithmetic is unchanged. `i_1` is
therefore a _separate_ commuting square root of −1 — which is the point: it is what
makes ℝ[i_1, …, iₙ] the multicomplex tower rather than a re-spelling of ℂ.

<Story title="Native complex arithmetic is untouched">
<notatio-cell value="(1 + i) ^ 2" />
<notatio-cell value="i * i_1 * i_1" />
</Story>

**Anything opaque stays symbolic.** A generator under a head the package cannot see
through — `\sin(i_1)`, a symbolic exponent — is left alone rather than guessed at.

<Story title="Declining to answer">
<notatio-cell value="Sin(i_1)" />
</Story>

## Design considerations, recorded

**The infix symbol for the ordered product is unsettled.** `**` is out: epsil already
takes it for exponentiation (alongside `^`), and compute-engine's own LaTeX parser
rejects it regardless. `×` / `xx` would read best — a Cartesian product is inherently
ordered, so the connotation is right — but `\times` _and_ bare `×` are both already
compute-engine's trigger for `Multiply`, and repointing them would change every
multiplication in the language. Too much to take unilaterally, so `\otimes` (⊗) carries
it for now: it had no definition at all, and ⊗ connotes an ordered product anyway.
Worth revisiting with upstream, because a possibly-non-commutative `×` that reduces to
the commutative case is an attractive design.

⊗ is not a Clifford-only spelling, either, which is part of why it fits: a tensor
product of two scalars is just their product (the implied identity factor), so
`2 ⊗ 3` is 6, and on the commuting families ⊗ simply agrees with `×`. It is total, and
non-commutative only where the algebra actually is.

**`Dot` is a weak precedent, despite being the one that exists.** The scalar product
genuinely _is_ commutative, so a head named `Dot` reading as matrix multiplication
(which is not) is a conflation on compute-engine's side. What it does establish — and
the part worth leaning on — is that CE is willing to declare a product head
`commutative: false` and keep it apart from `Multiply`.

**Two things to raise upstream.** (1) `Multiply` being declared commutative means
canonicalisation destroys operand order before any evaluate handler runs, so an
extension cannot implement an anticommuting product on `×` even in principle. (2)
Redeclaring an operator silently drops its `type` handler unless the caller copies it,
which widens `Add`'s result from `number` to `value` and then breaks unrelated
operators — that reads like surface that has not been built yet rather than a decision.

**The measurement-units system is a tantalising neighbour, and currently closed.**
A unit written as an identifier already parses as `Multiply(3, m)` — structurally the
same thing as a generator here, just without a square or a commutation rule. So these
units _are_ the units system with two extra facts attached. But `Quantity` /
`UnitConvert` / `Dimension` have no public registry to extend (there is no
`ce.declareUnit`), so adding a dimension — let alone an imaginary or non-commutative
one — is not reachable from outside today. Worth pursuing: the quaternions contain a
2-sphere's worth of anticommuting square roots of −1, one per direction in 3-space,
which is a genuinely unit-like way to think about them.

**Not built yet.** A `Norm` that can name its ambient level rather than inferring it
from the units present; a Clifford norm and reverse; and modular _coefficients_, so the
algebra could run over ℤ/m directly instead of only mapping into it.
