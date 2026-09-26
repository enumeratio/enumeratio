import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { type MathJsonExpression, serializeEpsil } from "@cortex-js/compute-engine/epsil";
import { collectMessages, type Message } from "@enumeratio/boxed";
import { normalizeInputForm, toInputForm } from "@enumeratio/formats/inputform";
import { toMathML } from "@enumeratio/formats/mathml";
import { portableTeX } from "@enumeratio/formats/tex";
import { parseExpression } from "@enumeratio/formats/expression";
import { toWolfram } from "@enumeratio/wolfram";
import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import "./notatio-code.ts";
import { WorkerUnavailableError } from "./notatio-dynamic-module.ts";
import { loadEngine, loadMarkup } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";
import { visualMarkup } from "./visual.ts";
import {
  boundName,
  collectErrors,
  debug,
  deepEqual,
  elideResult,
  type Environment,
  environmentNamed,
  highlightCode,
  latexOf,
  pageEnvironment,
  substitutedForm,
  toTraditionalLatex,
  type Transcript,
  watchPageEnvironment,
} from "@enumeratio/notatio";

/**
 * Typeset markup by the LaTeX that produced it, shared by every `<notatio-out>` on the
 * page. Converting LaTeX to markup is the expensive part of a re-render, and a control
 * driving a cell (a worksheet's slider) re-renders every frame -- so without this, a
 * dragged control re-typesets every *unchanged* result on the page too, dozens of times
 * a second, which measured as a frozen renderer rather than a merely slow one. General,
 * not worksheet-specific: any `<notatio-out>` benefits, since a hit costs nothing and a
 * distinct LaTeX result is not one worth losing sleep over.
 */
const markupCache = new Map<string, string>();
const MARKUP_CACHE_LIMIT = 256;

function cachedMarkup(convert: (latex: string) => string, latex: string): string {
  const hit = markupCache.get(latex);
  if (hit !== undefined) return hit;
  const made = convert(latex);
  // Bounded: a swept parameter produces a new result every frame, and those are
  // exactly the ones least worth keeping once the cache is full.
  if (markupCache.size > MARKUP_CACHE_LIMIT) markupCache.clear();
  markupCache.set(latex, made);
  return made;
}

/**
 * What a cell draws its input FROM, when `plot` asks for it: the expression with every
 * currently-bound name substituted but not evaluated, and the free names left over --
 * `reactive.ts`'s `substitutedForm`/`PassCell.plot`, generalised off any `Transcript`'s
 * live scope rather than a worksheet pass's own tracked bindings.
 */
interface PlotInfo {
  /** InputForm -- Epsil a plot element can re-parse (`toInputForm`, round-trips). */
  readonly source: string;
  /** The names still free after substitution, sorted. */
  readonly free: readonly string[];
}

/**
 * Claim `name` in `engine`'s CURRENT (innermost pushed) scope before an `Assign`
 * evaluates it, the way `reactive.ts`'s `runPass` already does for a worksheet's own
 * pass -- see that function's comment for why this is load-bearing rather than tidy.
 * A no-op when `name` is `undefined` (not an assignment) or already declared there.
 */
function declareLocal(engine: ComputeEngine, name: string | undefined): void {
  if (name === undefined) return;
  try {
    engine.declare(name, "unknown");
  } catch {
    // Already declared locally (a re-run of this same cell), or a protected name --
    // either way there is nothing to claim.
  }
}

/** `PlotInfo` for `raw` (parsed, unevaluated), read against `engine`'s current scope. */
function plotOf(engine: ComputeEngine, raw: BoxedExpression): PlotInfo | undefined {
  try {
    const substituted = substitutedForm(engine, raw);
    return {
      source: toInputForm(substituted.json as MathJsonExpression),
      free: [...substituted.unknowns].sort(),
    };
  } catch {
    return undefined;
  }
}
// `localStorage["notatio:debug"] = "out"` -- see @enumeratio/notatio's debug.ts. Used to
// make an `Evaluator -> "Worker"` cell's routing visible: a Worker-mode cell that never
// logs `worker-evaluate` is silently running locally instead (see the guard right after
// the worker branch, below).
const log = debug("out");

type Format = "latex" | "mathjson" | "epsil";
type Status = "" | "ok" | "mismatch" | "error";
type Form =
  | "standard"
  | "input"
  | "traditional"
  | "matrix"
  | "tree"
  | "full"
  | "tex"
  | "asciimath"
  | "mathml"
  | "wolfram"
  | "python"
  | "glsl"
  | "wgsl"
  | "gpushader"
  | "javascript";

/** What TreeForm can know about a head, from the page's `resolveHead`. */
export interface HeadInfo {
  /** Where the head is documented. */
  href?: string;
  /** Its defining expression, over `_`-prefixed wildcards, if it has a `reference` one. */
  definition?: MathJsonExpression;
  /** The wildcards, in parameter order. Defaults to first appearance in `definition`. */
  params?: readonly string[];
  /** Why it does not reduce further, when it sits on the primitive frontier. */
  primitive?: string;
}

/** The `_`-prefixed wildcards of `expr`, in order of first appearance. */
function wildcardsOf(expr: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      if (node.startsWith("_") && !found.includes(node)) found.push(node);
    } else if (Array.isArray(node)) node.forEach(walk);
  };
  walk(expr);
  return found;
}

/** `expr` with each wildcard replaced by its binding. Structural; nothing is evaluated. */
function substitute(expr: unknown, bindings: ReadonlyMap<string, unknown>): unknown {
  if (typeof expr === "string") return bindings.has(expr) ? bindings.get(expr) : expr;
  if (Array.isArray(expr)) return expr.map((node) => substitute(node, bindings));
  return expr;
}

/** A `<notatio-dynamic-module>` that can hand out its shared evaluation scope. */
interface TranscriptHost extends Element {
  transcriptFor(engine: ComputeEngine): Transcript;
  /**
   * `Evaluator` (design/computation.md, `notatio-dynamic-module.ts`): `"Local"`
   * (default, or absent) evaluates in-page as today; `"Worker"` routes a cell's
   * evaluation to the module's `aestimatio` session instead (`evaluateRemote`,
   * below). Optional so a plain `TranscriptHost` (no `Evaluator` support at all)
   * still satisfies this interface.
   */
  readonly evaluatorKind?: "Local" | "Worker";
  /**
   * Runs `json` in the module's worker session rather than this page's engine --
   * only present, and only called, when `evaluatorKind` is `"Worker"`. `signal`
   * aborts THIS call (the module's "stop" control / Escape); the worker itself may
   * keep running in the background (design/computation.md §5.3's own limit on what an
   * abort can promise). `reset: true` means the session was hard-killed and
   * restarted -- earlier bindings are gone, surfaced by the module itself.
   */
  evaluateRemote?(json: unknown, options?: { signal?: AbortSignal }): Promise<{ value: unknown; reset: boolean }>;
}

/**
 * The nearest ancestor `<notatio-dynamic-module>`, if this Out sits inside one -- the way
 * a forced `env` is read from `closest("[env]")` (`#visualize`, below). A cell outside any
 * module evaluates exactly as it does today: no scope, no history, no `%`/`Out(n)`.
 *
 * Exported so `<notatio-cell>` can ask the same question: inside a transcript, Wolfram
 * evaluates a cell only on Shift+Enter, so the cell defers handing a new value to its Out
 * until the editor commits, rather than on every keystroke.
 */
export function transcriptHostOf(el: Element): TranscriptHost | undefined {
  const host = el.closest("notatio-dynamic-module");
  return host && typeof (host as Partial<TranscriptHost>).transcriptFor === "function"
    ? (host as TranscriptHost)
    : undefined;
}

/** The subtree of `tree` at `path`, or the tree itself for the empty path. */
function nodeAt(tree: unknown, path: string): unknown {
  if (!path) return tree;
  return path.split(".").reduce<unknown>((node, i) => {
    const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] } | null)?.fn;
    return Array.isArray(fn) ? fn[Number(i) + 1] : undefined;
  }, tree);
}

/** `tree` with the subtree at `path` replaced, copying only the spine. */
function replaceAt(tree: unknown, path: string, replacement: unknown): unknown {
  if (!path) return replacement;
  const [i, ...rest] = path.split(".");
  const fn = Array.isArray(tree) ? tree : (tree as { fn?: unknown[] } | null)?.fn;
  if (!Array.isArray(fn)) return tree;
  const next = [...fn];
  next[Number(i) + 1] = replaceAt(fn[Number(i) + 1], rest.join("."), replacement);
  return Array.isArray(tree) ? next : { ...(tree as object), fn: next };
}

// Code forms whose source comes from a compute-engine compilation TARGET (via
// `target.compileToSource`). The map is `form -> target export name`; held as a
// value so the classes aren't tree-shaken out of the bundle. JavaScript is a
// code form too but uses the free `compile().code` path (see #codeSources).
const CODE_TARGETS = {
  python: "PythonTarget",
  glsl: "GLSLTarget",
  wgsl: "WGSLTarget",
} as const;
type CodeForm = keyof typeof CODE_TARGETS | "javascript" | "gpushader";
const CODE_FORMS = new Set<Form>([...(Object.keys(CODE_TARGETS) as Form[]), "javascript", "gpushader"]);

// The display forms offered by the In/Out menu.
const FORMS: readonly Form[] = [
  "standard",
  "traditional",
  "input",
  "matrix",
  "tree",
  "full",
  "tex",
  "asciimath",
  "mathml",
  "wolfram",
  "python",
  "javascript",
  "glsl",
  "wgsl",
  "gpushader",
];
const FORM_LABEL: Record<Form, string> = {
  standard: "StandardForm",
  traditional: "TraditionalForm",
  input: "InputForm",
  matrix: "MatrixForm",
  tree: "TreeForm",
  full: "MathJSON",
  tex: "TeXForm",
  asciimath: "AsciiMathForm",
  mathml: "MathMLForm",
  wolfram: "WolframFullForm",
  python: "PythonForm",
  javascript: "JavaScriptForm",
  glsl: "GLSLForm",
  wgsl: "WGSLForm",
  gpushader: "GPUShaderForm",
};
// The language tag for the forms that render as source in a <notatio-code> box.
const FORM_LANG: Partial<Record<Form, string>> = {
  input: "epsil",
  full: "json",
  tex: "latex",
  asciimath: "asciimath",
  mathml: "xml",
  wolfram: "wolfram",
  python: "python",
  javascript: "javascript",
  glsl: "glsl",
  wgsl: "wgsl",
  gpushader: "wgsl",
};

/**
 * `<notatio-out>` -- read-only typeset rendering of a compute-engine
 * expression. Accepts LaTeX (the default: it renders an encoding it is handed, and the
 * cell hands it the editor's LaTeX), MathJSON or Epsil; optionally evaluates first.
 * Renders in light DOM so the host page's MathLive static stylesheet applies.
 * compute-engine is loaded only when the input is MathJSON or Epsil, or evaluation
 * or an assertion is requested.
 *
 * Set `expect` to a JSON MathJSON value to turn the element into a live snapshot
 * assertion: the evaluated result is compared to `expect` and any mismatch or
 * error diagnostic is shown inline.
 */
export class NotatioOut extends LitElement {
  static properties = {
    /** The expression to render, in the encoding `format` names. */
    value: { type: String },
    /** How to read `value`: `latex`, `mathjson` or `epsil`. */
    format: { type: String },
    /** Sit inline in a sentence: the rendering alone, no label, no menu, no status. */
    inline: { type: Boolean, reflect: true },
    /** Set as a centred display equation (`\displaystyle`), for `$$…$$`. */
    display: { type: Boolean, reflect: true },
    /** Evaluate before rendering, rather than rendering the input as given. */
    evaluate: { type: Boolean },
    /** Box without evaluating, so the source and AST forms populate. */
    box: { type: Boolean },
    /**
     * Box without canonicalising, so the expression shows as authored -- `a - b` stays a
     * `Subtract`, `a > b` is not flipped into a `Less`. For a definition, whose spelling is
     * the point. Ignored when `evaluate` is set.
     */
    raw: { type: Boolean },
    /** A MathJSON value to assert the result against; a mismatch is reported inline. */
    expect: { type: String },
    /** Mark an `expect` mismatch as a known gap — shown as a note rather than a failure. */
    planned: { type: Boolean },
    /** The representation to show, e.g. `standard`, `traditional`, `fullform`, `numpy`. */
    form: { type: String, reflect: true },
    /** Row label, e.g. `In` or `Out`. */
    label: { type: String, reflect: true },
    /** A preset to reduce the picture for (`print`, `pipe`, …); by default the page's own, as it changes. */
    env: { type: String },
    /**
     * Above this many operands, describe a `List` result rather than typeset it (`0`,
     * the default, never elides). A long numeric result costs real time to serialize and
     * typeset for an output line that exists to be *drawn*, not read -- see
     * `elideResult`. General: any cell over a control that can grow a long result can
     * set this, not only a worksheet's.
     */
    elideAbove: { type: Number, attribute: "elide-above" },
    /**
     * Also report the substituted-but-unevaluated form of the input, in the
     * `notatio-result` event's `plot` detail, for a consumer that draws the INPUT rather
     * than the fully-evaluated output -- so a complex portrait or plot doesn't collapse
     * at a pole a bound parameter crosses (`substitutedForm`). Only meaningful for a cell
     * inside a `<notatio-dynamic-module>` (`evaluate` and a shared scope); ignored
     * otherwise.
     */
    plot: { type: Boolean },
    /**
     * Read-only: set while the value is being evaluated or typeset (the engine loads
     * lazily, so the first one can take a moment). Styled as a pending state; a script
     * can wait for `:not([busy])`.
     */
    busy: { type: Boolean, reflect: true },
    /**
     * Put the form menu on the label instead of a selector at the right: click `In`/`Out`
     * to open it. Leaves the right of the row free.
     */
    labelMenu: { type: Boolean, attribute: "label-menu" },
    /**
     * Property only (set it from script, not markup): what TreeForm knows about a head. A
     * resolver from a head name to its `HeadInfo` -- a link to its page, the defining
     * expression it can be unfolded into, the reason it sits on the primitive frontier. A
     * reference page supplies one built from its entries.
     */
    resolveHead: { attribute: false },
    _markup: { state: true },
    _visual: { state: true },
    _traditional: { state: true },
    _tex: { state: true },
    _matrix: { state: true },
    _canMatrix: { state: true },
    _latex: { state: true },
    _json: { state: true },
    _ascii: { state: true },
    _mathml: { state: true },
    _wolfram: { state: true },
    _input: { state: true },
    _code: { state: true },
    _status: { state: true },
    _detail: { state: true },
    _messages: { state: true },
    _expanded: { state: true },
    _tree: { state: true },
    _folded: { state: true },
  };

  declare value: string;
  declare format: Format;
  declare inline: boolean;
  declare display: boolean;
  declare evaluate: boolean;
  declare box: boolean;
  declare raw: boolean;
  declare expect: string;
  declare planned: boolean;
  declare form: Form;
  declare label: string;
  declare env: string;
  declare elideAbove: number;
  declare plot: boolean;
  declare labelMenu: boolean;
  declare busy: boolean;
  declare resolveHead: ((head: string) => HeadInfo | undefined) | undefined;
  declare _markup: string;
  /**
   * The picture, when the result is a head that draws: markup for the head's component
   * (`symbols.ts`), shown in place of the typeset expression on the standard form. The
   * tags are the package's own, registered by its entry point; this element does not
   * import them, so a host that registers only `notatio-out` sees the typeset fallback.
   */
  declare _visual: string;
  declare _traditional: string;
  /** The TeXForm source: traditional notation, in commands a LaTeX document knows. */
  declare _tex: string;
  declare _matrix: string;
  declare _canMatrix: boolean;
  declare _latex: string;
  declare _json: string;
  declare _ascii: string;
  declare _mathml: string;
  declare _wolfram: string;
  declare _input: string;
  declare _code: Partial<Record<CodeForm, string>>;
  declare _status: Status;
  declare _detail: string;
  /** What the heads that declined to evaluate said about it (`IntegerMod::ninv`, …). */
  declare _messages: readonly Message[];
  /** TreeForm nodes currently open, keyed by path (`"0.1"` is the second child of the first). */
  declare _expanded: ReadonlySet<string>;
  /** The TreeForm working tree: `_json` with any unfolded definitions substituted in. */
  declare _tree: unknown;
  /** Nodes replaced by an unfolding, keyed by path, holding the application they came from. */
  declare _folded: ReadonlyMap<string, unknown>;

  constructor() {
    super();
    this.value = "";
    this.format = "latex";
    this.evaluate = false;
    this.box = false;
    this.raw = false;
    this.expect = "";
    this.planned = false;
    this.form = "standard";
    this.inline = false;
    this.display = false;
    this.label = "";
    this.env = "";
    this.elideAbove = 0;
    this.plot = false;
    this.labelMenu = false;
    this.busy = false;
    this._markup = "";
    this._visual = "";
    this._traditional = "";
    this._tex = "";
    this._matrix = "";
    this._canMatrix = false;
    this._latex = "";
    this._json = "";
    this._ascii = "";
    this._mathml = "";
    this._wolfram = "";
    this._input = "";
    this._code = {};
    this._status = "";
    this._detail = "";
    this._messages = [];
    this._expanded = new Set([""]);
    this._tree = undefined;
    this._folded = new Map();
    ensureStyles();
  }

  // Light DOM: MathLive's static markup needs the page-level `mathlive/static.css`.
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues): void {
    // Prose math keeps its LaTeX on the attribute, so a copied selection (a clone,
    // which carries attributes but not properties) can be serialised back to `$…$`.
    if ((this.inline || this.display) && changed.has("value") && this.value) {
      if (this.getAttribute("value") !== this.value) this.setAttribute("value", this.value);
    }
    // Any other Out keeps its InputForm there, for the same reason: a selection that
    // spans it copies it as Epsil you can paste back in.
    if (changed.has("_input")) {
      if (this._input) this.setAttribute("input-form", this._input);
      else this.removeAttribute("input-form");
    }
    if (
      changed.has("value") ||
      changed.has("format") ||
      changed.has("evaluate") ||
      changed.has("box") ||
      changed.has("raw") ||
      changed.has("display") ||
      changed.has("expect") ||
      changed.has("elideAbove") ||
      changed.has("plot")
    ) {
      void this.#recompute();
    } else if (changed.has("form") && !this._input) {
      // The no-engine fast path leaves InputForm (and the copy action behind it)
      // unfilled; asking for it is what pays for the engine.
      void this.#recompute();
    }
    if (changed.has("env") && changed.get("env") !== undefined) this.#visualize();
    // Escape stops a running Worker-evaluator call (`stop()`) -- only listened for
    // while actually busy, and only matters when there is something to abort.
    if (changed.has("busy")) {
      if (this.busy) globalThis.document?.addEventListener("keydown", this.#onKeydown);
      else globalThis.document?.removeEventListener("keydown", this.#onKeydown);
    }
  }

  async #evaluate(): Promise<{
    latex: string;
    json: unknown;
    messages: readonly Message[];
    /** The bound symbol, when the input is an assignment (`a := …`). */
    name?: string;
    plot?: PlotInfo;
  }> {
    const source = this.value ?? "";
    if (!source.trim()) return { latex: "", json: undefined, messages: [] };
    // Fast path: render given LaTeX as-is, no engine, when nothing needs it.
    // `box` forces boxing (without evaluating) so the source/AST forms populate.
    // Every other form needs the parsed expression, so only StandardForm takes it.
    if (this.format === "latex" && !this.evaluate && !this.box && !this.expect && this.form === "standard") {
      // MathLive's static renderer takes its style from the LaTeX itself.
      return {
        latex: this.display ? `\\displaystyle ${source}` : source,
        json: undefined,
        messages: [],
      };
    }
    const engine = await loadEngine();
    // `raw` keeps the authored tree; evaluation canonicalises regardless, so it wins.
    const form = this.raw && !this.evaluate ? { form: "raw" as const } : undefined;
    const host = transcriptHostOf(this);
    const transcript = host?.transcriptFor(engine);
    const parseText = (): BoxedExpression =>
      this.format === "latex" ? engine.parse(source, form) : engine.box(this.#json(engine), form);

    // `Evaluator -> "Worker"`: this cell's own evaluation happens off-thread, in the
    // module's aestimatio session -- not inside `transcript.run()` (that scope is a
    // LOCAL engine's; the worker holds its own persistent one, per
    // design/computation.md). Only parsing and the result's re-boxing (for typesetting)
    // touch the local scope. Messages (`collectMessages`) don't cross the worker
    // boundary yet -- deferred, see this package's PR description.
    if (transcript && this.evaluate && host?.evaluatorKind === "Worker" && host.evaluateRemote) {
      log("worker-evaluate", this.value);
      const input = this.format === "latex" ? source : toInputForm(this.#json(engine) as MathJsonExpression);
      const boxed = transcript.run(() => parseText());
      this.#abort = new AbortController();
      try {
        let resultJson: unknown;
        try {
          ({ value: resultJson } = await host.evaluateRemote(boxed.json, {
            signal: this.#abort.signal,
          }));
        } finally {
          this.#abort = undefined;
        }
        const value = transcript.run(() => engine.box(resultJson as never));
        this.#historyN = transcript.record(input, boxed, value);
        return { latex: latexOf(engine, value), json: value.json, messages: [] };
      } catch (err) {
        // No worker could ever be started for this session (not a user "stop" --
        // that resolves normally with `$Aborted` rather than throwing) --
        // `host.evaluatorKind` has already flipped to `"Local"` for every cell after
        // this one; fall through to the LOCAL path below for this one too, rather
        // than showing `$Aborted` for a failure the reader never asked for.
        if (!(err instanceof WorkerUnavailableError)) throw err;
        log("worker-evaluate: no worker could start -- evaluating this cell locally", err);
      }
    }
    // A host in Worker mode but missing `evaluateRemote` would otherwise fall through to
    // the LOCAL evaluation below without a trace -- exactly the failure mode that let
    // `Notebook(cells, Evaluator -> Worker)` silently run every cell on the page's own
    // thread (a `Notebook`-signature bug, since fixed in `@enumeratio/formats`; see
    // `packages/notatio/tests/dynamic-module-evaluator.test.ts`). `evaluateRemote` is
    // always defined on `NotatioDynamicModule`, so this only fires for a non-conforming
    // host (e.g. a test double) -- loud on purpose.
    if (transcript && this.evaluate && host?.evaluatorKind === "Worker") {
      log("worker-evaluate: host has no evaluateRemote -- falling back to LOCAL", host);
      console.error(
        'notatio-out: Evaluator -> "Worker" host has no evaluateRemote(); evaluating locally instead',
        host,
      );
    }

    let parsed: BoxedExpression | undefined;
    let plotInfo: PlotInfo | undefined;
    const { value: result, messages } = collectMessages(engine, () => {
      if (transcript && this.evaluate) {
        // `InString(n)` reads back what the reader typed. Read the JSON *before* boxing:
        // `engine.box` folds closed numeric arithmetic (`3 + 4` boxes straight to `7`).
        const input = this.format === "latex" ? source : toInputForm(this.#json(engine) as MathJsonExpression);
        // Inside the transcript's scope: `a := 5` binds there, and the result becomes the
        // next `In[n]`/`Out[n]`.
        return transcript.run(() => {
          const boxed = parseText();
          parsed = boxed;
          // Claim the name locally before it assigns, the way `runPass` already does
          // for a worksheet's own pass (see that function's comment) -- an `Assign`
          // with nothing declared here yet has nowhere of its own to land. This closes
          // the common case (nothing else on the page has touched the name yet); it is
          // NOT a complete fix for two sheets sharing a name once BOTH have assigned to
          // it at least once -- that residual cross-scope leak is tracked separately
          // (PR description) rather than solved here.
          declareLocal(engine, boundName(boxed.json));
          const value = boxed.evaluate();
          this.#historyN = transcript.record(input, boxed, value);
          // Read from the scope after `boxed.evaluate()` has had its chance to bind --
          // an `Assign` is not itself substitutable for, so this is only ever something
          // ELSE in the cell reading a binding another cell (or an earlier pass) made.
          if (this.plot) plotInfo = plotOf(engine, boxed);
          return value;
        });
      }
      this.#historyN = undefined;
      const boxed = parseText();
      parsed = boxed;
      return this.evaluate ? boxed.evaluate() : boxed;
    });
    const name = parsed ? boundName(parsed.json) : undefined;
    const latex =
      this.elideAbove > 0 ? (elideResult(result, this.elideAbove) ?? latexOf(engine, result)) : latexOf(engine, result);
    return { latex, json: result.json, messages, name, plot: plotInfo };
  }

  /** `value` as MathJSON, for the two encodings that are not LaTeX. An Epsil diagnostic throws. */
  #json(engine: ComputeEngine): MathJsonExpression {
    const source = this.value ?? "";
    if (this.format === "mathjson") return JSON.parse(source) as MathJsonExpression;
    const { json, errors } = parseExpression(source, {
      parseLatex: (tex) => engine.parse(tex).json,
    });
    if (errors.length) throw new Error(errors.join("; "));
    return json;
  }

  #assert(actual: unknown): void {
    const errors = actual === undefined ? [] : collectErrors(actual);
    if (errors.length > 0) {
      this._status = "error";
      this._detail = errors.join("; ");
      return;
    }
    if (!this.expect) {
      this._status = "";
      this._detail = "";
      return;
    }
    let expected: unknown;
    try {
      expected = JSON.parse(this.expect);
    } catch {
      this._status = "error";
      this._detail = "invalid expect JSON";
      return;
    }
    if (deepEqual(actual, expected)) {
      this._status = "ok";
      this._detail = "";
    } else {
      this._status = "mismatch";
      this._detail = `expected ${this.expect}, got ${JSON.stringify(actual)}`;
    }
  }

  // Source for every code form, via compute-engine's compilation targets. Each
  // only handles numeric/function expressions, so non-numeric results (lists,
  // boolean comparisons) simply yield no source for that form.
  async #codeSources(
    engine: Awaited<ReturnType<typeof loadEngine>>,
    json: unknown,
  ): Promise<Partial<Record<CodeForm, string>>> {
    const out: Partial<Record<CodeForm, string>> = {};
    try {
      const mod = (await import("@cortex-js/compute-engine")) as unknown as Record<
        string,
        new () => { compileToSource(e: unknown): unknown }
      >;
      const expr = engine.box(json as Parameters<typeof engine.box>[0]);
      for (const [form, targetName] of Object.entries(CODE_TARGETS)) {
        try {
          const src = new mod[targetName]().compileToSource(expr);
          if (typeof src === "string") out[form as CodeForm] = src;
        } catch {
          // this target can't compile this expression -- leave it out
        }
      }
      // JavaScript uses the free compile() path; its result carries `.code`.
      try {
        const compileFn = (mod as unknown as { compile?: (e: unknown, o: unknown) => unknown }).compile;
        const res = compileFn?.(json, { engine });
        const code = (res as { code?: unknown } | undefined)?.code;
        if (typeof code === "string") out.javascript = code;
      } catch {
        // not compilable to JavaScript
      }
      out.gpushader = await this.#gpuShader(expr);
    } catch {
      // compute-engine module unavailable
    }
    return out;
  }

  // GPUShaderForm: the whole shader one of our GPU paths would run for this expression,
  // not just the expression's WGSL. One unknown is a complex variable, so the phase
  // portrait's fragment shader (<notatio-complex-plot>); one or two reals, the plot grid's
  // compute shader (gpu-eval). Anything neither path takes has no shader form.
  async #gpuShader(expr: { unknowns: ReadonlyArray<string> }): Promise<string | undefined> {
    const unknowns = [...expr.unknowns].sort();
    if (unknowns.length === 0 || unknowns.length > 2) return undefined;
    try {
      if (unknowns.length === 1) {
        const [{ emitComplexWGSL }, { portraitShader }] = await Promise.all([
          import("@enumeratio/analytic/src"),
          import("@enumeratio/notatio"),
        ]);
        const emitted = emitComplexWGSL((expr as unknown as { json: unknown }).json as never, unknowns[0]);
        if (emitted) return portraitShader(emitted.code);
      }
      const { computeShader, toWgslFn } = await import("@enumeratio/notatio");
      // A lone unknown still gets a two-parameter plot function; the second is unused.
      const [vx, vy = vx === "y" ? "x" : "y"] = unknowns;
      const fn = toWgslFn(expr as never, vx, vy);
      return fn ? computeShader(fn) : undefined;
    } catch {
      return undefined;
    }
  }

  // Set only while a Worker-evaluator call is in flight (see `#evaluate`'s worker
  // branch) -- `stop()`/Escape abort it. `undefined` outside that call, or in local
  // evaluation, where there is nothing to abort.
  #abort: AbortController | undefined;

  /**
   * Stop the in-flight Worker-evaluator call, if any -- the busy row's own stop
   * control and Escape (`#onKeydown`) both call this. Aborts THIS call only
   * (`BrowserSession.evaluate`'s own contract, `@enumeratio/aestimatio/browser`): the
   * worker may keep running in the background rather than actually halting -- a
   * module `time-constraint` is what turns an uncooperative loop into a hard-killed,
   * reset session (`notatio-dynamic-module.ts`'s own comment).
   */
  stop(): void {
    this.#abort?.abort();
  }

  #onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.stop();
  };

  #runs = 0;

  async #recompute(): Promise<void> {
    const run = ++this.#runs;
    this.busy = true;
    try {
      await this.#compute(run);
    } finally {
      if (run === this.#runs) this.busy = false;
    }
  }

  // `run` is this computation's ticket: a newer one (the value changed meanwhile) wins,
  // so a slow earlier evaluation can't overwrite it when it finally lands.
  async #compute(run: number): Promise<void> {
    try {
      const { latex, json, messages, name, plot } = await this.#evaluate();
      const convert = await loadMarkup();
      if (run !== this.#runs) return;
      this._messages = messages;
      this._expanded = new Set([""]);
      this._tree = json;
      this._folded = new Map();
      this._latex = latex;
      this._json = json === undefined ? "" : JSON.stringify(json);
      this._markup = latex ? cachedMarkup(convert, latex) : "";
      this.#name = name;
      this.#plot = plot;
      this.#value = json as MathJsonExpression | undefined;
      this.#visualize();
      this._wolfram = json === undefined ? "" : toWolfram(json as Parameters<typeof toWolfram>[0]);
      // MathMLForm: presentation MathML, straight off the MathJSON tree -- no engine,
      // and output only, so nothing parses it back.
      this._mathml = json === undefined ? "" : toMathML(json as MathJsonExpression);
      // InputForm: the same expression as Epsil you could type back in.
      this._input = json === undefined ? "" : toInputForm(json as MathJsonExpression);
      if (json === undefined) {
        this._traditional = this._markup;
        this._tex = portableTeX(latex);
        this._matrix = this._markup;
        this._canMatrix = false;
      } else {
        const engine = await loadEngine();
        if (run !== this.#runs) return;
        const traditional = toTraditionalLatex(json, engine);
        this._traditional = convert(traditional);
        // TeXForm is the TeX of TraditionalForm, as in Wolfram.
        this._tex = portableTeX(traditional);
        // MatrixForm: lay a List value out as a matrix via compute-engine's
        // Matrix head (which serialises to \begin{pmatrix}…), then typeset it.
        // Only a List has a matrix form; anything else falls back to standard.
        this._canMatrix = Array.isArray(json) && json[0] === "List";
        const matrixExpr = ["Matrix", json] as unknown as Parameters<typeof engine.box>[0];
        this._matrix = this._canMatrix ? convert(engine.box(matrixExpr).latex) : this._markup;
        // AsciiMathForm: compute-engine's toString() is an ASCIIMath rendering.
        this._ascii = engine.box(json as Parameters<typeof engine.box>[0]).toString();
        this._code = await this.#codeSources(engine, json);
      }
      if (json === undefined) {
        this._ascii = "";
        this._code = {};
      }
      this.#assert(json);
    } catch (err) {
      if (run !== this.#runs) return;
      this._markup = "";
      this._visual = "";
      this._latex = "";
      this._tex = "";
      this._json = "";
      this._messages = [];
      this._status = "error";
      this._detail = err instanceof Error ? err.message : String(err);
      this.#name = undefined;
      this.#plot = undefined;
    }
    // Let containers (e.g. a reference cell) react to the assertion outcome.
    this.dispatchEvent(
      new CustomEvent("notatio-assert", {
        detail: { status: this._status, message: this._detail, messages: this._messages },
        bubbles: true,
        composed: true,
      }),
    );
    // Expose the evaluated result so a notebook can reference it (e.g. REPL `%n`).
    // Empty on error/blank; the LaTeX round-trips back into a downstream input. `n` is
    // this line's transcript number, when it evaluated inside one -- a `<notatio-cell>`
    // reads it back to label itself `In[n]` / `Out[n]`. `name`/`plot` are `undefined`
    // unless the input is an assignment / `plot` was asked for -- a worksheet-like
    // consumer reads them to infer a control or a drawing without evaluating again.
    this.dispatchEvent(
      new CustomEvent("notatio-result", {
        detail: {
          latex: this._latex,
          json: this._json,
          n: this.#historyN,
          name: this.#name,
          plot: this.#plot,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** This line's `In[n]`/`Out[n]` number, when the last evaluation ran in a transcript. */
  get historyN(): number | undefined {
    return this.#historyN;
  }

  /**
   * Force a fresh evaluation even though none of `value`/`format`/… changed -- for a
   * host whose shared scope changed under this Out rather than its own props (a
   * reactive `DynamicModule`'s downstream cell, re-run after an upstream one commits;
   * `reactive-module.ts` is the caller). `willUpdate`'s own dirty-check would otherwise
   * see nothing to do.
   */
  revalidate(): Promise<void> {
    return this.#recompute();
  }

  #status(): unknown {
    // A passing assertion is silent -- only surface failures. `mismatch` is an
    // expected-vs-actual disagreement; `error` is a compute-engine diagnostic.
    // When `planned`, a mismatch is an expected gap (the claimed result isn't
    // implemented yet), so show it as an informational note, not a failure.
    switch (this._status) {
      case "mismatch":
        return this.planned
          ? html`<span class="notatio-assert-diag">not yet — ${this._detail}</span>`
          : html`<span class="notatio-assert-fail">✗ ${this._detail}</span>`;
      case "error":
        return html`<span class="notatio-assert-diag">⚠ ${this._detail}</span>`;
      default:
        return html``;
    }
  }

  // Messages sit under the output, as Wolfram prints them under a cell: the result is
  // still the unevaluated call, and this says why.
  #messages(): unknown {
    if (this._messages.length === 0) return html``;
    return html`${this._messages.map(
      (m) =>
        html`<span class="notatio-message"
          ><span class="notatio-message-name">${m.head}::${m.code}</span> ${m.text}${
            m.hint ? html` <span class="notatio-message-hint">${m.hint}</span>` : ""
          }</span
        >`,
    )}`;
  }

  #details(): HTMLDetailsElement | null {
    return this.renderRoot.querySelector<HTMLDetailsElement>("details");
  }

  #closeMenu(): void {
    const menu = this.#details();
    if (menu) menu.open = false;
  }

  // Dismiss like a normal dropdown: outside pointer-down or Escape.
  #onDocPointerDown = (event: Event): void => {
    if (!event.composedPath().includes(this)) this.#closeMenu();
  };

  #onToggle = (event: Event): void => {
    const open = (event.target as HTMLDetailsElement).open;
    const doc = globalThis.document;
    if (open) doc?.addEventListener("pointerdown", this.#onDocPointerDown);
    else doc?.removeEventListener("pointerdown", this.#onDocPointerDown);
  };

  // This evaluation's `In[n]`/`Out[n]` line number, when it ran inside a transcript --
  // `undefined` outside one, or before the first evaluation.
  #historyN: number | undefined;
  // The bound symbol, when the input is an assignment -- surfaced on `notatio-result`.
  #name: string | undefined;
  // `PlotInfo`, when `plot` asked for it -- surfaced on `notatio-result`.
  #plot: PlotInfo | undefined;

  // The value the picture is drawn from, kept so a change of environment redraws it
  // without evaluating again.
  #value: MathJsonExpression | undefined;
  #page: Environment = pageEnvironment();
  #unwatch = (): void => {};

  #visualize(): void {
    // Own attribute, then the nearest ancestor that forces one, then the page.
    const env =
      environmentNamed(this.env) ??
      environmentNamed(this.parentElement?.closest("[env]")?.getAttribute("env") ?? undefined) ??
      this.#page;
    this._visual = this.#value === undefined ? "" : visualMarkup(this.#value, env);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#page = pageEnvironment();
    const unwatch = watchPageEnvironment((env) => {
      this.#page = env;
      this.#visualize();
    });
    // A forcing ancestor can switch environment too (a preview card's picker).
    const forcing = this.parentElement?.closest("[env]");
    const observer = new MutationObserver(() => this.#visualize());
    if (forcing) observer.observe(forcing, { attributes: true, attributeFilter: ["env"] });
    this.#unwatch = () => {
      unwatch();
      observer.disconnect();
    };
  }

  override disconnectedCallback(): void {
    this.#unwatch();
    globalThis.document?.removeEventListener("pointerdown", this.#onDocPointerDown);
    globalThis.document?.removeEventListener("keydown", this.#onKeydown);
    clearTimeout(this.#closeTimer);
    super.disconnectedCallback();
  }

  /** What copying this Out puts on the clipboard: its InputForm, and its LaTeX. */
  get expression(): { inputForm: string; latex: string } {
    return { inputForm: this._input, latex: this._latex };
  }

  #setForm(form: Form): void {
    this.form = form;
    this.#closeMenu();
  }

  #copy(kind: "latex" | "mathjson" | "input"): void {
    const text =
      kind === "latex"
        ? Promise.resolve(`$${this._latex}$`)
        : kind === "input"
          ? this.#inputForm()
          : Promise.resolve(this._json);
    void text.then((t) => globalThis.navigator?.clipboard?.writeText(t));
    this.#closeMenu();
  }

  // InputForm on demand: a value rendered through the no-engine fast path has no
  // parsed expression yet, and copying it is reason enough to load one.
  async #inputForm(): Promise<string> {
    if (this._input) return this._input;
    try {
      const engine = await loadEngine();
      const json = this.format === "latex" ? engine.parse(this.value ?? "", { form: "raw" }).json : this.#json(engine);
      this._input = toInputForm(json);
    } catch {
      this._input = "";
    }
    return this._input;
  }

  #closeTimer: ReturnType<typeof setTimeout> | undefined;

  #hoverOpen = (): void => {
    clearTimeout(this.#closeTimer);
    const menu = this.#details();
    if (menu) menu.open = true;
  };

  // Close on hover-out, after a short grace period so moving onto the menu
  // (across any gap) cancels it.
  #hoverClose = (): void => {
    this.#closeTimer = setTimeout(() => this.#closeMenu(), 120);
  };

  // `Out` inside a transcript reads `Out[3]`, Wolfram's own label -- the number is the
  // evaluation's `$Line`, not this cell's position, so it can jump on a re-evaluation.
  #labelText(): string {
    return this.#historyN === undefined ? this.label : `${this.label}[${this.#historyN}]`;
  }

  #menu(): unknown {
    const onLabel = this.labelMenu;
    const summary = onLabel
      ? html`<summary class="notatio-io-label notatio-label-btn" title=${`${FORM_LABEL[this.form]} — click for forms`}>
          ${this.#labelText()}${
            this.form === "standard" ? "" : html`<span class="notatio-label-form">${FORM_LABEL[this.form]}</span>`
          }
        </summary>`
      : html`<summary class="notatio-menu-btn">${FORM_LABEL[this.form]}</summary>`;
    return html`<details
      class=${onLabel ? "notatio-menu is-on-label" : "notatio-menu"}
      @mouseenter=${onLabel ? undefined : this.#hoverOpen}
      @mouseleave=${onLabel ? undefined : this.#hoverClose}
      @toggle=${this.#onToggle}
      @keydown=${(e: KeyboardEvent) => e.key === "Escape" && this.#closeMenu()}
    >
      ${summary}
      <div class="notatio-menu-list" role="menu">
        ${FORMS.filter((f) => this.#formAvailable(f)).map(
          (f) =>
            html`<button
              role="menuitemradio"
              aria-checked=${this.form === f}
              class=${this.form === f ? "is-current" : ""}
              @click=${() => this.#setForm(f)}
            >
              ${FORM_LABEL[f]}
            </button>`,
        )}
        <hr />
        <button role="menuitem" @click=${() => this.#copy("input")}>Copy InputForm</button>
        <button role="menuitem" @click=${() => this.#copy("latex")}>Copy LaTeX</button>
        <button role="menuitem" @click=${() => this.#copy("mathjson")}>Copy MathJSON</button>
      </div>
    </details>`;
  }

  #code(value: string, lang: string): unknown {
    // The In/Out selector already names the form, so hide the code box's own tag.
    return html`<notatio-code language=${lang} .value=${value || "—"} hide-lang></notatio-code>`;
  }

  // Which forms make sense for the current value: MatrixForm only for a List,
  // and the source forms only when their target actually produced something.
  #formAvailable(form: Form): boolean {
    if (CODE_FORMS.has(form)) return (this._code[form as CodeForm] ?? "") !== "";
    switch (form) {
      case "matrix":
        return this._canMatrix;
      case "tree":
        return this._json !== "";
      case "asciimath":
        return this._ascii !== "";
      case "mathml":
        return this._mathml !== "";
      case "wolfram":
        return this._wolfram !== "";
      default:
        return true;
    }
  }

  #toggleNode(path: string): void {
    const next = new Set(this._expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    this._expanded = next;
  }

  // Unfold: replace the application at `path` by its head's definition, with the arguments
  // substituted for the wildcards -- one reduction step, shown rather than evaluated.
  #unfold(path: string): void {
    const node = nodeAt(this._tree, path);
    const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] } | null)?.fn;
    if (!Array.isArray(fn) || typeof fn[0] !== "string") return;
    const info = this.resolveHead?.(fn[0]);
    if (!info?.definition) return;
    const params = info.params ?? wildcardsOf(info.definition);
    const bindings = new Map(params.map((name, i) => [name, fn[i + 1]]));
    this._tree = replaceAt(this._tree, path, substitute(info.definition, bindings));
    this._folded = new Map([...this._folded, [path, node]]);
    this._expanded = new Set([...this._expanded, path]);
  }

  #fold(path: string): void {
    if (!this._folded.has(path)) return;
    this._tree = replaceAt(this._tree, path, this._folded.get(path));
    const folded = new Map(this._folded);
    folded.delete(path);
    this._folded = folded;
  }

  #head(name: string, path: string): unknown {
    const info = this.resolveHead?.(name);
    const label = info?.href
      ? html`<a class="notatio-tree-head" href=${info.href}>${name}</a>`
      : html`<span class="notatio-tree-head">${name}</span>`;
    const unfold =
      info?.definition && !this._folded.has(path)
        ? html`<button
            type="button"
            class="notatio-tree-unfold"
            title="Unfold the definition of ${name}"
            @click=${() => this.#unfold(path)}
          >
            ≝
          </button>`
        : "";
    const primitive = info?.primitive
      ? html`<span class="notatio-tree-primitive" title="On the primitive frontier: ${info.primitive}"
          >${info.primitive}</span
        >`
      : "";
    return html`${label}${unfold}${primitive}`;
  }

  // The application an unfolded node came from, as a control that folds it back.
  #origin(path: string): unknown {
    const from = this._folded.get(path);
    const fn = Array.isArray(from) ? from : (from as { fn?: unknown[] } | null)?.fn;
    if (!Array.isArray(fn) || typeof fn[0] !== "string") return "";
    return html`<button
      type="button"
      class="notatio-tree-origin"
      title="Unfolded from ${fn[0]}; fold it back"
      @click=${() => this.#fold(path)}
    >
      ${fn[0]} ≝
    </button>`;
  }

  // One TreeForm node. An application shows its head and a disclosure control; closed, the
  // arguments follow as one line of InputForm, open, each argument is a node of its own.
  // Leaves (symbols, numbers, strings) are just themselves.
  #node(json: unknown, path: string): unknown {
    const fn = Array.isArray(json) ? json : (json as { fn?: unknown[] } | null)?.fn;
    if (Array.isArray(fn) && typeof fn[0] === "string") {
      const [head, ...args] = fn as [string, ...unknown[]];
      const open = this._expanded.has(path);
      // The closed summary is the argument list, since the head is already shown.
      const oneLine = (arg: unknown): string =>
        serializeEpsil(normalizeInputForm(arg as MathJsonExpression), {
          margin: Number.POSITIVE_INFINITY,
          softMargin: Number.POSITIVE_INFINITY,
        });
      const summary = `(${args.map(oneLine).join(", ")})`;
      return html`<div class="notatio-tree-node" data-path=${path}>
        <button type="button" class="notatio-tree-toggle" aria-expanded=${open} @click=${() => this.#toggleNode(path)}>
          ${open ? "▾" : "▸"}
        </button>
        ${this.#origin(path)}${this.#head(head, path)}
        ${
          open
            ? html`<div class="notatio-tree-children">
                ${args.map((arg, i) => this.#node(arg, path ? `${path}.${i}` : `${i}`))}
              </div>`
            : html`<span class="notatio-tree-summary">${unsafeHTML(highlightCode(summary, "epsil"))}</span>`
        }
      </div>`;
    }
    const leaf =
      typeof json === "string"
        ? { cls: "sym", text: json }
        : typeof json === "number"
          ? { cls: "num", text: String(json) }
          : (json as { sym?: string } | null)?.sym !== undefined
            ? { cls: "sym", text: (json as { sym: string }).sym }
            : (json as { num?: string } | null)?.num !== undefined
              ? { cls: "num", text: (json as { num: string }).num }
              : (json as { str?: string } | null)?.str !== undefined
                ? { cls: "str", text: JSON.stringify((json as { str: string }).str) }
                : { cls: "sym", text: JSON.stringify(json) };
    return html`<div class="notatio-tree-node is-leaf" data-path=${path}>
      <span class="notatio-tree-leaf tok-${leaf.cls}">${leaf.text}</span>
    </div>`;
  }

  // TreeForm: the expression as a tree of heads, opened one level at a time, and any head
  // with a definition unfoldable in place -- the way to read an expression down to the
  // heads it bottoms out in.
  #tree(): unknown {
    if (this._tree === undefined) return html`<span class="notatio-tree">—</span>`;
    return html`<div class="notatio-tree">${this.#node(this._tree, "")}</div>`;
  }

  #content(): unknown {
    // Nothing to show yet: say so, rather than an empty row.
    if (this.busy && !this._markup && !this._visual) {
      // Only a Worker evaluation can actually be interrupted (`stop()`) -- a local
      // one runs synchronously on this thread and would only get an ignored click.
      const stoppable = transcriptHostOf(this)?.evaluatorKind === "Worker";
      return html`<span class="notatio-pending" role="status" aria-label="evaluating"
        ><span></span><span></span><span></span>${
          stoppable
            ? html`<button type="button" class="notatio-stop" title="Stop (Esc)" @click=${() => this.stop()}>■</button>`
            : ""
        }</span
      >`;
    }
    if (CODE_FORMS.has(this.form)) {
      return this.#code(this._code[this.form as CodeForm] ?? "", FORM_LANG[this.form]!);
    }
    switch (this.form) {
      case "traditional":
        return html`${unsafeHTML(this._traditional)}`;
      case "matrix":
        return html`${unsafeHTML(this._matrix)}`;
      case "tree":
        return this.#tree();
      case "input":
        return this.#code(this._input, FORM_LANG.input!);
      case "full":
        return this.#code(this._json, FORM_LANG.full!);
      case "tex":
        return this.#code(this._tex, FORM_LANG.tex!);
      case "asciimath":
        return this.#code(this._ascii, FORM_LANG.asciimath!);
      case "mathml":
        return this.#code(this._mathml, FORM_LANG.mathml!);
      case "wolfram":
        return this.#code(this._wolfram, FORM_LANG.wolfram!);
      default:
        // A head that draws is drawn: evaluation returned a picture, not a formula.
        return html`${unsafeHTML(this._visual || this._markup)}`;
    }
  }

  protected override render(): unknown {
    // Inline or display: the rendering and nothing else, for a formula in prose.
    if (this.inline || this.display) return html`${this.#content()}`;
    // Layout: a plain (unselectable) In/Out label on the left, the rendered
    // value in the middle, and the form dropdown floated to the right.
    if (this.label && this.labelMenu) {
      return html`<span class="notatio-line">${this.#menu()}<span class="notatio-render">${this.#content()}</span></span
        >${this.#messages()}${this.#status()}`;
    }
    return html`<span class="notatio-line"
        >${this.label ? html`<span class="notatio-io-label">${this.#labelText()}</span>` : ""}<span
          class="notatio-render"
          >${this.#content()}</span
        >${this.label ? this.#menu() : ""}</span
      >${this.#messages()}${this.#status()}`;
  }
}

if (!customElements.get("notatio-out")) {
  customElements.define("notatio-out", NotatioOut);
}
