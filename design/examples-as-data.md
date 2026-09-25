# Design: examples as data

Status: **proposed** (2026-09-25), for sign-off before any of §8 runs.

The reference examples become where enumeratio's math is tested. Unit tests stay for
plumbing — parsers, printers, the CLI, the elements. Every example is plain data that lives
in the package declaring its head, carries a stable id, and pins how each other system
writes and answers it. The goldens, divergence notes and oracle dumps we keep today get
folded into it.

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
  `wolfram/tests/golden/round-trip.json` (`Head#n`) are one-row-per-example derivatives. Around
  40 package goldens (`analytic`, `collections`, `adeles`, `numerals`, `number-theory`,
  `modular`) pin oracle-sourced values that are examples in all but name.

Identity is an array index: the page anchors `#example-N`, `entries.test.ts` names
`Mod example 3`, and the goldens use `#n`. Inserting an example renumbers everything
after it.

## 2. The record

One JSON file per head per package: `<package>/reference/<Head>.json`. It holds the whole
entry (summary, signatures, details, references, implementations), and `examples` is an
array in page order. A worked example, `Mod(5, 0)`, as it would land:

```json
{
  "id": "zero-modulus",
  "expr": ["Mod", 5, 0],
  "expected": "NaN",
  "caption": "Division by a 0 modulus yields NaN rather than an error",
  "category": "Possible issues",
  "forms": {
    "notatio": { "in": "Mod(5, 0)", "out": "NaN" },
    "tex": { "in": "5\\bmod0", "out": "\\operatorname{NaN}" }
  },
  "systems": {
    "wolfram": {
      "in": "Mod[5, 0]",
      "out": "Indeterminate",
      "tex": { "in": "(5 \\bmod 0)", "out": "\\text{Indeterminate}" }
    },
    "sage": {
      "in": "(5 % 0)",
      "out": "ZeroDivisionError: Integer modulo by zero",
      "verdict": "error",
      "kind": "undefined-form",
      "note": "Both decline: compute-engine answers NaN, Sage raises."
    },
    "mathlib4": {
      "in": "((5 : ℤ) % 0)",
      "out": "5",
      "verdict": "inconclusive",
      "kind": "convention",
      "note": "Lean defines x % 0 = x; compute-engine leaves Mod by zero undefined."
    },
    "rust": {
      "in": "mod_floor(n(5), n(0))",
      "out": "panic: attempt to divide by zero",
      "verdict": "error",
      "kind": "undefined-form",
      "note": "Both decline: compute-engine answers NaN, Rust panics."
    }
  }
}
```

| Field                                            | Written by                   | Meaning                                                                                                                                              |
| ------------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                             | hand (codemod once)          | §3                                                                                                                                                   |
| `expr`, `expected`                               | hand                         | MathJSON, as today. `expected` is the pinned evaluation                                                                                              |
| `caption`, `category`                            | hand                         | as today                                                                                                                                             |
| `role`                                           | hand                         | `"demo"` (default) or `"test"` — §5                                                                                                                  |
| `aspirational`                                   | hand                         | as today, plus an optional `issue`                                                                                                                   |
| `volatile`                                       | hand                         | as today                                                                                                                                             |
| `forms`                                          | `UPDATE_FORMS=1`             | **our** renderings of `expr` / `expected`: `notatio` (InputForm), `tex` (TeXForm), `traditional` (TraditionalForm, only where it differs from `tex`) |
| `systems.<s>.in`                                 | `UPDATE_FORMS=1`             | what our transpiler emits for system `s` — `@enumeratio/wolfram` for Wolfram, `@enumeratio/oracle`'s `MAPPINGS` for the rest                         |
| `systems.<s>.out`, `tex`, `verdict`              | the oracle scan (`--accept`) | what that kernel answered. `verdict` is left out when it is `agree`                                                                                  |
| `systems.<s>.kind`, `note`, `issue`, `tolerance` | hand                         | the classification of any non-`agree` verdict, and a comparison tolerance where 1e-9 is too tight                                                    |

MathJSON stays authoritative for `expr`/`expected`. It is what compute-engine consumes and
what the scan compares. `forms.notatio` puts the readable spelling next to it, so the file
reads as notatio and the InputForm printer gets checked against 3,000 inputs for free.

`divergence` goes away. Its prose moves into `systems.<s>.note`, next to the answer it
explains. A deliberate TeX difference goes in `systems.wolfram.tex.note`. The `forms.tex`
pin is itself the record of our choice.

Every non-`agree` row still needs a `kind` from `DIVERGENCE_KINDS`, and the scan carries
classifications forward while a verdict holds and resets them when it moves, as now.

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
  `Mod/zero-modulus`. Nothing is keyed by expression text or position any more.
- **No redirects** from `#example-N`. Those anchors are hours old. The step that switches
  anchors rewrites the `- link:` lines in `<git-common-dir>/lanes/REVIEW.md` (surgically,
  touching nothing else, since feedback is written there live) and anything else in the
  tree that points at one.
- A CI check compares ids against the merge base. Deleting an id is allowed, since an
  example can go away. Renaming one needs a `renamed` note in the PR, so a link does not
  break by accident.

## 4. Storage format: JSON

| Format   | Nested MathJSON                               | Prose with LaTeX                    | Diffs / merges                | Tooling here                                                                    |
| -------- | --------------------------------------------- | ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| CSV      | JSON inside cells, double-quoted — unreadable | fine                                | line per example, good        | none; no schema                                                                 |
| JSONL    | fine                                          | fine                                | good, but lines of 500+ chars | `vp fmt` won't wrap                                                             |
| YAML     | fine                                          | nicest                              | good                          | new dep; `True`, `NaN`, `No` parse as non-strings, and MathJSON is full of them |
| **JSON** | native                                        | `\\` escapes, as the TS already has | good per head file            | `vp fmt`, JSON Schema in the editor, native `import`, no deps                   |

CSV loses on the thing that matters most here: MathJSON and `systems` are trees. YAML's
implicit typing is a trap for MathJSON in particular — `True` is a boolean in YAML 1.2
core and a symbol in MathJSON — and it is a new dependency. JSON it is. A JSON Schema
generated from the `@enumeratio/entry` types gives editor completion and validation.

If anyone wants a spreadsheet, a flat TSV (`head, id, notatio in, notatio out, caption,
role`) can be generated from the data. It is never the source.

**File per head, not per package.** About eight worktrees run at once, and a single file
per domain is where their merges collide today. With one file per head, two lanes collide
only when they touch the same head.

## 5. Demonstration vs test

`hidden: true` becomes `role: "test"`. The field says what the example is for, and the page
skips it because of that. A test example is run by the evaluation test and the scans like
any other. Review mode gets a toggle to show them.

This is also where math moves out of unit tests. `heads.test.ts` in `number-theory`,
`residues` and `numerals`, `hurwitz-zeta.test.ts`, and similar files are mostly
`expect(run(expr)).toEqual(value)`. Each assertion becomes a `role: "test"` example on its
head. The oracle-sourced package goldens (`analytic/*`, `adeles`, `gaussian`, `adic`,
`kronecker`) become test examples whose `systems.<s>.out` is the value they pinned.
`special-functions.examples.json` folds into its four heads.

A unit test keeps a math value only when it tests a kernel below the head level (an
internal function with no head, a property sweep, quickcheck).

## 6. Oracle data: folded in, not a sidecar

Dean left this open. **Fold it into the example.** The alternative was keeping observed
runs in a machine-written sidecar keyed by id. That keeps scans off the hand-edited
files, but it splits the transpiler contract (`in`), the answer (`out`) and the
classification (`kind`/`note`) across two files that must agree, and that disagreement is
the bug class `oracle-golden.test.ts` polices today. With per-head files, a scan's write
only conflicts with a lane on the same head.

What stays separate is truly global: kernel versions move to `packages/oracle/kernels.json`,
and the `disagreements.md` digest is still generated.

The rules the scan writer has to follow:

- It rewrites only `systems.<s>.{out, tex, verdict}` for the systems in the run. It works
  through a parsed JSON rewrite, never text, and every hand field round-trips byte-for-byte
  (a test pins that).
- Nightly lanes still fail on a changed verdict, classification or `in` rather than on
  printed digits. `--accept` is the explicit write, which is what the fixup routine's PR
  carries.
- Every PR checks `systems.<s>.in` offline against the transpilers, with no kernel. A
  transpiler change shows up as a data diff in the same PR.

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

Where each head's file goes is decided by `provenance-data.ts`'s `declared`: extensions
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

1. **Schema and loader.** Add `id`, `role`, `forms` and `systems` to `@enumeratio/entry` as
   optional fields, generate the JSON Schema, and add a Node-only loader
   (`@enumeratio/reference/node`) that reads `<package>/reference/*.json`. No data changes.
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
4. **Data flip.** A codemod evaluates the TS entries and writes
   `<package>/reference/<Head>.json`, routed as in §7. From then on
   `packages/reference/src/entries/*.ts` are **generated shims** re-exporting from the JSON,
   and a test fails if a shim is edited by hand. A lane caught mid-flight re-runs
   `migrate/port-ts.ts` on its own branch's TS to replay its edits into the JSON.
5. **Consumers flip.** `web/.vitepress/data/reference.ts`, `entries.test.ts`,
   `oracle-scan.ts`, `oracle-quickcheck.ts`, the crosswalk, provenance and
   `validate-wolfram.ts` scripts, and `texform-alignment.test.ts` move onto the loader.
   Then the shims and `src/entries/` are deleted.
6. **Forms.** The `UPDATE_FORMS=1` generator fills `forms` and `systems.<s>.in`. A test
   pins them, and the texform-alignment golden and `round-trip.json` are retired: round
   trip runs over every example's `systems.wolfram.in`, with a `back` pinned only for the
   documented lossy heads.
7. **Oracle fold.** Sidecar rows move into `systems.<s>`, `divergence` prose merges into
   `note`, kernel versions go to `packages/oracle/kernels.json`, and the scan learns
   `--accept`. The sidecars and `oracle-golden.test.ts`'s key checks are deleted.
8. **Unit-test math into examples.** One PR per package, in parallel lanes after step 5,
   following §5. Each PR deletes the assertions it moved.

Steps 1–2 can land as soon as this is signed off. Step 3 is independent of 4–8 and can go whenever the lanes
are quiet. Component extraction (§7, right-hand column) is its own track, after step 3.

## 9. Risks

- **Mid-flight lanes across the flip (step 4).** It is the one step that invalidates open
  edits to `entries/*.ts`. The mitigations are `port-ts.ts`, announcing it, and landing it
  alone.
- **Codemod fidelity.** The TS entries contain computed values (`DOMAIN` constants,
  spreads, helpers). Evaluating the modules rather than parsing them flattens those
  correctly. The check: a test that the shims deep-equal the old modules before anything
  is deleted.
- **`#example/<id>` in VitePress.** A `/` in a hash is legal and `getElementById` takes
  it, but CSS selectors need `CSS.escape`, and `followHash` has to see the exact string.
  Verify on the step 2 preview.
- **Browser bundle.** `ExampleAlternatives.vue` imports `@enumeratio/reference` in the
  client. The filesystem loader must stay on the `/node` subpath or it will break the site
  build.
- **Scan writes into hand files (§6).** A writer bug could clobber captions or
  classifications. The mitigations are the structured rewrite plus the byte-for-byte
  round-trip test, and `--accept` always going through a PR.
- **File growth.** `systems` for eight lanes makes an example 10–20 lines, about 50k
  lines of JSON in all. That is about what the sidecars are today, just moved.
  One-line `{ "in": …, "out": … }` objects keep it scannable.
- **Shared heads.** A head documented in two packages (`FromDigits`) has one
  id space. The loader checks for collisions, and the codemod dedupes across packages.
- **The layout move vs `vp run -r` ordering.** Nesting does not change package names or
  dependency edges, but check `ignoreWorkspaceCycles` and `vp run -r` resolution on the
  step 3 branch before landing.
- **`unknown` provenance routing.** About 130 heads need a human call on their home. The
  codemod fails on any unrouted head rather than guessing.

## 10. For sign-off

1. JSON, one file per head per package (§4).
2. The oracle data folded into `systems` rather than kept as a sidecar (§6).
3. `role: "test"` replacing `hidden` (§5).
4. The grouping in §7, and one component package per group, created only when the group
   has a renderer.
5. The engine's own heads living in `packages/reference/entries/`.
6. The order in §8, especially the layout move before the data flip.
