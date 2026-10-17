---
name: MachinePrecision
domain: Collections
signature: MachinePrecision
summary: The precision of a machine number, $53 \log_{10} 2 \approx 15.95$ decimal digits.
signatures:
  - call: MachinePrecision
    description: the constant [[Precision]] returns for a double.
    library: enumeratio-combinatorics
seeAlso:
  - Precision
  - IsMachineNumber
names:
  wolframIdentity: true
---

- Held as a symbol until [[N]]: `Precision(1.5)` is `MachinePrecision`, and `N(MachinePrecision)` is its value in digits.
