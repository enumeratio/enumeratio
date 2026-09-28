---
name: DistributionMatchHit
domain: Combinatorial maps
signature: DistributionMatchHit(collection, stat, maps, qa, qd)
summary: "One result of a distribution match: the collection and statistic whose value histogram matches a target histogram, the chain of maps applied first, and its quality — $q_a$, the overlap of the two histograms (1 exactly when they are identical), and $q_d$, its discriminating power."
signatures:
  - call: DistributionMatchHit(collection, stat, maps, qa, qd)
    description: "One result of a distribution match: the collection and statistic whose value histogram matches a target histogram, the chain of maps applied first, and its quality — $q_a$, the overlap of the two histograms (1 exactly when they are identical), and $q_d$, its discriminating power."
    library: enumeratio-domains
    type: (tuple<string, string, list<string>, number, number>) -> distribution_match_hit
seeAlso:
  - FindStatHit
---
