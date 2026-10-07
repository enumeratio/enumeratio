---
order: 2
---

# Orders and Algebraic Integers

[Quadratic Integers](quadratic-integers.md) works in one ring per field: $\mathcal{O}_d$, all
of $\mathbb{Q}(\sqrt d)$'s integers. A field has other rings with the same fraction field,
its **orders**, and fields of higher degree have rings of integers that no single generator
reaches. This page goes through both.

## Orders

An order of a number field $K$ is a subring that is a lattice of full rank: finitely
generated over $\mathbb{Z}$, spanning $K$ over $\mathbb{Q}$. Every order lies inside the ring of
integers $\mathcal{O}_K$, the **maximal order**. In a quadratic field each order is
$\mathbb{Z} + f\,\mathcal{O}_K$ for one **conductor** $f$, and is named by its discriminant
$D = f^2 D_K$: `QuadraticOrder(D)`. The ring $\mathbb{Z}[\sqrt{-3}]$ is the order of conductor 2
in $\mathbb{Z}[\omega]$:

<notatio-cell value="AlgebraicOrder(Sqrt(-3))" />

An order shares its field's arithmetic away from the conductor, and loses it at the conductor.
In $\mathbb{Z}[\omega]$ the prime 2 is inert, and so prime:

<notatio-cell value="IsPrime(2, Over -> QuadraticIntegers(-3))" />

In $\mathbb{Z}[\sqrt{-3}]$ it is not, though nothing smaller divides it: it divides
$(1 + \sqrt{-3})(1 - \sqrt{-3}) = 4$ without dividing either factor.

<notatio-cell value="IsPrime(2, Over -> QuadraticOrder(-12))" />

So 4 has two factorizations into irreducibles, $2 \cdot 2$ and $(1 + \sqrt{-3})(1 - \sqrt{-3})$.
An order of conductor $f > 1$ is never integrally closed, and never factors uniquely. The
units shrink too: $\mathbb{Z}[\omega]$ has six, $\mathbb{Z}[\sqrt{-3}]$ only $\pm 1$.

## Past degree two

A number field of degree $n$ is $\mathbb{Q}(\theta)$ for $\theta$ a root of an irreducible
polynomial of degree $n$, the **minimal polynomial**. The number $\theta$ can be a radical,
$i$, the golden ratio, or a root named by its polynomial, `PolynomialRoot(p, k)` (Wolfram's
`Root`):

<notatio-cell value="MinimalPolynomial(1 + Root(2, 3), x)" />

The field's real and complex embeddings are its **signature** $(r_1, r_2)$, with
$r_1 + 2r_2 = n$. $\mathbb{Q}(\sqrt[3]{2})$ has one real cube root of 2 and a complex pair:

<notatio-cell value="NumberFieldSignature(Root(2, 3))" />

By Dirichlet's unit theorem the units of $\mathcal{O}_K$ have rank $r_1 + r_2 - 1$. That rank is
1 here, as in a real quadratic field.

## When ℤ[θ] is not enough

$\mathbb{Z}[\theta]$ is always an order, `AlgebraicOrder(θ)`. It need not be the maximal one.
In $\mathbb{Q}(\sqrt[3]{19})$, the number

$$
\frac{1 + \theta + \theta^2}{3}, \qquad \theta = \sqrt[3]{19},
$$

is an algebraic integer, though its coordinates aren't integers:

<notatio-cell value="AlgebraicIntegerQ((1 + Root(19, 3) + Root(19, 3)^2) / 3)" />

The ring of integers comes with a basis, written on $\theta$'s powers as Wolfram writes it:

<notatio-cell value="NumberFieldIntegralBasis(Root(19, 3))" />

The **index** $[\mathcal{O}_K : \mathbb{Z}[\theta]]$ is 3 here. The discriminants differ by its
square: $\mathrm{disc}(x^3 - 19) = -27 \cdot 19^2$, and the field's is a ninth of that:

<notatio-cell value="NumberFieldDiscriminant(Root(19, 3))" />

How the ring of integers is found: an order $\mathcal{O}$ fails to be maximal at a prime $p$
exactly when some element of $\frac1p\mathcal{O}$ outside $\mathcal{O}$ is integral. Only primes
with $p^2$ dividing the discriminant can fail. So $\mathbb{Z}[\theta]$ is enlarged at each such
$p$, one integral element at a time, until none is left.

## Dedekind's cubic

Some fields have no $\theta$ with $\mathbb{Z}[\theta] = \mathcal{O}_K$ at all. Dedekind's
example is the field of a root of $x^3 - x^2 - 2x - 8$. Its ring of integers is
$\mathbb{Z} + \mathbb{Z}\theta + \mathbb{Z}\frac{\theta + \theta^2}{2}$:

<notatio-cell value="NumberFieldIntegralBasis(PolynomialRoot(x^3 - x^2 - 2x - 8, 1))" />

The reason is the prime 2. It splits into three distinct primes, each of norm 2, so
$\mathcal{O}_K/2\mathcal{O}_K \cong \mathbb{F}_2^3$. In a ring $\mathbb{Z}[\alpha]$ that would
need $\alpha$'s minimal polynomial to have three distinct roots mod 2, and $\mathbb{F}_2$ has
only two elements. So 2 is far from prime:

<notatio-cell value="IsPrime(2, Over -> AlgebraicIntegers(PolynomialRoot(x^3 - x^2 - 2x - 8, 1)))" />

while 3, where $x^3 - x^2 - 2x - 8$ stays irreducible, is inert:

<notatio-cell value="IsPrime(3, Over -> AlgebraicIntegers(PolynomialRoot(x^3 - x^2 - 2x - 8, 1)))" />

Primality here is that of the ideal: $(\alpha)$ is prime when $\mathcal{O}/(\alpha)$ is a field.
With $|N(\alpha)| = p^f$ that comes down to linear algebra over $\mathbb{F}_p$. $p$ must lie in
$(\alpha)$, and Frobenius $x \mapsto x^p$ must be injective on the quotient and fix only
$\mathbb{F}_p$. The same test works in any order, at the conductor too.

## What's not here yet

Class groups and units in degree 3 and up, and fields given by two generators
($\sqrt 2 + \sqrt 3$), stay unevaluated for now. So does any polynomial whose irreducibility no
prime certifies: $x^4 + 1$ splits mod every prime, though not over $\mathbb{Q}$.
