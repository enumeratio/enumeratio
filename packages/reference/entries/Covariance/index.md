---
name: Covariance
domain: Compute engine
signature: Covariance(collection<any>, collection<any>?) -> nan | real
summary: Sample covariance (n − 1 denominator) of paired data, given as two equal-length collections or one collection of (x, y) pairs.
signatures:
  - call: Covariance(collection<any>, collection<any>?) -> nan | real
    description: as compute-engine declares it
  - call: Covariance(collection<any>, collection<any>?) -> nan | real
    description: Sample covariance (n − 1 denominator) of paired data, given as two equal-length collections or one collection of (x, y) pairs.
    library: enumeratio-statistics
    type: (collection<any> | distribution, collection<any>?) -> list<list<real>> | nan | real
    overrides: compute-engine
names:
  wolframIdentity: true
stub: engine
---
