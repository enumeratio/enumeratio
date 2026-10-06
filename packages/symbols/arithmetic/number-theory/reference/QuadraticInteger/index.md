---
name: QuadraticInteger
domain: Number theory
signature: QuadraticInteger(d, x, y)
summary: The element $x + y\omega$ of [[QuadraticIntegers]](d), held as a value.
catalogCarrier: true
mapOn:
  - QuadraticInteger
stub: carrier
signatures:
  - call: QuadraticInteger(d, x, y)
    description: $x + y\omega$, with $\omega = (-1 + \sqrt d)/2$ when $d \equiv 1 \pmod 4$, else $\sqrt d$
    library: enumeratio-number-theory
    type: (integer | tuple<integer, integer, integer>, integer?, integer?) -> quadratic_integer
seeAlso:
  - QuadraticIntegers
  - GaussianInteger
---

- The carrier names its own ring, so a head reads it without `Over`: `IsPrime(QuadraticInteger(-5, 1, 1))` asks about $1 + \sqrt{-5}$ in $\mathbb{Z}[\sqrt{-5}]$
- $\omega$ is the ring's own generator, so $x, y$ are always integers: `QuadraticInteger(-3, 0, 1)` is $\omega = (-1 + \sqrt{-3})/2 = e^{2\pi i/3}$
- `QuadraticInteger(-1, x, y)` is [[GaussianInteger]](x, y)
