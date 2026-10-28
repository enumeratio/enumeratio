---
name: SmirnovWordCount
domain: Partition statistics
signature: SmirnovWordCount(partition)
summary: "The words with each letter used this many times and no letter twice in a row: the Carlitz-Scoville-Vaughan sum over the numbers of runs of each letter, taken as a binomial convolution over the parts."
catalog:
  - system: findstat
    identity: St001097
    url: https://www.findstat.org/St001097
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SmirnovWordCount(partition)
    description: "The words with each letter used this many times and no letter twice in a row: the Carlitz-Scoville-Vaughan sum over the numbers of runs of each letter, as a binomial convolution of the parts' signed compositions counts."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St001097 reads it as a coefficient of the formal group law for linear orders; its description gives the Smirnov words.
