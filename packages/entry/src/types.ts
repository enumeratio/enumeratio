import type { CatalogGrade, Reference } from "./reference.ts";

/** Systems compute-engine results may be cross-checked against (see `divergence`). */
export type DivergenceSystem = "wolfram" | "numpy" | "sympy";

/** How an external system's run of an example compared to ours. */
export type OtherSystemVerdict = "agree" | "disagree" | "inconclusive" | "error";

/** One system's exact run of one example — from the implementations records (see `@enumeratio/oracle`). */
export interface OtherSystemRun {
  readonly input: string;
  readonly output: string;
  readonly verdict: OtherSystemVerdict;
  /** Any verdict but `agree`: one of `DIVERGENCE_KINDS`, carried forward by the scan. */
  readonly kind?: string;
  readonly note?: string;
  /** Relative tolerance for a numeric comparison, where 1e-9 is too strict for this row. */
  readonly tolerance?: number;
  /** `ours` only: the GitHub issue tracking the gap. */
  readonly issue?: number;
  /** Wolfram only: the digits it displays for an arbitrary-precision value -- its `N[x, d]`
   * holds more than it shows, and `output` is its `InputForm`, which prints them all. */
  readonly shown?: string;
  /** Wolfram only: its `TeXForm` of the input as written and of the value. */
  readonly tex?: { readonly input: string; readonly output: string };
}

/** A MathJSON expression (form-agnostic compute-engine input/output). */
export type MathJSON = number | string | boolean | readonly MathJSON[] | { readonly [key: string]: unknown };

/**
 * One worked example. Outputs shown on a reference page are re-derived live by
 * compute-engine, so they can't drift; `expected` is the pinned evaluation used
 * by the reference tests to catch capability regressions.
 */
export interface ReferenceExample {
  /**
   * Stable within the head (across packages, when two document it): `^[a-z0-9]+(-[a-z0-9]+)*$`,
   * at most 48 characters. Assigned once and kept when the caption or `expr` changes. The
   * deep link is `#example/<id>`, tests are `<Head> example/<id>`, oracle rows key on it.
   */
  readonly id: string;
  readonly expr: MathJSON;
  readonly expected: MathJSON;
  /**
   * A value this example is known to have, from outside our own evaluation: an exact
   * expression (`[Divide, [Power, Pi, 2], 6]`) or a high-precision number. `expected` pins what
   * we compute, which a regeneration could silently change; `known` is what we must agree with
   * (tests/known.test.ts), so a change to `expected` that breaks it is a bug, not an update.
   */
  readonly known?: MathJSON;
  /**
   * Marks `expected` as deliberately off `known`: compute-engine follows another convention than
   * the source of `known` (a directed infinity, say). The note names both. A marked row still
   * has to disagree with `known` (tests/known.test.ts), so a stale marker fails.
   */
  readonly knownConvention?: string;
  /**
   * Marks `expected` as short of `known` because of a missing capability: `known` is the target
   * and holds in compute-engine's own model too. The note says what is missing.
   */
  readonly knownGap?: string;
  /** Tolerance for comparing `expected` with a numeric `known`: relative above magnitude 1,
   * absolute below it (default 1e-12). */
  readonly tolerance?: number;
  /** Where `known` comes from: `DLMF 25.6.E1`, `OEIS A000110`, `Fungrim 2f8a1c`, `FindStat
   * St000001`, `mpmath 1.3 zeta`, … Required with `known`. */
  readonly source?: string;
  readonly caption?: string;
  /**
   * Grouping heading -- "Basic", "Scope", "Applications", "Properties",
   * "Possible issues", "Neat examples". Defaults to "Basic".
   */
  readonly category?: string;
  /**
   * The Wolfram mismatch this row waits on, when its `role` is `triage`: where the mismatch most
   * likely comes from (`bucketOf` in the reference scripts), for a lane to settle. The reason
   * a lane gives stays in the Wolfram row's `note`.
   */
  readonly triage?: TriageBucket;
  /**
   * Derived by the loader, never written in a record: Wolfram's `note` from the head's
   * implementations record, where our result deliberately differs from Wolfram's. The
   * page shows a "differs from <system>" chip per key, and the note.
   */
  readonly divergence?: Readonly<Record<string, string>>;
  /**
   * Rule keys in the result whose values differ run to run (`AbsoluteTimeUsed`). The
   * examples test masks them on both sides; the page doesn't assert the example.
   */
  readonly volatile?: readonly string[];
  /**
   * For an example whose value draws: the shape of the box it lowers to, asserted in Node
   * (`@enumeratio/frontend`'s `tests/example-boxes.test.ts`), never as pixels.
   */
  readonly boxes?: BoxShape;
  /**
   * Cases of one example: examples sharing a `group` show as a single card, where the
   * first sits, cycling through the rest. Each case is still its own example -- its own
   * test, oracle row and `#example/<id>`; the card carries its first case's anchor, and a
   * link to any other case shows that case on it. For near-identical cases that demonstrate
   * nothing over the first.
   */
  readonly group?: string;
  /**
   * What the example is FOR (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §5). `demo` (the default) is shown
   * on the reference page; `test` runs in the evaluation test and the scans like any other
   * example but is skipped by the page (a deep link still shows one): an edge case or a grid
   * point, too many or too minor to render. `aspirational`: `expected` is a result we claim
   * compute-engine ought to produce but does NOT yet (the reference doubles as a capability
   * map); the page shows the actual result with a "not yet implemented" badge, and the test
   * asserts the gap still exists, so we notice when it closes. `triage`: an example Wolfram
   * disagrees with, waiting for a lane to classify or fix it (`triage` says where the mismatch
   * likely comes from); `expected` is our current answer, not a claim, so tests, scans and the
   * page leave it out.
   */
  readonly role?: ExampleRole;
  /** Derived by the loader: each scanned system's run of this example, from the implementations record. */
  readonly others?: Readonly<Record<string, OtherSystemRun>>;
}

/**
 * What a drawn value lowers to, in the terms a box is made of. Every field but `head` is
 * asserted only when written, so a shape of `head` alone says the box is that kind and no more.
 * `marks` and `roles` are exact (a kind or role not listed must not occur), `options` is the
 * listed keys (numbers to a relative 1e-9), `operands` the box's operands before its options.
 */
export interface BoxShape {
  /** The root box's head: `GraphicsBox`, `SliderBox`. */
  readonly head: string;
  /** Primitives in a drawing, by kind (`LineBox: 2`), counted through its styling and tags. */
  readonly marks?: Readonly<Record<string, number>>;
  /** A drawing's marks by the role their tag names (`Series`, `Bar`, `Vertex`). */
  readonly roles?: Readonly<Record<string, number>>;
  /** Options of the root box (`Axes`, `ScalingFunctions`, `PlotRange`, …), compared as listed. */
  readonly options?: Readonly<Record<string, unknown>>;
  /** The box's operands, options excluded, as MathJSON: a control's binding and range. */
  readonly operands?: readonly unknown[];
}

/** What an example is for (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §5). */
export type ExampleRole = "demo" | "test" | "aspirational" | "triage";

/** Where a Wolfram mismatch most likely comes from (see `ReferenceExample.triage`). */
export type TriageBucket = "adapt" | "emit" | "compare" | "ours?" | "wolfram?" | "unscanned" | "gap" | "print";

/** One call signature the head accepts, with a short explanation. */
export interface ReferenceSignature {
  readonly call: string;
  readonly description: string;
  /**
   * Which library defines this call form. Omitted / "compute-engine" for the
   * built-in signature; an extension library name (e.g. "combinatorial-ext",
   * "enumeratio-collections") for a signature we add. Lets a head carry
   * signatures contributed by several libraries.
   */
  readonly library?: string;
  /** Operand count of this call form, when the head means something else at another. */
  readonly arity?: number;
  /**
   * This overload's compute-engine type, `(boxes, boxes, expression*) -> boxes`. The
   * declaring package declares it from here (https://github.com/enumeratio/enumeratio/wiki/Manifest); a reference test checks
   * the engine agrees.
   */
  readonly type?: string;
  /** The library whose overlapping overload this one replaces (https://github.com/enumeratio/enumeratio/wiki/Manifest). */
  readonly overrides?: string;
  /** The carriers this overload applies to (an operand's head is one of them), when it applies
   *  to nothing else: it matters only where one of them exists, so doesn't pull its package. */
  readonly on?: readonly string[];
  /** The symbol names it applies to, as regular expressions (`^e_[1-9]\d*$`), when it applies
   *  to nothing else: it matters only where an expression names one. */
  readonly symbols?: readonly string[];
  /** The carrier types it applies to (`permutation`), when it applies to nothing else. */
  readonly types?: readonly string[];
  /**
   * Where THIS call form lives elsewhere, when the head's references do not apply to it
   * wholesale -- two-argument `Zeta` is Hurwitz's function and links to Hurwitz's pages.
   */
  readonly references?: readonly Reference[];
}

/**
 * WHERE an implementation can run. A head is not simply "implemented" — several of ours
 * only mean anything in a particular environment, and a reader deserves to know which.
 *
 * - `engine`   plain compute-engine evaluation; works anywhere the engine does
 * - `browser`  needs the DOM, and usually a custom element (`<graphics-box>` et al.)
 * - `gpu`      compiled to WGSL/GLSL and evaluated on the GPU (`gpu-eval.ts`)
 * - `node`     server-side only (filesystem, a spawned kernel)
 * - `external` another system's kernel entirely — Wolfram, SymPy, Sage
 */
export type Environment = "engine" | "browser" | "gpu" | "node" | "external";

/**
 * WHAT KIND of thing an implementation is, which decides whether it is stored here,
 * derived on demand, or merely pointed at.
 *
 * - `reference` authored by us as an Epsil expression — the interpretable specification
 *   (a definition is enumeratio's, whatever surface it is typed in), and the differential
 *   oracle for every other row (https://github.com/enumeratio/enumeratio/wiki/Namespaces §6)
 * - `native`    authored by us in TypeScript — what actually runs; stored as a POINTER,
 *   because the source lives in the repo and a copy here would rot
 * - `compiled`  produced by a compute-engine compile target (numpy, glsl, wgsl, js);
 *   derivable live from the expression, so normally not stored at all
 * - `component` bottoms out in a web component — the head's meaning IS the rendered element
 * - `mapped`    the equivalent call in an external system; the table lives in
 *   `@enumeratio/oracle`'s MAPPINGS, keyed by signature
 */
export type BindingOrigin = "reference" | "native" | "compiled" | "component" | "mapped";

/** One of the several things a head is "made of". */
export interface ReferenceBinding {
  readonly origin: BindingOrigin;
  /** Target or language: "notatio", "typescript", "wgsl", "numpy", "<graphics-box>", … */
  readonly form: string;
  readonly environment?: Environment;
  /**
   * `reference` only: the defining expression, as MathJSON, over `_`-prefixed wildcards
   * matching the head's parameters. Evaluable — which is the whole point, since it is what
   * the differential test runs against the native implementation.
   */
  readonly expr?: MathJSON;
  /** `native` / `component`: where it lives, as `path/to/file.ts:line` or an element name. */
  readonly source?: string;
  /** Literal source, for a row that cannot be derived live. */
  readonly code?: string;
  /** What evaluating it produces here, when that is not simply a number or expression. */
  readonly produces?: string;
  /** `mapped` only: the operand count this row applies to. Omitted matches any arity --
   * @enumeratio/oracle's `mappingFor` prefers an arity-specific row over one with none. */
  readonly arity?: number;
  /** `mapped` only: the source template, `$n` for the n-th operand (`@enumeratio/oracle`'s
   * `Mapping.emit` entry for this row's `form`). */
  readonly template?: string;
  /** `mapped` only: 1-based operand this head threads over, for a system whose plain function
   * call doesn't auto-thread a list the way compute-engine and Wolfram do (`THREADS_MANUALLY`). */
  readonly threadArg?: number;
  readonly note?: string;
  /** Present (`false`) only on a row documenting that this row's `form` genuinely has no
   * counterpart for the head -- checked, not merely unmapped yet. A real mapping omits it. */
  readonly counterpart?: false;
  /** When this row was last checked against `form`, and against what version -- for both a
   * mapping and a documented "no counterpart" (`$VersionNumber` for Wolfram,
   * `sympy.__version__` / `mpmath.__version__` / Sage's `version()`, …). */
  readonly checked?: {
    readonly version: string;
    readonly on: string;
  };
}

/**
 * Why a head does NOT reduce further — it sits on the primitive frontier
 * (https://github.com/enumeratio/enumeratio/wiki/Namespaces §6.1). Every head either has a `reference` implementation or
 * declares one of these; nothing is allowed to be silently irreducible.
 */
export type PrimitiveReason =
  /** A kernel: an algorithm over mutable state that would not be readable as a tree. */
  | "kernel"
  /** Irreducibly numeric — it evaluates rather than rewrites. */
  | "numeric"
  /** Hands off to something outside the engine entirely. */
  | "foreign"
  /** Definitional. It is what other things are defined IN TERMS OF. */
  | "axiom";

/**
 * A head's name in another system's own vocabulary, where that differs from ours -- the
 * hand-kept half of the crosswalk (https://github.com/enumeratio/enumeratio/wiki/Speculative-Symbol-Metadata). The mechanically
 * derived half (Fungrim identities, the oracle's per-arity mapping) lives in `bindings:` and
 * the generated crosswalk data; this is what a human had to type in.
 */
export interface ReferenceNames {
  /** Fungrim's own spelling, when a head whose page it publishes doesn't use ours verbatim. */
  readonly fungrim?: string;
  /** The DLMF index's own wording, when it doesn't use this head's Wikipedia title verbatim. */
  readonly dlmf?: string;
  /** The Wikidata id to use INSTEAD of the one compute-engine's own definition carries, when
   * that one is wrong (`scripts/audit-wikidata.ts`). */
  readonly wikidata?: string;
  /** The engine's own Wikidata id was checked by hand and found right -- no `wikidata`
   * override needed, but worth marking so the audit doesn't ask again. */
  readonly wikidataConfirmed?: boolean;
  /** The catalog's subject name for this head, when its rows are recorded under a different
   * spelling (`SymmetricGroup`'s rows are the catalog's `Permutations`). */
  readonly catalog?: string;
  /** Wolfram's own spelling, when it differs from ours (`Add` -> `Plus`). Omitted for a head
   * whose Wolfram name IS ours -- see `wolframIdentity` for how that case is marked instead. */
  readonly wolfram?: string;
  /** This head is a genuine Wolfram head under its own name -- no `wolfram` override needed,
   * but the fact still has to be recorded somewhere: `to-wolfram.ts`'s `isWolframHead` (a
   * kernel oracle may be asked about this head) reads exactly one of `wolfram` or
   * `wolframIdentity`, never neither, for a head it vouches for. */
  readonly wolframIdentity?: boolean;
}

/**
 * A combinatorial map's law, checked at one element (https://github.com/enumeratio/enumeratio/wiki/Plausible §4.2) -- the
 * shorthand vocabulary written on a map's record (`@enumeratio/combinatorics`' own generator
 * writes it into `CombinatorialMap.laws`/`.orderIsomorphism` at build time; `checkLaws`
 * (@enumeratio/structures) reads that same shape, unchanged). `on` disambiguates a law that
 * applies to only ONE of a shared name's overloads (`BinaryTree` is two maps, from
 * `binary_tree_parent_array` and from `dyck_path`, each with its own inverse) -- the same
 * convention `ReferenceSignature.on` uses; omitted, the law applies to every overload this
 * record's name has.
 */
export type EntryLaw =
  | "involution"
  | "idempotent"
  | { readonly inverse: string; readonly on?: string }
  | {
      readonly orderIsomorphism: { readonly from: string; readonly to: string; readonly sizeOffset?: number };
      readonly on?: string;
    };

/** A single compute-engine function's reference entry. */
export interface ReferenceEntry {
  readonly name: string;
  readonly domain: string;
  readonly signature: string;
  readonly summary: string;
  readonly examples: readonly ReferenceExample[];
  /**
   * A finite indexed collection to show *enumerated* on this head's page, drawn by
   * `<notatio-collection-table>` (paged by unranking `At`, never materialised). Set on
   * the enumerable family heads (`Subsets`, `SymmetricGroup`, …); `columns` and `glyph`
   * are forwarded to the table.
   */
  readonly enumerate?: {
    readonly expr: string;
    readonly columns?: string;
    readonly glyph?: string;
    readonly pageSize?: number;
  };
  readonly seeAlso?: readonly string[];
  /** All argument signatures the head accepts, each with a caption. */
  readonly signatures?: readonly ReferenceSignature[];
  /** A "Details" panel: bullet notes about the concept and how it behaves. */
  readonly details?: readonly string[];
  /**
   * Derived by the loader, never written in a record's front matter: `index.md`'s markdown
   * body, which the page renders as prose. `details` is read from it.
   */
  readonly body?: string;
  /**
   * Default display form for the Out cell on this entry's page (StandardForm by
   * default). A compile-target entry sets this to its form, e.g. "wolfram", so
   * every example dumps that form's source string.
   */
  readonly outForm?: string;
  /**
   * Whether Out cells evaluate the expression (default true). A compile-target
   * entry sets this false so the Out shows the form of the expression itself
   * (e.g. its Wolfram full form), not of the evaluated result.
   */
  readonly outEvaluate?: boolean;
  /**
   * What this head is made of: its interpretable definition, the TypeScript that actually
   * runs, the component it bottoms out in, the systems it maps to. Several rows, because
   * there are genuinely several implementations and the point is to see them together.
   */
  readonly bindings?: readonly ReferenceBinding[];
  /** Set when the head is on the primitive frontier and has no `reference` row. */
  readonly primitive?: PrimitiveReason;
  /**
   * Where this head lives in other systems, as the author knows it. The page shows these
   * alongside what the crosswalk derives (Wikidata from the engine, Fungrim, Wolfram, the
   * catalog's FindStat and Sage rows) -- see `crosswalk/`.
   */
  readonly references?: readonly Reference[];
  /**
   * The enumeratio catalog's own crosswalk rows for this head (or, for a statistic or map,
   * for its name and every carrier it overloads) -- separate from `references` so the
   * crosswalk can keep telling the two apart (`origin: "catalog"` vs `"curated"`) now that
   * both are hand-kept records. `names.catalog` says which catalog name these are filed
   * under when it differs from this head's own.
   */
  readonly catalog?: readonly Reference[];
  /**
   * What `@enumeratio/catalog`'s `declareCatalog` needs to register this head as a resource
   * (https://github.com/enumeratio/enumeratio/wiki/Speculative-Symbol-Metadata), moved here off the retired
   * packages/catalog/src/catalog-data.ts. Presence is the kind: `grades` marks a catalogued
   * collection, `statOn`/
   * `mapOn` a statistic or map (its overload set), `catalogCarrier` a bare carrier -- a name
   * can be more than one (`Finset` is both a carrier and a map). Description and title fold
   * into `summary`; a name's own catalog id and `aliasOf` have no runtime reader and are not
   * kept.
   */
  readonly carrier?: string;
  readonly grades?: readonly CatalogGrade[];
  readonly unbounded?: boolean;
  readonly catalogCarrier?: true;
  readonly statOn?: readonly string[];
  readonly mapOn?: readonly string[];
  /** This head's own vocabulary in other systems -- Fungrim, the DLMF, Wikidata, the catalog. */
  readonly names?: ReferenceNames;
  /**
   * Old names this head was declared under, oldest first -- a data alias, same idea as the
   * numerals systems' aliases. `@enumeratio/statistics`'s `blessedName` reads the generated
   * table built from these, not this field directly (https://github.com/enumeratio/enumeratio/wiki/Speculative-Symbol-Metadata).
   */
  readonly formerly?: readonly string[];
  /**
   * Generated rather than written, so the head has a page and a crosswalk: `engine` for a
   * compute-engine symbol we neither extend nor document by hand, `carrier` for a domain.
   */
  readonly stub?: "engine" | "carrier";
  /** Wolfram-style attributes; `HoldAll` is compute-engine's `lazy` (https://github.com/enumeratio/enumeratio/wiki/Manifest). */
  readonly attributes?: readonly SymbolAttribute[];
  /** A library symbol's definition, in Epsil: what packing makes its `definition.json` from. */
  readonly definition?: EpsilDefinition;
  /** A combinatorial map's laws, in the shorthand vocabulary -- see `EntryLaw`. Absent for
   *  anything that isn't a map. */
  readonly laws?: readonly EntryLaw[];
}

export type SymbolAttribute = "HoldAll";

/**
 * A definition as its author writes it (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2):
 * Epsil throughout. Packing parses it into `definition.json`, the body a `Function` over the
 * signature's parameter names, and fills each pin it can find.
 */
export interface EpsilDefinition {
  /** Named parameters, `?` for an option: `(n: integer, sides: integer?) -> integer`. */
  readonly signature: string;
  /** The body, in terms of the parameters: `((sides - 2) * n^2 - (sides - 4) * n) / 2`. */
  readonly body: string;
  /** Each option's default, in Epsil. */
  readonly defaults?: Readonly<Record<string, string>>;
  /** Pins packing can't find (a dependency that isn't installed), by qualified name. */
  readonly requires?: Readonly<Record<string, string>>;
}

// --- the implementations record (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §2, §6) -----------------------
//
// `reference/<Head>/examples.values.*.tsv` holds, per example id, every implementation's
// rendering of it and, for other systems, their answer. Own forms ("epsil", "tex",
// "traditional", "notatio") and external systems share this shape -- an own form simply has
// no `verdict`, `messages`, or claim to answer with.

/** One rendered form of an example: retypeable text going in, and what it prints as. */
export interface RenderedForm {
  readonly in: string;
  readonly out: string;
}

/**
 * One message an evaluation itself emitted for this example -- compute-engine's `Head::code`
 * messages, or a kernel's own warnings and errors. Distinct from the hand classification
 * below: this is what running it produced, not what a person concluded about the verdict.
 */
export interface EvaluationMessage {
  readonly code: string;
  readonly text: string;
  readonly severity?: "warning" | "error";
}

/**
 * One system's writing of one example and, unless it's one of our own forms, its answer.
 *
 * | Field                                          | Written by            | Meaning |
 * | ----------------------------------------------- | --------------------- | ------- |
 * | `in`                                            | `UPDATE_FORMS=1`      | what our transpiler emits for it |
 * | `out`, `tex`, `verdict`                         | the scan's `--accept` | absent for an own form, or until scanned |
 * | `kind`, `note`, `issue`, `tolerance`             | hand                  | the classification of a non-`agree` verdict, carried forward by the scan while it holds |
 * | `messages`                                      | the scan               | what the evaluation itself emitted running it |
 */
export interface SystemImplementation {
  readonly in: string;
  readonly out?: string;
  /** Wolfram only: the digits it displays for an arbitrary-precision `out`, which it holds
   * more digits of than it shows. */
  readonly shown?: string;
  /** Wolfram (and any system that has one): its TeXForm of `in` and of `out`. */
  readonly tex?: RenderedForm;
  readonly verdict?: OtherSystemVerdict;
  /** One of `DIVERGENCE_KINDS` (`@enumeratio/oracle`). Any verdict but `agree` needs one. */
  readonly kind?: string;
  readonly note?: string;
  /** `ours` only: the GitHub issue tracking the gap. */
  readonly issue?: number;
  /** Relative tolerance for a numeric comparison, where 1e-9 is too strict for this row. */
  readonly tolerance?: number;
  readonly messages?: readonly EvaluationMessage[];
  /** Our own forms only: what `in` reads back as, where the trip loses something -- through
   * `parseEpsil` uncanonicalised for FullForm, a notebook cell for InputForm, the markup reader
   * for notatio. Absent when it reads back as the example's `expr`. */
  readonly back?: MathJSON;
  /** Our own forms only: what `out` reads back as, where that is not the example's `expected`. */
  readonly backOut?: MathJSON;
}

/**
 * All implementations of one example, keyed by our own forms ("epsil", "tex", "traditional",
 * "notatio") or an external system name (`CrosswalkSystem`) -- one value in
 * `<Head>/examples.values.*.tsv`, itself keyed by example id (see `HeadImplementations`).
 */
export type ExampleImplementations = Readonly<Record<string, SystemImplementation>>;

/**
 * The whole `<Head>/examples.values.*.tsv` file: every example's implementations, keyed by
 * the example's `id`. Nothing in it is keyed by expression text or array position.
 */
export type HeadImplementations = Readonly<Record<string, ExampleImplementations>>;

// --- component stories (https://github.com/enumeratio/enumeratio/wiki/Vdom) ----------------------------------------------------
//
// A component's demos, as data, the same way a head's examples are: `packages/components/
// reference/<Name>.stories.yaml` beside the element sources, one file per component, read and
// written through the same `@enumeratio/entry` machinery. A story's payload is `expr`, a
// MathJSON expression over the component's own head -- exactly what an example's `expr` is --
// not a vdom tree: "a MathJSON node `[head, ...args]` and a vdom node `{ tag, props, children }`
// are the same tree under a renaming" (https://github.com/enumeratio/enumeratio/wiki/Vdom), and the vdom is a RENDERING of the
// expression (`structuralOf` / `vdomOf` in `@enumeratio/frontend`), never stored on its own.

/** One demo on a component's reference page. */
export interface ComponentStory {
  /**
   * Stable within the component: `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 48 characters. Assigned
   * once and kept when the caption or `expr` changes. The deep link is `#story/<id>`.
   */
  readonly id: string;
  /** Prose introducing the demo -- may use `$…$` for inline math, same as an example's caption. */
  readonly caption: string;
  /** Grouping heading on the component's page ("Bars", "Axes", …). Defaults to "Basic". */
  readonly category?: string;
  /** Longer prose kept from the story's original write-up, shown under the caption. */
  readonly notes?: string;
  /**
   * The demo, as a MathJSON expression over the component's head -- `BarChart3D([[1, 2], [3,
   * 4]])`, options as Wolfram-style trailing rules (`RowLabels -> "x,y"`). The pinned source of
   * truth: the live render (`vdomOf`) and the shown markup (`structuralOf` printed) are both
   * derived from this, never the other way around.
   */
  readonly expr: MathJSON;
}
