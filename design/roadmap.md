# Where to look for work

Status: **the index, not the plan**. This is the answer to "what should I pick up" when
nothing is already in flight. It deliberately holds no lists of its own — every list below
lives in code or generated data, so it cannot say something the repo has stopped believing.

## 1. The frontiers — ranked, generated, and honest about why

Eight lists, all committed, all regenerable. Each says what we do not do and, where the
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
| `<package>/reference/*.yaml` `aspirational: true`          | examples we document but don't yet produce ("not yet implemented"), triaged in issue #92                           |

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
guards allow and evaluates both sides. Every disagreement left is classified in
`KNOWN_CAUSES` (`packages/reference/src/crosswalk/fungrim.ts`): branch-convention
differences from our real principal values, and compute-engine bugs listed in
[upstreaming.md §8](./upstreaming.md). Where the engine cannot evaluate — no numeric arm at
a complex argument, or a hang — the identity is unchecked, and the frontier ranks those
heads by how many identities each unlocks, undeclared heads first. Every entry is an
implementation task with a ready-made test suite attached. Regenerate from
`packages/reference` with `vp run crosswalk:verify` (~45 s; each worker's heap is capped by
`--heap`, because a single evaluation can hang).

The two statistics/maps frontiers are the opposite kind of work: small, well-specified, and
each already carrying the argument for why it was left. The statistics one is **empty** as
of September 2026, and its history is the caveat — every entry it ever held was pessimistic,
and nine statistics moved off it once a claim was checked rather than asserted. Treat
anything that lands there next as unproven, not impossible. The maps frontier holds two.

## 2. Decisions taken but not executed

Work that needs no thinking, only a quiet moment. Each design doc's `Status:` line is the
authority; these are the ones currently parked:

- [knots.md](./knots.md) — the value landed, the table did not.

## 3. The old repo

[legacy-port.md](./legacy-port.md) is the backlog of what the Postgres-era predecessor did
that this one does not yet: presentations and table control, polytopes, species, collections
without kernels, and guides.

## 4. Open threads

Ideas with a shape but no plan, recorded where they came up rather than collected here:

- **Numerals as polynomial-like domains** — see design/speculative/symbols.md.
- **`modular` wants normalising** — 34 heads, several named for the implementation rather than
  the mathematics, and no Wolfram counterpart to align against —
  see design/speculative/symbols.md.
- **Upstreaming** — what compute-engine would have to change for our heads to be droppable
  into it: [upstreaming.md](./upstreaming.md). [§8](./upstreaming.md) is what is ready to
  send today, each with its reproduction.
- **The name split** — `enumeratio` is the symbol definitions and their evaluation on
  compute-engine and Epsil; `notatio` is the notebook, explorer and tools around them
  ([README](../README.md)). Package and folder names do not all say so yet; renaming
  waits for a quiet moment, and [component-naming.md](./component-naming.md) is how the
  last one went.

- **A canonical form for the `<Head>` syntax**: which arguments lift to named attributes,
  how attributes are ordered, and when atoms take the short spelling, so markup and
  MathJSON map one to one (see design/speculative/vdom-canonical-form.md). Writing more of
  the docs in enumeratio's own terms builds on it (design/speculative/docs-in-enumeratio.md).

- **Run our own test suites under controlled evaluation** — an isolated evaluation process,
  per-test `TimeConstraint`/`MemoryConstraint`, the way the oracle scans are already capped
  today (see design/speculative/evaluation.md).

- **Scenes.** Wolfram's
  [`GeometricScene`](https://reference.wolfram.com/language/ref/GeometricScene.html) is a
  scene described by its constraints (points, lines and the relations between them) and solved
  for a picture. See the
  [synthetic geometry tutorial](https://reference.wolfram.com/language/tutorial/SyntheticGeometry.html)
  and [guide](https://reference.wolfram.com/language/guide/SyntheticGeometry.html). "Scene" is
  probably the right word for more than that:
  - every display we draw into (a plot, a worksheet screen, a 3-D view) as a scene with its
    own coordinate system and camera;
  - the projective geometry over Cl(p,q,1) as `ProjectiveScene`.
    The unified-rendering speculation (design/speculative/graphics-and-space.md,
    design/speculative/rendering-environments.md) should be rewritten in those terms. Past the
    page, Wolfram links scenes to
    [Unity](https://reference.wolfram.com/language/UnityLink/guide/UnityScene.html). The same
    could go to an engine that emits wasm (Godot), or to Blender for rendered visualisations.
- **`SqrtSpace`.** The Function Repository's
  [`SqrtSpace`](https://resources.wolframcloud.com/FunctionRepository/resources/SqrtSpace/)
  maps Cartesian points to algebraic numbers in a quadratic field and back, keeping track of
  signs. It is a candidate head, and a Wolfram counterpart for number-theory's quadratic-field
  work.

- **Quadratic and algebraic integers.** number-theory has the Gaussian integers ℤ[i]. The
  same treatment belongs to every quadratic integer ring ℤ[(1+√d)/2] (norm, units, class
  number, factorisation where it's unique), and past that to rings of integers of number fields
  in general. This is the number-field layer the adeles' next phase and the quaternion places in
  design/speculative/algebras-units-places.md both wait on. Sage's `QuadraticField` /
  `NumberField` and Mathlib's `NumberField.RingOfIntegers` are the precedents.
- **Fixed-precision decimals and money.** A decimal type with a fixed scale: exact, and
  rounding to its last place by a stated rule. Money is the motivating case. It is not a ring
  (money times money isn't money), but an ordered additive group that rationals can scale. Its
  ticks are whole units or cents, so it floors and rounds through structures' `FloorOrder`
  extension without needing one.

## 5. What this file is not

Not a priority order, and not a commitment. If something here has been done, delete the line
— a roadmap with finished items on it is how a roadmap stops being read.
