# Design: one `Random`

Status: **first slice landed**. compute-engine's own `Random` draws from one seeded stream per
engine (`@enumeratio/engine`'s `random.ts`) over finite collections, intervals and
distributions, with a count or shape; `RandomInteger` and `RandomVariate` rewrite to it;
`Permutations(n)` is a collection it can sample. Still their own heads: `RandomComplex`,
`RandomGraph` and `RandomFunction`, which build a random object with no domain to draw from yet
(below), and compute-engine's `RandomChoice`, `RandomSample`, `RandomPrime`, which are not ours
to fold.

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

## How it is built

- **One stream.** `seedRandom` / `uniform01` in `@enumeratio/engine`: `SeedRandom(n)` restarts
  it, and `Random`, `RandomInteger`, `RandomVariate`, `RandomGraph`, `RandomComplex` and the
  process paths all draw from it -- two `mulberry32` streams (collections', statistics') were
  one too many. `RandomInteger(a, b)` and `Random(Range(a, b))` are the same draw.
- **Samplers.** A finite collection is sampled by `count` and `at`, uniformly; past the
  safe-integer range the engine has no count and `Random` declines rather than draw unevenly
  (bigint indices are a follow-up). A package registers a sampler for its own domain
  (`registerSampler`) and adds its overload (`addRandomArm`): statistics does distributions.
  That registry is the sampling protocol in all but name; making it a compute-engine protocol,
  recorded on each type's record, is the next step, and the same shape serves `Count`, `Rank`
  and `Unrank`.
- **`Permutations(n)`** was missing: compute-engine's `Permutations` takes a collection, so an
  integer was a type error. It is now one more arm, `(integer<0..>) -> indexed_collection`,
  meaning `SymmetricGroup(n)`.

## Still to fold

`RandomGraph(n, m)` becomes `Random(Graphs(n, m))` once a graph family is a collection (or a
sampled model); `RandomComplex` becomes `Random` over a complex region once there is one;
`RandomFunction` over a process is `Random` of a path.
