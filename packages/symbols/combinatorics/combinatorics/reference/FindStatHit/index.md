---
name: FindStatHit
domain: Combinatorial maps
signature: FindStatHit(collection, stat, maps, qa, qd)
summary: "One result of a FindStat-style statistic search: the collection and statistic that reproduce the values, the chain of maps applied first, and its quality — $q_a$, the fraction of the submitted pairs it explains, and $q_d$, its discriminating power (distinct values over objects found)."
signatures:
  - call: FindStatHit(collection, stat, maps, qa, qd)
    description: "One result of a FindStat-style statistic search: the collection and statistic that reproduce the values, the chain of maps applied first, and its quality — $q_a$, the fraction of the submitted pairs it explains, and $q_d$, its discriminating power (distinct values over objects found)."
    library: enumeratio-combinatorics
    type: (tuple<string, string, list<string>, number, number>) -> find_stat_hit
seeAlso:
  - DistributionMatchHit
---
