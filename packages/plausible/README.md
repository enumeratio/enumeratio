# @enumeratio/plausible

Seeded, size-aware generators for Plausible, the property sampler over our value spaces
([Plausible](https://github.com/enumeratio/enumeratio/wiki/Plausible)), after Lean 4's Plausible: a `Gen` reads a random
stream and a size, everything is seeded and printed so any run replays, and `streamFor` keys
a stream per family (or per template) so one key's draws never depend on another key having
run first. A leaf with no workspace dependencies — `collections`, [`reference`](../reference/README.md)
and [`bench`](../bench/README.md) all import it.

## Entry points

`.` (`src/index.ts`) is the whole package:

- **`random(seed)`** — mulberry32, tiny and deterministic; **`hash(text)`** — FNV-1a;
  **`streamFor(seed, key)`** — a stream of its own from `random(hash(\`${seed}/${key}\`))`.
- **`randomBelow(rng, n)`** — a uniform-enough `bigint` in `[0, n)`, chunked past the safe
  double range.
- **`between(rng, lo, hi, edge)`** — an integer in `[lo, hi]`, biased toward an end with
  probability `edge` — degenerate values are where bugs live.
- **`sizeAt(i, points, maxSize)`** — Plausible's size ramp: linear growth to `maxSize` across
  `points` samples.

## Commands

```sh
vp check
vp test
```

## Next

The runner that derives sampling from what a space declares (rather than a hand list of
families) is the point of [Plausible](https://github.com/enumeratio/enumeratio/wiki/Plausible) — read it before adding a new
family's generator. A test refuses a collection that doesn't meet the capability contract
the design describes.
