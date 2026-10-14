---
name: DedekindEta
domain: Compute engine
signature: DedekindEta(complex | infinity) -> number
summary: Dedekind eta function η(τ), Im(τ) > 0.
signatures:
  - call: DedekindEta(complex | infinity) -> number
    description: as compute-engine declares it
  - call: DedekindEta(complex | infinity) -> number
    description: Dedekind eta function η(τ), Im(τ) > 0.
    library: enumeratio-analytic
    type: (complex | infinity) -> number
    overrides: compute-engine
references:
  - system: wikipedia
    identity: Dedekind eta function
  - system: mathworld
    identity: DedekindEtaFunction
  - system: dlmf
    identity: "23.15"
names:
  dlmf: Dedekind's eta function (or Dedekind modular function)
  wolframIdentity: true
stub: engine
---
