import type { Reference } from "./reference.ts";

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
  readonly caption?: string;
  /**
   * Grouping heading -- "Basic", "Scope", "Applications", "Properties",
   * "Possible issues", "Neat examples". Defaults to "Basic".
   */
  readonly category?: string;
  /**
   * When true, `expected` is a result we claim compute-engine ought to produce
   * eventually but does NOT yet -- the reference doubles as a capability map. The
   * page shows the actual result with a "not yet implemented" badge and surfaces
   * the claimed `expected` via the assertion; the test asserts the gap still
   * exists (so we notice when CE closes it).
   */
  readonly aspirational?: boolean;
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
   * Kept as data but not shown by default: an edge case or a grid point that the tests and
   * oracles run like any other example, too many or too minor to render. Hidden examples
   * mostly live in an entry file's `<stem>.examples.json`. A deep link (`#example/<id>`)
   * still shows one.
   *
   * @deprecated Superseded by `role: "test"` (design/examples-as-data.md §5). Both are read
   * during the migration; `hidden` goes away once every example carries a `role`.
   */
  readonly hidden?: boolean;
  /**
   * Cases of one example: examples sharing a `group` show as a single card, where the
   * first sits, cycling through the rest. Each case is still its own example -- its own
   * test, oracle row and `#example/<id>`; the card carries its first case's anchor, and a
   * link to any other case shows that case on it. For near-identical cases that demonstrate
   * nothing over the first.
   */
  readonly group?: string;
  /**
   * What the example is FOR (design/examples-as-data.md §5). `demo` (the default) is shown
   * on the reference page; `test` runs in the evaluation test and the scans like any other
   * example but is skipped by the page, superseding `hidden`.
   */
  readonly role?: ExampleRole;
  /** Derived by the loader: each scanned system's run of this example, from the implementations record. */
  readonly others?: Readonly<Record<string, OtherSystemRun>>;
}

/** What an example is for (design/examples-as-data.md §5) -- superseding `hidden`. */
export type ExampleRole = "demo" | "test";

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
 * - `browser`  needs the DOM, and usually a custom element (`<notatio-plot>` et al.)
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
 *   oracle for every other row (design/namespaces.md §6)
 * - `native`    authored by us in TypeScript — what actually runs; stored as a POINTER,
 *   because the source lives in the repo and a copy here would rot
 * - `compiled`  produced by a compute-engine compile target (numpy, glsl, wgsl, js);
 *   derivable live from the expression, so normally not stored at all
 * - `component` bottoms out in a web component — the head's meaning IS the rendered element
 * - `mapped`    the equivalent call in an external system; the table lives in
 *   `@enumeratio/oracle`'s MAPPINGS, keyed by signature
 */
export type ImplementationOrigin = "reference" | "native" | "compiled" | "component" | "mapped";

/** One of the several things a head is "made of". */
export interface ReferenceImplementation {
  readonly origin: ImplementationOrigin;
  /** Target or language: "notatio", "typescript", "wgsl", "numpy", "<notatio-plot>", … */
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
  readonly note?: string;
}

/**
 * Why a head does NOT reduce further — it sits on the primitive frontier
 * (design/namespaces.md §6.1). Every head either has a `reference` implementation or
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
  readonly implementations?: readonly ReferenceImplementation[];
  /** Set when the head is on the primitive frontier and has no `reference` row. */
  readonly primitive?: PrimitiveReason;
  /**
   * Where this head lives in other systems, as the author knows it. The page shows these
   * alongside what the crosswalk derives (Wikidata from the engine, Fungrim, Wolfram, the
   * catalog's FindStat and Sage rows) -- see `crosswalk/`.
   */
  readonly references?: readonly Reference[];
  /**
   * Generated rather than written, so the head has a page and a crosswalk: `engine` for a
   * compute-engine symbol we neither extend nor document by hand, `carrier` for a domain.
   */
  readonly stub?: "engine" | "carrier";
}

// --- the implementations record (design/examples-as-data.md §2, §6) -----------------------
//
// `reference/<Head>.implementations.yaml` holds, per example id, every implementation's
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
  /** Wolfram only: what `in` reads back as, where the trip loses something (a head with no
   * Wolfram of its own to reverse from). Absent when it reads back as the example's `expr`. */
  readonly back?: MathJSON;
}

/**
 * All implementations of one example, keyed by our own forms ("epsil", "tex", "traditional",
 * "notatio") or an external system name (`CrosswalkSystem`) -- one value in
 * `<Head>.implementations.yaml`, itself keyed by example id (see `HeadImplementations`).
 */
export type ExampleImplementations = Readonly<Record<string, SystemImplementation>>;

/**
 * The whole `<Head>.implementations.yaml` file: every example's implementations, keyed by
 * the example's `id`. Nothing in it is keyed by expression text or array position.
 */
export type HeadImplementations = Readonly<Record<string, ExampleImplementations>>;
