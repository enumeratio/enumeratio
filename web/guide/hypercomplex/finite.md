# Finite: ℤ/m and the places

[Hypercomplex algebras](/guide/hypercomplex/) introduces `i_k`, `j_k` and `ε_k` as formal
generators with a square attached. But you do not have to adjoin them — **ℤ/m already
contains them**, and which ones it contains is decided one prime at a time. This page
follows that all the way down.

## A square root of 1 is a root in every channel

The Chinese Remainder Theorem splits the ring: for $m = \prod p_i^{a_i}$,

$$\mathbb{Z}/m \;\cong\; \prod_i \mathbb{Z}/p_i^{a_i}$$

and a ring isomorphism carries $x^2 = 1$ to the same equation in each factor
independently. So a square root of 1 mod m is a **choice of root in each channel** — and
an odd prime power $p^a$ has exactly two, $\pm 1$, because $(\mathbb{Z}/p^a)^\times$ is
cyclic and so has a unique element of order 2.

Counting is then immediate. For **odd** m,

$$\#\{x : x^2 \equiv 1 \pmod m\} \;=\; 2^{\omega(m)}$$

with $\omega(m)$ the number of distinct primes dividing m. These $2^{\omega(m)}$ residues
are exactly the $\pm 1$ **sign vectors over the CRT channels** — a spectral basis, one
coordinate per place. Two of them, $1$ and $m-1$, are the trivial pair; every other one
is a genuine split unit, a square root of 1 that is not $\pm 1$.

<Story title="Sign vectors, as residues">
<template #description>15 = 3·5 gives 2² = 4; 1155 = 3·5·7·11 gives 2⁴ = 16 — one residue per ± choice across four places.</template>
<notatio-cell value="PowerModList(1, 1 / 2, 15)" />
<notatio-cell value="PowerModList(1, 1 / 2, 1155)" />
</Story>

The rows of that second list _are_ the sign vectors: 1 is $(+,+,+,+)$, 1154 is
$(-,-,-,-)$, and the fourteen in between are the mixed ones. Reading a residue as a
vector of signs is the whole content of the CRT here.

### The 2-adic channel is the exception

The clean law is stated for odd m because 2 misbehaves, and it misbehaves in a way worth
seeing: $\mathbb{Z}/2$ has **one** root of 1, $\mathbb{Z}/4$ has **two**, and
$\mathbb{Z}/2^a$ for $a \ge 3$ has **four** — namely $\pm 1$ and $\pm 1 + 2^{a-1}$. The
unit group stops being cyclic at 8, so it acquires a second independent element of
order 2.

<Story title="Powers of two break the count">
<notatio-cell value="PowerModList(1, 1 / 2, 2)" />
<notatio-cell value="PowerModList(1, 1 / 2, 4)" />
<notatio-cell value="PowerModList(1, 1 / 2, 8)" />
<notatio-cell value="PowerModList(1, 1 / 2, 16)" />
</Story>

## Imaginary units are rarer, and local

Now ask the same question for $x^2 = -1$. Again it decomposes channel by channel, but now
most channels have nothing to offer: $\mathbb{Z}/p$ has a square root of $-1$ **iff**
$p \equiv 1 \pmod 4$. So

$$x^2 \equiv -1 \pmod m \text{ is solvable} \iff \text{every odd prime factor of } m \equiv 1 \pmod 4, \text{ and } 4 \nmid m.$$

Half the primes qualify, by Dirichlet. This is the asymmetry that makes split units the
generic case and imaginary units special — and it is the same asymmetry that makes
$\mathbb{R}[j]/(j^2-1) \cong \mathbb{R} \times \mathbb{R}$ split while
$\mathbb{R}[i]/(i^2+1) \cong \mathbb{C}$ does not.

<Story title="Where √−1 lives">
<template #description>65 = 5·13, both ≡ 1 (mod 4), so two channels each contributing two roots. 15 = 3·5 has none: 3 ≡ 3 (mod 4) kills it.</template>
<notatio-cell value="PowerModList(-1, 1 / 2, 5)" />
<notatio-cell value="PowerModList(-1, 1 / 2, 65)" />
<notatio-cell value="PowerModList(-1, 1 / 2, 15)" />
</Story>

### Hensel lifting up a prime power

Finding a root mod $p$ is a search; getting it mod $p^a$ is **Hensel's lemma**. If
$r^2 \equiv -1 \pmod{p^k}$ then the correction

$$r' = r - \frac{r^2+1}{2r} \pmod{p^{k+1}}$$

is a root one power higher, and $2r$ is invertible because $p$ is odd and
$r \not\equiv 0$. Each step is Newton's method on $f(x) = x^2+1$ over the p-adics, and it
converges for exactly the reason Newton's method does — which is why a root mod $p$ is
enough to give a root mod $p^a$ for every $a$, and in the limit a root in $\mathbb{Z}_p$.

Both of these are one head: Wolfram's `PowerModList(a, 1/r, m)`, the $r$-th roots of $a$
mod $m$. The split units are its $(1, 1/2)$ case and the imaginary units its $(-1, 1/2)$
case, so there is no bespoke head to learn — and the same call reaches past squares.

<Story title="One head, any root">
<template #description>Three cube roots of 8 mod 13, because 3 divides 12.</template>
<notatio-cell value="PowerModList(8, 1 / 3, 13)" />
</Story>

<Story title="2² ≡ −1 (mod 5), lifted">
<template #description>7² = 49 = 50 − 1, so 7 is the lift of 2 to ℤ/25; 182 is the lift to ℤ/625.</template>
<notatio-cell value="PowerModList(-1, 1 / 2, 5)" />
<notatio-cell value="PowerModList(-1, 1 / 2, 25)" />
<notatio-cell value="PowerModList(-1, 1 / 2, 625)" />
</Story>

## The identities transport

A split unit is not just a curiosity of ℤ/m: it is a **homomorphism**. If $x^2 = 1$ in
ℤ/m then

$$\mathbb{R}[j]/(j^2-1) \longrightarrow \mathbb{Z}/m, \qquad j \mapsto x$$

respects addition and multiplication, so every identity the symbolic algebra proves
becomes a fact about ℤ/m. The zero divisor and the idempotent both survive the trip:
$(1+j)(1-j) = 0$ becomes $(1+4)(1-4) = -15 \equiv 0$, and $\tfrac{1+j}{2}$ — an
idempotent because $j^2 = 1$ — lands on $5 \cdot 8 = 40 \equiv 10$, with
$10^2 = 100 \equiv 10$.

<Story title="The same statement, twice">
<template #description>Left: the symbolic identity. Right: its image under j ↦ 4 in ℤ/15.</template>
<notatio-cell value="(1 + j_1) * (1 - j_1)" />
<notatio-cell value="(1 + 4) * (1 - 4) % 15" />
<notatio-cell value="((1 + j_1) / 2) ^ 2" />
<notatio-cell value="10 * 10 % 15" />
</Story>

This is why the idempotents matter. The split units, the CRT sign vectors and the
orthogonal idempotents $\tfrac{1 \pm j}{2}$ are three descriptions of one thing: a
decomposition of the ring into independent channels.

## Split, inert, degenerate — the square as a local invariant

Step back and the three columns of the [grid](/guide/hypercomplex/) stop looking like
three arbitrary choices. Over a field, the quadratic algebra $K[x]/(x^2-d)$ has
discriminant $4d$, and exactly three things can happen:

| $d$                 | algebra                                                  | unit       |
| ------------------- | -------------------------------------------------------- | ---------- |
| a **square** in $K$ | $K \times K$ — **splits**                                | `j`        |
| a **non-square**    | a quadratic **field**                                    | `i`        |
| **zero**            | $K[\varepsilon]$ — **degenerate**, the two roots collide | `\epsilon` |

So `j`, `i` and `ε` are not three unrelated inventions: they are the three outcomes of
one construction, selected by whether $d$ is a square, a non-square, or zero. And
"is $d$ a square" is a **local** question — it has a different answer at each place.

That is what the mod-m results above are really saying. Take $d = -1$:

- at the real place, $-1$ is not a square, so $\mathbb{R}[x]/(x^2+1) = \mathbb{C}$ — **inert**;
- at $p \equiv 1 \pmod 4$, $-1$ **is** a square in $\mathbb{Z}_p$, so the algebra **splits**;
- at $p \equiv 3 \pmod 4$ it is not, and the algebra is the unramified quadratic extension of $\mathbb{Q}_p$;
- at $p = 2$ it is the awkward case, as it was in the counting above.

Whereas $d = +1$ splits at every place, which is why split units are everywhere and
$\mathbb{R}[j]/(j^2-1) \cong \mathbb{R}^2$ already at the real place. **A hypercomplex
unit's character is not a property of the unit — it is a property of the unit at a
place.**

## Where this is heading: profinite and adelic

The rings $\mathbb{Z}/m$ are not separate objects. They form a system under
divisibility — $\mathbb{Z}/m \to \mathbb{Z}/n$ whenever $n \mid m$ — and the inverse
limit of that system is the **profinite integers**

$$\widehat{\mathbb{Z}} \;=\; \varprojlim_m \mathbb{Z}/m \;\cong\; \prod_p \mathbb{Z}_p,$$

so the CRT splitting at each finite level is the shadow of one product over all primes.
Under that identification the split units assemble too: the elements of order dividing 2
in $\widehat{\mathbb{Z}}^\times$ are a sign per prime, $\prod_p \{\pm 1\}$ — a Cantor-set
of split units, of which the $2^{\omega(m)}$ residues above are the finite truncations.
Hensel lifting is the statement that a root mod $p$ already determines its coherent
lift into $\mathbb{Z}_p$, so "which units exist" stabilises per place.

Adjoining the archimedean place gives the adeles,
$\mathbb{A}_{\mathbb{Q}} = \mathbb{R} \times {\prod_p}' \mathbb{Q}_p$, and the
split/inert/degenerate trichotomy above is then a statement about **all** places at
once: a quadratic algebra over $\mathbb{Q}$ has a local character at each place, and
those characters are not independent — quadratic reciprocity is precisely a constraint
tying them together, so the local behaviours have to multiply out consistently. Which
means the ± sign vectors that index the split units of ℤ/m are a fragment of something
global, not just bookkeeping per modulus.

That is the direction, stated honestly as a direction: this page demonstrates the finite
levels and the per-place criterion, and nothing here computes an adelic object. The
pieces that would make it concrete — a `Norm` that names its ambient level, coefficients
that live in ℤ/m rather than only mapping into it, and a per-place signature rather than
one global square — are all still to build.
