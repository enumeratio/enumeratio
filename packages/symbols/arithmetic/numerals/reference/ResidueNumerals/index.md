---
name: ResidueNumerals
domain: Numeral systems
signature: ResidueNumerals(moduli)
summary: 'A residue number system: the digits are $n \bmod$ each modulus, with no place values at all — which is what makes addition and multiplication carry-free and parallel. It is a bijection onto $[0, \prod m_i)$ exactly when the moduli are pairwise coprime.'
signatures:
  - call: ResidueNumerals(moduli)
    description: the system for the given moduli
    library: enumeratio-numerals
    type: (list<integer>) -> value
seeAlso:
  - IntegerDigits
  - ResidueSystem
---
