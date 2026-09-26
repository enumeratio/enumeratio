# Design: examples as data

Status: **proposed** (2026-09-25), for sign-off before any of §8 runs.

The reference examples become where enumeratio's math is tested. Unit tests stay for
plumbing — parsers, printers, the CLI, the elements. Every example is plain data in the
package declaring its head, with a stable id. Next to it, a second record pins how every
implementation writes and answers it: our own forms, and each other system's. The goldens,
divergence notes and oracle dumps we keep today fold into those two records.

## 1. Where things stand

About 3,100 examples over ~400 heads, split across three homes:

- **`packages/reference/src/entries/*.ts`** — 25 hand-written TS files by domain, not by
  package. `arithmetic`, `elementary`, `lists` and friends mix compute-engine's heads with
  several of ours. `statistics`, `domains` and `collections` each keep their own
  `src/entries.ts` instead (the first two generated), and the oracle scan never sees those.
- **`<stem>.oracle.json` sidecars** — every system's `input`/`output`/`verdict`, plus the
  hand classification (`kind`, `note`, `issue`), keyed by `JSON.stringify(expr)`. Edit an
  `expr` and its row is orphaned; `oracle-golden.test.ts` mostly exists to catch that.
- **Goldens keyed by position** — `texform-alignment.golden.json` (`stem/Head#n`) and
  `wolfram/tests/golden/round-trip.json` (`Head#n`) are one-row-per-example derivatives.
  Around 40 package goldens (`analytic`, `collections`, `adeles`, `numerals`,
  `number-theory`, `modular`) pin oracle-sourced values that are examples in all but name.

Identity is an array index: the page anchors `#example-N`, `entries.test.ts` names
`Mod example 3`, and the goldens use `#n`. Inserting an example renumbers everything
after it.

## 2. Two records per head

Each head gets two files in the package that declares it:

- **`reference/<Head>.yaml`** — the entry, written by hand: summary, signatures, details,
  references, head-level implementations, and `examples` in page order. Nothing
  machine-writes this file after the migration.
- **`reference/<Head>.implementations.yaml`** — for each example id, every implementation's
  rendering of it and, for other systems, their answer. Mostly generated or scanned, and
  the classifications are written by hand.

The split is by who writes what. A reviewer reads the first file. The generator and the
scans write the second, which is big, repetitive, and churns with kernel versions and
printer changes.

### The example

```yaml
- id: zero-modulus
  expr: [Mod, 5, 0]
  expected: NaN
  caption: Division by a 0 modulus yields NaN rather than an error
  category: Possible issues
```

| Field                 | Meaning                                                 |
| --------------------- | ------------------------------------------------------- |
| `id`                  | §3                                                      |
| `expr`, `expected`    | MathJSON, as today. `expected` is the pinned evaluation |
| `caption`, `category` | as today                                                |
| `role`                | `demo` (default) or `test` — §5                         |
| `aspirational`        | as today, plus an optional `issue`                      |
| `volatile`            | as today                                                |

MathJSON stays authoritative. It is what compute-engine consumes and what the scans
compare, and in YAML's flow style it reads almost as well as Epsil does.

### Its implementations

```yaml
zero-modulus:
  epsil: { in: "Mod(5, 0)", out: NaN }
  tex: { in: '5\bmod0', out: '\operatorname{NaN}' }
  notatio: { in: "<notatio-mod>…</notatio-mod>", out: "<notatio-symbol>NaN</notatio-symbol>" }
  wolfram:
    in: "Mod[5, 0]"
    out: Indeterminate
    tex: { in: '(5 \bmod 0)', out: '\text{Indeterminate}' }
  sage:
    in: (5 % 0)
    out: "ZeroDivisionError: Integer modulo by zero"
    verdict: error
    kind: undefined-form
    note: "Both decline: compute-engine answers NaN, Sage raises."
  mathlib4:
    in: "((5 : ℤ) % 0)"
    out: "5"
    verdict: inconclusive
    kind: convention
    note: Lean defines x % 0 = x; compute-engine leaves Mod by zero undefined.
```

Our own forms are implementations too. They are how we write the example, the same way
`wolfram` is how Wolfram writes it; they just have no answer to disagree with.

| Key                                           | Written by            | Meaning                                                                                                                   |
| --------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `epsil`                                       | `UPDATE_FORMS=1`      | the standard form: InputForm of `expr` and `expected`, text you can retype                                                |
| `tex`, `traditional`                          | `UPDATE_FORMS=1`      | TeXForm, and TraditionalForm where it differs from `tex`                                                                  |
| `notatio`                                     | `UPDATE_FORMS=1`      | the vdom serialisation (`design/vdom.md`'s structural tree as markup), which drops into Markdown, Vue or MDX as it stands |
| `<system>.in`                                 | `UPDATE_FORMS=1`      | what our transpiler emits — `@enumeratio/wolfram` for Wolfram, `@enumeratio/oracle`'s `MAPPINGS` for the rest             |
| `<system>.out`, `tex`, `verdict`              | the scan's `--accept` | what that kernel answered. `verdict` is left out when it is `agree`                                                       |
| `<system>.kind`, `note`, `issue`, `tolerance` | hand                  | the classification of any non-`agree` verdict, and a comparison tolerance where 1e-9 is too tight                         |

Every PR checks the generated rows offline, with no kernel: our printers against `epsil`,
`tex`, `traditional` and `notatio`, and the transpilers against each `<system>.in`. A
printer or transpiler change shows up as a data diff in the same PR.

`divergence` goes away. Its prose moves into `<system>.note`, next to the answer it
explains. A deliberate TeX difference goes in `wolfram.tex.note`; the `tex` pin is itself
the record of our choice. Every non-`agree` row still needs a `kind` from
`DIVERGENCE_KINDS`, and the scan carries classifications forward while a verdict holds and
resets them when it moves, as now.

The name matches the entry's existing `implementations`, whose `mapped` rows are already
"the equivalent call in an external system". The head-level record says what a head is
made of, and this one says how each of those writes and answers one example.

**Naming.** This uses `epsil` for the standard, retypeable form and keeps `notatio` for the
vdom serialisation, per the Names section of `AGENTS.md` and `design/syntax-and-formats.md`.

## 3. Identity

- `id` matches `^[a-z0-9]+(-[a-z0-9]+)*$`, is at most 48 characters, and is unique within
  its head (across packages, when two packages document the same head — `FromDigits`).
- It is assigned once and never derived again: the migration codemod slugs the caption,
  or the InputForm when there is no caption, and dedupes with `-2`. From then on it is just
  data. Rewording a caption or fixing an `expr` keeps the id.
- The global name is `<Head>/<id>`. The deep link is `/reference/symbol/<Head>#example/<id>`,
  and it cannot collide with a section. Sections keep their plain anchors: `#signatures`,
  `#details`, `#enumeration`, `#implementation` and the category slugs (`#possible-issues`).
- Tests are named `Mod example/zero-modulus`, and oracle case ids become
  `Mod/zero-modulus`. The implementations record is keyed by id. Nothing is keyed by
  expression text or position any more, and an edited `expr` shows up as a changed `in`
  row in the same PR rather than an orphan.
- **No redirects** from `#example-N`. Those anchors are hours old. The step that switches
  anchors rewrites the `- link:` lines in `<git-common-dir>/lanes/REVIEW.md` (surgically,
  touching nothing else, since feedback is written there live) and anything else in the
  tree that points at one.
- A CI check compares ids against the merge base. Deleting an id is allowed, since an
  example can go away. Renaming one needs a `renamed` note in the PR, so a link does not
  break by accident.

## 4. Storage format: YAML, with a strict scalar schema

| Format   | Nested MathJSON                               | Prose with LaTeX                    | Review                                |
| -------- | --------------------------------------------- | ----------------------------------- | ------------------------------------- |
| CSV      | JSON inside cells, double-quoted — unreadable | fine                                | line per example                      |
| JSONL    | fine                                          | `\\` escapes                        | lines of 500+ chars                   |
| JSON     | native                                        | `\\` escapes                        | noisy: quotes and brackets everywhere |
| **YAML** | flow style: `[Mod, 5, 0]`                     | plain or single-quoted, no escaping | closest to reading the math           |

YAML reads best, which matters most for files people review. Its hazard is implicit
typing: under YAML 1.2's core schema `True` is a boolean and `0o17` is 15, while in
MathJSON `True` is a symbol. That goes away if we don't use the core schema. We parse
with `yaml` (eemeli's, the standard one) on its `failsafe` schema plus four tags of our
own:

- `true` and `false` only, lowercase
- `null`
- JSON-grammar integers
- JSON-grammar floats

Everything else is a string: `True`, `False`, `NaN`, `No`, `yes`, `.inf`, `0o17`. That is
the JSON scalar model with YAML's syntax, so a record means exactly what its JSON would.
The schema is about twenty lines in `@enumeratio/entry`, and it has been tried against
`yaml@2.9`: those strings survive and records round-trip.

The rules that come with it:

- **One writer.** Every tool writes through a single `stringify` with that schema: flow
  style for MathJSON, single quotes where a string needs quoting. A test fails if any
  file differs from its own re-serialisation, which doubles as the formatter.
- A JSON Schema generated from the `@enumeratio/entry` types gives editor completion and
  validation, since the YAML language server reads JSON Schema.
- If anyone wants a spreadsheet, a flat TSV (`head, id, epsil in, epsil out, caption,
role`) can be generated from the data. It is never the source.

This is easy to reverse. The loader is the only reader, and a JSON writer is one flag.

**File per head, not per package.** About eight worktrees run at once, and a single file
per domain is where their merges collide today. With one file per head, two lanes collide
only when they touch the same head.

## 5. Demonstration vs test

`hidden: true` becomes `role: test`. The field says what the example is for, and the page
skips it because of that. A test example is run by the evaluation test and the scans like
any other. Review mode gets a toggle to show them.

This is also where math moves out of unit tests. `heads.test.ts` in `number-theory`,
`residues` and `numerals`, `hurwitz-zeta.test.ts`, and similar files are mostly
`expect(run(expr)).toEqual(value)`. Each assertion becomes a `role: test` example on its
head. The oracle-sourced package goldens (`analytic/*`, `adeles`, `gaussian`, `adic`,
`kronecker`) become test examples whose `<system>.out` is the value they pinned.
`special-functions.examples.json` folds into its four heads.

A unit test keeps a math value only when it tests a kernel below the head level (an
internal function with no head, a property sweep, quickcheck).

## 6. Oracle data lives in the implementations record

The sidecars become the implementations record: keyed by id instead of expression text,
one per head instead of per domain, and carrying our own forms and the transpiler contract
alongside the kernels' answers. What stays global moves to `packages/oracle/kernels.json`
(kernel versions), and the `disagreements.md` digest is still generated.

- **Hand files stay hand files.** Scans write only `<Head>.implementations.yaml`, and
  within it only `<system>.{out, tex, verdict}` for the systems in the run. The rewrite is
  structured, never textual, and a test pins that the hand-written classifications survive
  it.
- Nightly lanes still fail on a changed verdict, classification or `in` rather than on
  printed digits. `--accept` is the explicit write, which is what the fixup routine's PR
  carries.
- Nightly jobs run one per ecosystem, so each writes disjoint keys. The routine serialises
  their fixups as it does today.

## 7. Package layout

Symbol packages move to `packages/symbols/<group>/<package>/`. Each group's
symbol-specific components go into one package, `packages/components/<group>/`. Tooling
and the general interface stay at `packages/<name>`. Package names do not change
(`design/component-naming.md`); only paths move. The workspace globs become `packages/*`,
`packages/symbols/*/*` and `packages/components/*`.

| Group           | Symbol packages                                                                                           | Components (`packages/components/<group>`)                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `arithmetic`    | `residues`, `numerals`, `number-theory`, `adeles`                                                         | —                                                                                                                                      |
| `analysis`      | `analytic`                                                                                                | —                                                                                                                                      |
| `combinatorics` | `collections`, `statistics`, `domains`, `polytope`                                                        | `notatio-combinatorics`: `notatio-collection-table`, `notatio-polytope`, with their renderers (`collection-table.ts`, `polytope3d.ts`) |
| `algebras`      | `algebra`, `hypercomplex`, `geometric`, `diagram`, `groupalgebra`, `hecke`, `hopf`, `incidence`, `quiver` | —                                                                                                                                      |
| `groups`        | `braid`, `modular`                                                                                        | `notatio-groups`: `notatio-torus-square` (`torussquare.ts`); torus knots are `braid`'s                                                 |
| `evaluation`    | `aestimatio`                                                                                              | —                                                                                                                                      |

These stay at `packages/`: `boxed`, `entry`, `oracle`, `wolfram`, `formats`, `reference`,
`census`, `catalog`, `cli`, `raster`, `utils`, `notatio`, `notatio-lit`.

`notatio-lit` keeps everything that renders a Wolfram-general symbol — plots, `GraphPlot`,
`Curve3D`, the notebook, the controls. A group gets a component package the day it gets
its first renderer, never an empty placeholder.

Where each head's files go is decided by `provenance-data.ts`'s `declared`: extensions
and overrides go to the declaring package. Heads that are compute-engine's own, plus the
`unknown` provenance rows (about 130, triaged by hand in the codemod's routing table),
live in `packages/reference/entries/` — reference is the home of the engine's heads we
only document. `reference` still runs every example with the full engine
(`scripts/engines.ts`). Data sits with its package; the runner stays central, which keeps
the symbol packages free of a dependency on everything.

What the move has to touch outside `pnpm-workspace.yaml`: `nightly.yml` (oracle, adeles,
numerals and reference paths), `quickcheck.yml` (collections filter and script),
`web/.vitepress/data/cli.ts` and `cli.data.ts` (relative imports into `packages/cli`,
which does not move), and usage strings in script comments.

## 8. Migration

Each step is one PR, keeps main green, and leaves other lanes able to work. The codemods
are committed scripts under `packages/reference/scripts/migrate/` and are deleted in the
last step.

1. **Schema and loader.** Add `id` and `role` to `@enumeratio/entry` as optional fields,
   along with the implementations record type, the strict YAML schema and the single
   writer. Generate the JSON Schema, and add a Node-only loader
   (`@enumeratio/reference/node`) that reads `<package>/reference/*.yaml`. No data changes.
   `role` and `hidden` are both read during the transition.
2. **Ids.** A `ts-morph` codemod inserts `id` into every example in `entries/*.ts`, in the
   three package `entries.ts` files (and into their generators) and in
   `special-functions.examples.json`. `id` becomes required. In the same PR: the page
   anchors become `#example/<id>`, test names and oracle case ids switch over, the sidecars
   are rekeyed from `JSON.stringify(expr)` to id, and the `REVIEW.md` link lines and
   in-tree links are rewritten. Lanes that add examples from here on need ids, and the
   test says so.
3. **Layout move.** Pure `git mv` plus the path fixes in §7. No content changes, so git's
   rename detection carries open lanes through a rebase. Land it at a quiet moment, and
   announce it to the lane coordinators first.
4. **Data flip.** A codemod evaluates the TS entries and writes `<package>/reference/<Head>.yaml`,
   routed as in §7. From then on `packages/reference/src/entries/*.ts` are **generated
   shims** re-exporting from the YAML, and a test fails if a shim is edited by hand. A lane
   caught mid-flight re-runs `migrate/port-ts.ts` on its own branch's TS to replay its
   edits into the YAML.
5. **Consumers flip.** `web/.vitepress/data/reference.ts`, `entries.test.ts`,
   `oracle-scan.ts`, `oracle-quickcheck.ts`, the crosswalk, provenance and
   `validate-wolfram.ts` scripts, and `texform-alignment.test.ts` move onto the loader.
   Then the shims and `src/entries/` are deleted.
6. **Implementations record.** The sidecars (already keyed by id) are split per head into
   `<Head>.implementations.yaml`, and `divergence` prose merges into `note`. The
   `UPDATE_FORMS=1` generator fills our forms and each `<system>.in`, and a test pins them.
   Kernel versions go to `packages/oracle/kernels.json`, the scan learns `--accept`, and
   these are retired: the sidecars, `oracle-golden.test.ts`'s key checks, the
   texform-alignment golden and `round-trip.json`. Round trip runs over every example's
   `wolfram.in` instead, with a `back` pinned only for the documented lossy heads. Waits on
   the `epsil`/`notatio` naming (§2).
7. **Unit-test math into examples.** One PR per package, in parallel lanes after step 5,
   following §5. Each PR deletes the assertions it moved.

Steps 1–2 can land as soon as this is signed off. Step 3 is independent of 4–7 and can go
whenever the lanes are quiet. Component extraction (§7, right-hand column) is its own
track, after step 3.

## 9. Risks

- **Mid-flight lanes across the flip (step 4).** It is the one step that invalidates open
  edits to `entries/*.ts`. The mitigations are `port-ts.ts`, announcing it, and landing it
  alone.
- **Codemod fidelity.** The TS entries contain computed values (`DOMAIN` constants,
  spreads, helpers). Evaluating the modules rather than parsing them flattens those
  correctly. The check: a test that the shims deep-equal the old modules before anything
  is deleted.
- **YAML typing.** The strict schema closes the known traps, but only if everything goes
  through the one reader and writer. A stray `yaml.parse` with defaults would quietly turn
  `True` into `true`. A lint rule bans importing `yaml` outside `@enumeratio/entry`.
- **`#example/<id>` in VitePress.** A `/` in a hash is legal and `getElementById` takes
  it, but CSS selectors need `CSS.escape`, and `followHash` has to see the exact string.
  Verify on the step 2 preview.
- **Browser bundle.** `ExampleAlternatives.vue` imports `@enumeratio/reference` in the
  client. The filesystem loader must stay on the `/node` subpath or it will break the site
  build.
- **Scan writes.** They are now confined to the implementations record, but a writer bug
  could still drop classifications. The mitigations are the structured rewrite, the test
  that classifications survive it, and `--accept` always going through a PR.
- **Shared heads.** A head documented in two packages (`FromDigits`) has one id space. The
  loader checks for collisions, and the codemod dedupes across packages.
- **The layout move vs `vp run -r` ordering.** Nesting does not change package names or
  dependency edges, but check `ignoreWorkspaceCycles` and `vp run -r` resolution on the
  step 3 branch before landing.
- **`unknown` provenance routing.** About 130 heads need a human call on their home. The
  codemod fails on any unrouted head rather than guessing.

## 10. For sign-off

1. YAML with the strict scalar schema, two files per head per package (§2, §4).
2. `implementations` as the name for the per-example record, sharing its vocabulary with
   the head-level `implementations` (§2).
3. `epsil` as the standard form and `notatio` as the vdom serialisation — a Names change
   to record in `AGENTS.md` and `design/syntax-and-formats.md` (§2).
4. `role: test` replacing `hidden` (§5).
5. The grouping in §7, and one component package per group, created only when the group
   has a renderer.
6. The engine's own heads living in `packages/reference/entries/`.
7. The order in §8, especially the layout move before the data flip.
