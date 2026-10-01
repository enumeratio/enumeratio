# NumPy

A **code output form**: Python/NumPy source, via compute-engine's own Python target.
The registry format is named `Python` (aliases `python`, `numpy`, `py`, extension `.py`,
in `packages/formats/src/formats.ts`); `PythonForm` is what the In/Out menu calls it,
the display-form label in `notatio-out.ts`. It translates numeric and function
expressions into the `np` namespace; symbolic-only heads — and some combinatorial
ones like `Binomial` — have no NumPy form and emit nothing.

A few emissions are worth knowing (shown below): `Exp` becomes `np.e ** x` rather
than `np.exp`, `Sqrt`/`Ln` use the complex-capable `np.emath.*`, special
functions pull in SciPy, and exact rationals collapse to floats.

<SourceOutput language="numpy" />
