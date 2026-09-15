# The Polylog and the Polygamma

Two more members of the zeta family, and both of them are the
[Hurwitz zeta](/explore/zeta/) or the [Lerch transcendent](/explore/lerchphi/) wearing a
different hat:

$$\operatorname{Li}_s(z) = \sum_{n=1}^{\infty} \frac{z^n}{n^s} = z\,\Phi(z, s, 1)$$

$$\psi^{(m)}(z) = \frac{d^{m+1}}{dz^{m+1}}\ln\Gamma(z) = (-1)^{m+1} m!\,\zeta(m+1, z)$$

The polylogarithm is the Lerch transcendent along $a = 1$; the polygamma is the Hurwitz zeta
with its two arguments read the other way round — the _order_ $m$ fixes the first slot, and
the _argument_ $z$ takes the second. So a single Euler–Maclaurin kernel, already written for
$\zeta(s,a)$, computes the entire polygamma family, and the Lerch series computes the
polylogarithm.

compute-engine ships both heads natively, so this is an extension rather than an addition.
[`PolyLog`](/reference/symbol/PolyLog) is native at integer order (including the continuation
past the unit disk); `@enumeratio/analytic` adds non-integer and complex $s$.
[`PolyGamma`](/reference/symbol/PolyGamma) is native at real argument;
`@enumeratio/analytic` adds complex $z$, and the GPU kernel neither had.

<Story title="Reductions">
<notatio-cell value="PolyLog(1, z)" />
<notatio-cell value="PolyLog(2, 1)" />
<notatio-cell value="PolyLog(-1, z)" />
</Story>

$\operatorname{Li}_1(z) = -\ln(1-z)$, $\operatorname{Li}_2(1) = \zeta(2) = \pi^2/6$, and every
negative integer order is a rational function — $\operatorname{Li}_{-1}(z) = z/(1-z)^2$.

<Story title="Polygamma as a zeta value">
<notatio-cell value="N(PolyGamma(1, 1))" />
<notatio-cell value="N(PolyGamma(2, 1))" />
<notatio-cell value="N(PolyGamma(1, 1 / 2))" />
</Story>

At $z = 1$ every order is a zeta value: $\psi'(1) = \zeta(2) = \pi^2/6$ and
$\psi''(1) = -2\zeta(3)$. At the half-integers the alternating zeta shows up instead —
$\psi'(\tfrac12) = \pi^2/2$.

## Two very different pictures

Colour the complex $z$-plane by hue = argument, brightness = magnitude, and the two functions
could hardly look less alike — which is exactly the difference between their kernels. Both
are the same [`<notatio-complex-plot>`](/playground/complex-plot) element, handed a different
expression; every constant in them is a slider.

<ClientOnly>
<notatio-manipulate params="{ {s, 2}, -2, 8, 0.05}" fps>
  <notatio-complex-plot value="PolyLog(_s, z)" mask="1" extent="2.4" height="380" />
</notatio-manipulate>
</ClientOnly>

<ClientOnly>
<notatio-manipulate params="{ {m, 1}, 1, 24, 1}; { {c, -1.5}, -6, 2, 0.1}" fps>
  <notatio-complex-plot value="PolyGamma(_m, z)" center="[_c, 0]" extent="6" height="380" />
</notatio-manipulate>
</ClientOnly>

**Liₛ(z)** is the Lerch series, so it only converges inside $|z| < 1$: a lit disk, dark
outside, with the branch point at $z = 1$ sitting on the rim. Raise $\operatorname{Im}(s)$
and the disk fills with spirals, the same winding the
[Lerch portrait](/explore/lerchphi/) shows; push $\operatorname{Re}(s)$ up and the $n = 1$
term $z$ dominates, leaving a near-linear ramp of hue.

**ψ⁽ᵐ⁾(z)** is a Hurwitz zeta, which converges over the _whole_ plane — so the picture fills
out, and the poles appear: one at each of $z = 0, -1, -2, \ldots$, of order $m+1$, strung
along the negative real axis with the full colour wheel turning around each. Step $m$ up and
the hue wheels round more times per pole — a pole of order $m+1$ winds the argument $m+1$
times.

(f32 on the GPU, so the rim of the disk and the immediate neighbourhood of a pole are
approximate — the CPU kernel is the source of truth. The colouring runs on
$\ln|\psi^{(m)}|$ rather than the value, which is what keeps high orders in frame:
$\psi^{(m)}(1) \approx m!$ leaves f32's range past $m \approx 34$, but its logarithm
never does.)

## Where the pieces come from

| function                              | computed as                          | new here                |
| ------------------------------------- | ------------------------------------ | ----------------------- |
| $\operatorname{Li}_s(z)$, integer $s$ | compute-engine's own                 | —                       |
| $\operatorname{Li}_s(z)$, other $s$   | $z\,\Phi(z, s, 1)$, the Lerch series | $\lvert z\rvert \leq 1$ |
| $\operatorname{Li}_s(1)$              | $\zeta(s)$, exactly                  | non-integer $s$         |
| $\psi^{(m)}(z)$, real $z$             | compute-engine's own                 | —                       |
| $\psi^{(m)}(z)$, complex $z$          | $(-1)^{m+1} m!\,\zeta(m+1, z)$       | the whole complex plane |

The one place we stop short: a non-integer order outside the unit disk. The series does not
reach there and the continuation is only implemented for integer $s$, so
$\operatorname{Li}_{5/2}(2)$ is returned unevaluated rather than guessed at.
