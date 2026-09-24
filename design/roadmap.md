# Where to look for work

Status: **the index, not the plan**. This is the answer to "what should I pick up" when
nothing is already in flight. It deliberately holds no lists of its own — every list below
lives in code or generated data, so it cannot say something the repo has stopped believing.

## 1. The frontiers — ranked, generated, and honest about why

Seven lists, all committed, all regenerable. Each says what we do not do and, where the
answer is interesting, why not.

| list                                                       | what it holds                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `census/src/wolfram-frontier-data.ts` `FRONTIER`           | heads Wolfram's own documentation examples reach for that we cannot answer, ranked by how often                    |
| `census/src/wolfram-frontier-data.ts` `CALL_FORMS`         | argument shapes a symbol we DO map is shown taking, next to ours                                                   |
| `statistics/src/frontier.ts` `FRONTIER`                    | statistics with no definition, each with a stated reason                                                           |
| `domains/src/frontier-maps.ts` `UNDEFINED_MAPS`            | catalog maps not defined yet, same discipline                                                                      |
| `reference/src/fungrim-verified-data.ts` `fungrimFrontier` | heads whose Fungrim identities our engine cannot evaluate, ranked by how many identities each holds up             |
| `census/src/head-map-audit-data.ts` `HEAD_MAP_AUDIT`       | the `HarmonicNumber` shape, generalized: every mapped head the engine doesn't declare or doesn't actually evaluate |
| `census/src/rename-queue.ts` `RENAME_QUEUE`                | heads still declared under a spelling we have decided against, with what blocks each                               |

The Wolfram frontier is the one to open first when the question is "what should this system
be able to do that it can't". It is derived from ~10,000 documentation examples, so it is
ranked by what the people who built those functions thought worth demonstrating rather than
by what we happened to think of. See [symbols.md §4](./symbols.md) for how it is collected
and what it excludes; regenerate it with a Wolfram kernel on PATH:

```bash
vp node packages/census/scripts/collect-wolfram-frontier.ts
```

Three things sit at the top of it and are worth naming here because they are shaped like
projects rather than like tickets:

- **`FullSimplify`** — by a distance the most-used head we have no answer for.
- **The `Function*` property family** — `FunctionDomain`, `FunctionRange`, `FunctionInjective`,
  `FunctionMonotonicity`, `FunctionSingularities` and the rest. Individually small, collectively
  the largest coherent block on the list, and none of it exists here in any form.
- **The `HarmonicNumber` shape** — the head map claimed it, the transpiler emitted it, and the
  engine did not evaluate it. It is implemented now, but the shape recurs:
  `census/src/head-map-audit-data.ts` `HEAD_MAP_AUDIT` is the check, generalized and
  regenerable (`vp node packages/census/scripts/audit-head-map.ts`); a guard test refuses new
  undeclared rows.

The Fungrim frontier is the newest and the most mechanical to work through. Fungrim ships
1444 identities as rewrite rules; `crosswalk:verify` instantiates each one with values its
guards allow and evaluates both sides. The counts on disk (422 agree, 3 disagree) predate
the Carlson/Chebyshev/Legendre/incomplete-elliptic heads below and are stale — they were
declared and never checked against Fungrim. A fresh run agrees on 660 and disagrees on 22:
the `EllipticE`-at-complex-modulus bug is fixed (patched in place, see
[upstreaming.md §8](./upstreaming.md)), and most of the rest are newly-surfaced,
not-yet-investigated branch-cut disagreements from those same recently-declared heads at
arguments outside their documented domains — regenerating `fungrim-verified-data.ts` and
reconciling `KNOWN_CAUSES` (`packages/reference/src/crosswalk/fungrim.ts`) against the
larger set is its own task, not done here. Where the engine cannot evaluate at all — a head
with no numeric evaluation at a complex argument, or one that hangs — the identity is
unchecked, and the frontier ranks the heads by how many identities each unlocks, the ones
the engine does not declare at all first: `CarlsonRF`/`RD`/`RJ`/`RC`/`RG`, the orthogonal
polynomials (`ChebyshevT`/`U`, `LegendrePolynomial`), and the incomplete elliptic integrals
were the top of it and are now declared (`packages/analytic/src/carlson.ts`,
`chebyshev.ts`, `legendre.ts`, `elliptic.ts`). Every remaining entry is an implementation
task with a ready-made test suite attached; regenerate with `vp run crosswalk:verify` in
`packages/reference` (slow: it drives a worker process with a deadline, because a single
evaluation can hang).

The two statistics/maps frontiers are the opposite kind of work: small, well-specified, and
each already carrying the argument for why it was left. The statistics one is **empty** as
of September 2026, and its history is the caveat — every entry it ever held was pessimistic,
and nine statistics moved off it once a claim was checked rather than asserted. Treat
anything that lands there next as unproven, not impossible. The maps frontier holds two.

## 2. Decisions taken but not executed

Work that needs no thinking, only a quiet moment. Each design doc's `Status:` line is the
authority; these are the ones currently parked:

- [component-naming.md](./component-naming.md) — **agreed, deliberately not executed.** A
  repo-wide tag rename, held back while the components are under active development. §6 of
  that document is the order to do it in.
- [numeral-naming.md](./numeral-naming.md) — **needs a decision**, not execution.
- [knots.md](./knots.md) — the value landed, the table did not.

## 3. Open threads

Ideas with a shape but no plan, recorded where they came up rather than collected here:

- **Numerals as polynomial-like domains** — [symbols.md §5](./symbols.md).
- **`modular` wants normalising** — 34 heads, several named for the implementation rather than
  the mathematics, and no Wolfram counterpart to align against —
  [symbols.md §5](./symbols.md).
- **Upstreaming** — what compute-engine would have to change for our heads to be droppable
  into it: [upstreaming.md](./upstreaming.md). Two things there are ready to send today
  ([§8](./upstreaming.md)): the engine's Wikidata ids, 41 of 101 wrong, corrected in
  `reference/src/crosswalk/curated.ts` `WIKIDATA_FIXES`; and `EllipticE`'s precision at
  complex modulus, caught by three Fungrim identities.
- **The name split** — `enumeratio` is the symbol definitions and their evaluation on
  compute-engine and Epsil; `notatio` is the notebook, explorer and tools around them, and
  the notation they read and write ([README](../README.md)). Package and folder
  names do not all say so yet; renaming waits, like [component-naming.md](./component-naming.md)
  does, for a quiet moment.

## 4. What this file is not

Not a priority order, and not a commitment. If something here has been done, delete the line
— a roadmap with finished items on it is how a roadmap stops being read.
