# The Lerch Transcendent

One function sits above the whole zeta/polylog family:

$$\Phi(z, s, a) \;=\; \sum_{n=0}^{\infty} \frac{z^n}{(n+a)^s}.$$

Set $z = 1$ and it is the [Hurwitz zeta](/explore/zeta/) $\zeta(s, a)$ (and $\zeta(s)$ at $a=1$).
Walk along $a = 1$ and it is the polylogarithm, $\operatorname{Li}_s(z) = z\,\Phi(z, s, 1)$. Sit at
$z = -1$ and it is the Dirichlet eta $\eta(s) = \Phi(-1, s, 1)$, whose value at $s = 1$ is
$\ln 2$. `@enumeratio/analytic` provides [`LerchPhi`](/reference/symbol/LerchPhi); the $z^n$ factor
makes the series converge geometrically inside the unit disk, so it is summed directly there. On
the $z = -1$ rim the terms alternate and direct summation stalls, so those are summed by an Euler
transform instead — enough to pin $\eta(1) = \ln 2$ and $\Phi(-1, 2, \tfrac12) = 4G$ to machine
precision.

<Story title="Reductions">
<notatio-cell value="LerchPhi(1, 2, 1)" />
<notatio-cell value="LerchPhi(1, -1, 1)" />
<notatio-cell value="LerchPhi(z, 0, a)" />
</Story>

$\Phi(1, 2, 1) = \zeta(2) = \pi^2/6$, $\Phi(1, -1, 1) = \zeta(-1) = -\tfrac{1}{12}$, and
$\Phi(z, 0, a) = 1/(1-z)$ for every $a$.

## The disk of convergence

Fix $s$ and $a$ and let $z$ range over the complex plane. The series only converges for
$|z| < 1$ — so the natural portrait is a **coloured disk**: hue is the phase $\arg \Phi$,
brightness rises with $|\Phi|$, and outside the unit circle (where the sum diverges and the true
function lives only by analytic continuation) is left dark. The whole thing is the same GPU
kernel as the [zeta portrait](/explore/zeta/phase-portrait), evaluated per pixel.

<ClientOnly>
<notatio-manipulate params="{ {sr, 0.5}, -2, 6, 0.05}; { {si, 8}, 0, 24, 0.25}; { {a, 1}, 0.25, 4, 0.05}" fps>
  <notatio-complex-plot value="LerchPhi(z, _sr + _si * i, _a)" mask="1" extent="2.4" height="420" />
</notatio-manipulate>
</ClientOnly>

**What to look for.** It opens at $s = 0.5 + 8i$, and every argument is an axis — the two
parts of $s$ and $a$ alike. A small $\operatorname{Re}(s)$ keeps the higher
terms $(n+a)^{-s}$ from decaying, and the imaginary part winds each one by
$e^{-\operatorname{Im}(s)\ln(n+a)}$, so the disk fills with spirals of colour that tighten toward
the pole at $z = 1$ on the right rim. Raise $\operatorname{Re}(s)$ and it calms — the $n=0$ term
$a^{-s}$ takes over and $\Phi$ becomes nearly one hue (no zeros or poles live _inside_ the disk).
The $a$ slider shifts the whole pattern. (f32 on the GPU, 4096 terms per pixel, so the very rim is
approximate — the CPU kernel is the source of truth.)

## The family, in one function

| specialization          | is                                                          | at              |
| ----------------------- | ----------------------------------------------------------- | --------------- |
| $\Phi(1, s, a)$         | Hurwitz zeta $\zeta(s, a)$                                  | $z = 1$         |
| $\Phi(1, s, 1)$         | Riemann zeta $\zeta(s)$                                     | $z = 1, a = 1$  |
| $z\,\Phi(z, s, 1)$      | [polylogarithm](/explore/polylog/) $\operatorname{Li}_s(z)$ | $a = 1$         |
| $\Phi(-1, s, 1)$        | Dirichlet eta $\eta(s)$                                     | $z = -1, a = 1$ |
| $\Phi(-1, 2, \tfrac12)$ | $4\times$ Catalan's constant $G$                            | —               |
| $\Phi(z, 0, a)$         | $1/(1-z)$                                                   | $s = 0$         |

That last row is why $s = 0$ evaluates even outside the disk. The $\eta$ row sits on the unit
circle, where the alternating series converges too slowly for direct summation; an Euler transform
handles the real $z < 0$ rim, so $\eta(s)$ and Catalan's $G$ come out to machine precision. One
series (with that one acceleration) does the work of the whole family.
