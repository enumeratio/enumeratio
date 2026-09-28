# Design: one `Random`

Status: **proposed**. Replaces the eleven `Random*` heads with compute-engine's own `Random`
over a sampling protocol; the Wolfram spellings stay, as aliases.

## Why one head

Wolfram has a head per thing to draw -- `RandomInteger`, `RandomReal`, `RandomComplex`,
`RandomChoice`, `RandomSample`, `RandomVariate`, `RandomPrime`, `RandomGraph`, … -- because
its type system can't say "a random element of this". Ours can. What varies is not the verb
but the domain, and the domain already knows how to be sampled:

- **A finite collection samples itself.** Anything with a count and an unrank draws an index
  uniformly and unranks it. That is exact, needs no registration, and already works:
  compute-engine's `Random` takes a `collection`, and `Random(Subsets(5))`,
  `Random(DyckPaths(4))`, `Random(Range(1, 10))` answer today, typed as the element.
- **Everything else says how.** A distribution samples by its own method; an unbounded family
  needs a size (or a distribution over sizes); a graph family draws by its model. Each
  implements a sampling protocol for its type (`declareProtocolImplementation`), so `Random`
  never grows an arm per domain.

## The signature

```
((indexed_collection<T>) random -> T)
  & ((set<real>) random -> real)                       -- compute-engine's intervals
  & ((T) random -> element<T> where T is Sampleable)   -- the protocol
```

with a count argument for draws with or without replacement (`RandomChoice`/`RandomSample`
are `Random` with a count and a replacement option). A refinement of a sampleable type is
sampleable: a restriction samples by rejection unless it brings a sampler of its own (worth
it when the restriction is thin). One head carries the `random` effect; `SeedRandom` and
`WithRandomSeed` stay as they are.

## The Wolfram names

`RandomInteger(n)` is `Random(Range(0, n))`, `RandomReal(x)` is `Random(Interval(0, x))`,
`RandomVariate(dist)` is `Random(dist)`, `RandomChoice(list, k)` and `RandomSample(list, k)`
are `Random(list, k)` with and without replacement, `RandomPrime(n)` is
`Random(Primes ∩ Range(2, n))`, `RandomGraph(n, m)` is `Random(Graphs(n, m))`. Each is a
data alias that rewrites to `Random`, the way the numerals' old names do, so Epsil and the
Wolfram transpiler and oracle keep their spelling.

## What the manifest learns

A type's protocol conformances go on its record, beside its overloads: "can this be
sampled, counted, ranked?" is then answerable from the manifest without loading code, and
the same record field serves `Count`, `Rank`, `Unrank` and `Length`, which have the same
shape (one verb, the capability on the type).

## Known gaps to fix on the way

`Random(Permutations(4))` is an `incompatible-type` error today, which looks like the carrier
name shadowing the collection family; `Random(Partitions(10))` stays unevaluated.
