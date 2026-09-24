import type { ComputeEngine } from "@cortex-js/compute-engine";
import { type MathJsonExpression, serializeEpsil } from "@cortex-js/compute-engine/epsil";
import { normalizeInputForm, toInputForm } from "@enumeratio/formats/inputform";
import { toMathML } from "@enumeratio/formats/mathml";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { toWolfram } from "@enumeratio/wolfram";
import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import "./notatio-code.ts";
import { loadEngine, loadMarkup } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";
import {
  collectErrors,
  deepEqual,
  highlightCode,
  markupOf,
  renderingOf,
  toTraditionalLatex,
} from "@enumeratio/notatio";

type Format = "latex" | "mathjson" | "notatio";
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
const CODE_FORMS = new Set<Form>([
  ...(Object.keys(CODE_TARGETS) as Form[]),
  "javascript",
  "gpushader",
]);

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
  input: "notatio",
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
 * cell hands it the editor's LaTeX), MathJSON or notatio; optionally evaluates first.
 * Renders in light DOM so the host page's MathLive static stylesheet applies.
 * compute-engine is loaded only when the input is MathJSON or notatio, or evaluation
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
    /** How to read `value`: `latex`, `mathjson` or `notatio`. */
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
    this.labelMenu = false;
    this.busy = false;
    this._markup = "";
    this._visual = "";
    this._traditional = "";
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
    if (
      changed.has("value") ||
      changed.has("format") ||
      changed.has("evaluate") ||
      changed.has("box") ||
      changed.has("raw") ||
      changed.has("display") ||
      changed.has("expect")
    ) {
      void this.#recompute();
    } else if (changed.has("form") && !this._input) {
      // The no-engine fast path leaves InputForm (and the copy action behind it)
      // unfilled; asking for it is what pays for the engine.
      void this.#recompute();
    }
  }

  async #evaluate(): Promise<{ latex: string; json: unknown }> {
    const source = this.value ?? "";
    if (!source.trim()) return { latex: "", json: undefined };
    // Fast path: render given LaTeX as-is, no engine, when nothing needs it.
    // `box` forces boxing (without evaluating) so the source/AST forms populate.
    // Every other form needs the parsed expression, so only StandardForm takes it.
    if (
      this.format === "latex" &&
      !this.evaluate &&
      !this.box &&
      !this.expect &&
      this.form === "standard"
    ) {
      // MathLive's static renderer takes its style from the LaTeX itself.
      return { latex: this.display ? `\\displaystyle ${source}` : source, json: undefined };
    }
    const engine = await loadEngine();
    // `raw` keeps the authored tree; evaluation canonicalises regardless, so it wins.
    const form = this.raw && !this.evaluate ? { form: "raw" as const } : undefined;
    const boxed =
      this.format === "latex" ? engine.parse(source, form) : engine.box(this.#json(engine), form);
    const result = this.evaluate ? boxed.evaluate() : boxed;
    return { latex: result.latex, json: result.json };
  }

  /** `value` as MathJSON, for the two encodings that are not LaTeX. A notatio diagnostic throws. */
  #json(engine: ComputeEngine): MathJsonExpression {
    const source = this.value ?? "";
    if (this.format === "mathjson") return JSON.parse(source) as MathJsonExpression;
    const { json, errors } = parseNotatio(source, {
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
        const compileFn = (mod as unknown as { compile?: (e: unknown, o: unknown) => unknown })
          .compile;
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
        const emitted = emitComplexWGSL(
          (expr as unknown as { json: unknown }).json as never,
          unknowns[0],
        );
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
      const { latex, json } = await this.#evaluate();
      const convert = await loadMarkup();
      if (run !== this.#runs) return;
      this._expanded = new Set([""]);
      this._tree = json;
      this._folded = new Map();
      this._latex = latex;
      this._json = json === undefined ? "" : JSON.stringify(json);
      this._markup = latex ? convert(latex) : "";
      const rendering = json === undefined ? undefined : renderingOf(json as MathJsonExpression);
      this._visual = rendering === undefined ? "" : markupOf(rendering);
      this._wolfram = json === undefined ? "" : toWolfram(json as Parameters<typeof toWolfram>[0]);
      // MathMLForm: presentation MathML, straight off the MathJSON tree -- no engine,
      // and output only, so nothing parses it back.
      this._mathml = json === undefined ? "" : toMathML(json as MathJsonExpression);
      // InputForm: the same expression as notatio you could type back in.
      this._input = json === undefined ? "" : toInputForm(json as MathJsonExpression);
      if (json === undefined) {
        this._traditional = this._markup;
        this._matrix = this._markup;
        this._canMatrix = false;
      } else {
        const engine = await loadEngine();
        if (run !== this.#runs) return;
        this._traditional = convert(toTraditionalLatex(json, engine));
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
      this._json = "";
      this._status = "error";
      this._detail = err instanceof Error ? err.message : String(err);
    }
    // Let containers (e.g. a reference cell) react to the assertion outcome.
    this.dispatchEvent(
      new CustomEvent("notatio-assert", {
        detail: { status: this._status, message: this._detail },
        bubbles: true,
        composed: true,
      }),
    );
    // Expose the evaluated result so a notebook can reference it (e.g. REPL `%n`).
    // Empty on error/blank; the LaTeX round-trips back into a downstream input.
    this.dispatchEvent(
      new CustomEvent("notatio-result", {
        detail: { latex: this._latex, json: this._json },
        bubbles: true,
        composed: true,
      }),
    );
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

  override disconnectedCallback(): void {
    globalThis.document?.removeEventListener("pointerdown", this.#onDocPointerDown);
    clearTimeout(this.#closeTimer);
    super.disconnectedCallback();
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
      const json =
        this.format === "latex"
          ? engine.parse(this.value ?? "", { form: "raw" }).json
          : this.#json(engine);
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

  #menu(): unknown {
    const onLabel = this.labelMenu;
    const summary = onLabel
      ? html`<summary
          class="notatio-io-label notatio-label-btn"
          title=${`${FORM_LABEL[this.form]} — click for forms`}
        >
          ${this.label}${
            this.form === "standard"
              ? ""
              : html`<span class="notatio-label-form">${FORM_LABEL[this.form]}</span>`
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
      ? html`<span
          class="notatio-tree-primitive"
          title="On the primitive frontier: ${info.primitive}"
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
        <button
          type="button"
          class="notatio-tree-toggle"
          aria-expanded=${open}
          @click=${() => this.#toggleNode(path)}
        >
          ${open ? "▾" : "▸"}
        </button>
        ${this.#origin(path)}${this.#head(head, path)}
        ${
          open
            ? html`<div class="notatio-tree-children">
                ${args.map((arg, i) => this.#node(arg, path ? `${path}.${i}` : `${i}`))}
              </div>`
            : html`<span class="notatio-tree-summary"
                >${unsafeHTML(highlightCode(summary, "notatio"))}</span
              >`
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
      return html`<span class="notatio-pending" role="status" aria-label="evaluating"
        ><span></span><span></span><span></span
      ></span>`;
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
        return this.#code(this._latex, FORM_LANG.tex!);
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
      return html`<span class="notatio-line"
          >${this.#menu()}<span class="notatio-render">${this.#content()}</span></span
        >${this.#status()}`;
    }
    return html`<span class="notatio-line"
        >${this.label ? html`<span class="notatio-io-label">${this.label}</span>` : ""}<span
          class="notatio-render"
          >${this.#content()}</span
        >${this.label ? this.#menu() : ""}</span
      >${this.#status()}`;
  }
}

if (!customElements.get("notatio-out")) {
  customElements.define("notatio-out", NotatioOut);
}
