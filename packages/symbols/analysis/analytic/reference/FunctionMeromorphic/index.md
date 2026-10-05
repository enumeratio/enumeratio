---
name: FunctionMeromorphic
domain: Elementary functions
signature: FunctionMeromorphic(f, x)
summary: True if f is meromorphic (a ratio of entire functions, poles allowed) everywhere, False otherwise.
signatures:
  - call: FunctionMeromorphic(f, x)
    description: whether f, viewed as a function of a complex variable, is meromorphic on the whole plane.
    library: "@enumeratio/analytic"
    type: (expression, symbol) -> expression
names:
  wolframIdentity: true
attributes:
  - HoldAll
---

- A polynomial, Exp/Sin/Cos of an affine argument (entire, hence trivially meromorphic), a genuine rational function, and Tan ($=\sin/\cos$, a ratio of entire functions) are all meromorphic; Sqrt and Ln are not, since a branch point is not a pole.
- Beyond those shapes the head reads sums, products, quotients and integer powers of meromorphic functions, with `Exp`, `Sin`, `Cos`, `Sinh` and `Cosh` of an entire argument, and `Tan`, `Sec`, `Sech` and the other reciprocals of one: `x/(x^2+1)` and `Sec(x)` are `True`. It says nothing about an essential singularity such as `Exp(1/x)`.
- This is a strictly larger class than [[FunctionAnalytic]] — the one distinction the two heads draw is exactly the poles a rational function or Tan has, which disqualify it from `FunctionAnalytic` but not from this one.
