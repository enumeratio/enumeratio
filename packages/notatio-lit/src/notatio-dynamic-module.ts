import { openSession, type BrowserSession } from "@enumeratio/aestimatio/browser";
import type { ComputeEngine } from "@cortex-js/compute-engine";
import { CONTROL_EVENT, Transcript, type TrackedSymbols } from "@enumeratio/notatio";
import { LitElement, nothing } from "lit";
import "./notatio-dynamic.ts";
import "./notatio-knob.ts";
import "./notatio-toggler.ts";
import "./notatio-when.ts";
import { ReactiveModule } from "./reactive-module.ts";
import { Scope } from "./scope.ts";
import { ensureStyles } from "./styles.ts";

/** `tracked-symbols="all"` or a comma list -- `symbols.ts`'s `TrackedSymbols` lowering. */
function parseTrackedSymbols(attr: string): TrackedSymbols | undefined {
  const value = attr.trim();
  if (!value) return undefined;
  if (value.toLowerCase() === "all") return "All";
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `Evaluator -> "Local" | "Worker"` -- Wolfram's own option name, borrowed from
 * `Dynamic` (design/aestimatio.md's "Build" note). Anything else (absent, `"Local"`,
 * an unrecognised value) is the default, in-page evaluation. */
type Evaluator = "Local" | "Worker";
function parseEvaluator(attr: string): Evaluator {
  return attr.trim().toLowerCase() === "worker" ? "Worker" : "Local";
}

/** A host a page can point a `Worker`-evaluator module's session at -- set once by the
 * host (mirrors `@enumeratio/notatio`'s own `__notatioEngineReady` gate) before any
 * `Evaluator -> "Worker"` module opens its session, since the worker needs to import
 * the same libraries the page declared into its own engine (`declareGraphics`,
 * `declareCollections`, …) to mean the same thing. A module with no such host set
 * still opens a session, just with no libraries beyond aestimatio's own. */
type WorkerSetupGate = { __notatioWorkerSetup?: string };

/**
 * `<notatio-dynamic-module>` -- a **reactive document**, after Bret Victor's
 * [Tangle](http://worrydream.com/Tangle/): prose whose numbers you can grab, and whose
 * other numbers follow.
 *
 * It is the scope, not a control panel. The controls live inline where they are read —
 * a `<notatio-knob>` you drag, a `<notatio-toggler>` you click — and each contributes
 * its `name` as a wildcard. Everything else in the subtree that is a notatio expression
 * over those wildcards is a template, re-evaluated on every move: a `<notatio-dynamic>`
 * readout, a `<notatio-when>` condition, or an attribute of any other component, so the
 * same knob can drive a sentence and the plot beside it.
 *
 * ```html
 * <notatio-dynamic-module>
 *   A <notatio-knob name="n" value="4" min="1" max="8" step="1" />-element set has
 *   <notatio-dynamic value="2^_n" /> subsets<notatio-when test="_n > 5">, which is
 *   already more than you want to list</notatio-when>.
 *   <notatio-figure kind="subset" value="[1,3]" n="_n" />
 * </notatio-dynamic-module>
 * ```
 *
 * Unlike `<notatio-manipulate>` — the same substitution machinery behind a Wolfram-style
 * panel of sliders — a dynamic module has no chrome of its own and renders nothing. Nested
 * modules are separate scopes: a control belongs to its nearest enclosing one.
 *
 * A dynamic module is not required: the page itself is a scope, and a control and a readout
 * with no wrapper at all still find each other. The wrapper is for isolation -- two
 * examples on one page that both call their knob `n`.
 *
 * A SECOND, unrelated capability lives here too: a **transcript**. When a `<notatio-cell>`
 * inside a module asks (`transcriptFor`), the module lazily creates one shared
 * compute-engine scope and history (`@enumeratio/notatio`'s `Transcript`) and hands it back
 * to every cell that asks -- so `Cell(a := 5)` then `Cell(a^2)` share a binding and
 * `Out(n)` / `%` read each other back, Wolfram's `$Line` transcript. This is `Notebook`'s
 * rendering (`Notebook(cells)` is `DynamicModule([Cell(...), ...])` under a Wolfram name,
 * `symbols.ts`), and it is independent of the `_k` hole-filling `Scope` above: a module
 * with no cells in it never creates one.
 */
export class NotatioDynamicModule extends LitElement {
  static properties = {
    /** Announce every knob move on the console under the `scope` debug namespace. */
    trace: { type: Boolean },
    /**
     * `All` / a comma list of symbol names -- `symbols.ts`'s `TrackedSymbols` lowering.
     * Absent (the default) keeps this a plain transcript: cells evaluate top to bottom,
     * `Out`/`In`/`InString`/`%` stay live, and cell-number references are allowed.
     */
    trackedSymbols: { type: String, attribute: "tracked-symbols" },
    /** `Evaluator -> "Local" | "Worker"` -- see `notatio-out.ts`'s `TranscriptHost`. */
    evaluator: { type: String },
    /** Module URL whose `configure(ce)` declares the page's libraries into the
     * session's engine -- overrides the host-wide `__notatioWorkerSetup` gate for
     * this one module (a test, or a page with more than one library set). */
    workerSetup: { type: String, attribute: "worker-setup" },
    /**
     * `TimeConstraint`, in ms -- Wolfram's own option name (`aestimatio`'s
     * `TimeConstrained`/`evaluateIsolated` already use it): tried cooperatively
     * first, then hard-kills and restarts the session (design/aestimatio.md §2-3).
     * Unset (the default) means no deadline at all -- a `Worker` evaluator without
     * one can still be interrupted by the "stop" control, just never automatically.
     */
    timeConstraint: { type: Number, attribute: "time-constraint" },
  };

  declare trace: boolean;
  declare trackedSymbols: string;
  declare evaluator: string;
  declare workerSetup: string;
  declare timeConstraint: number;

  #scope = new Scope(this, this);
  #transcript: Transcript | undefined;
  #reactive: ReactiveModule | undefined;
  #session: BrowserSession | undefined;

  constructor() {
    super();
    this.trace = false;
    this.trackedSymbols = "";
    this.evaluator = "";
    this.workerSetup = "";
    this.timeConstraint = 0;
    ensureStyles();
  }

  /** `"Worker"` once `Evaluator -> "Worker"` is set; `"Local"` (the default)
   * otherwise. `notatio-out.ts`'s `TranscriptHost` reads this to decide whether a
   * cell's evaluation belongs on this thread or in `#session`. */
  get evaluatorKind(): Evaluator {
    return parseEvaluator(this.evaluator);
  }

  #openSession(): BrowserSession {
    const setup =
      this.workerSetup || (globalThis as WorkerSetupGate).__notatioWorkerSetup || undefined;
    // Not `name`d: each module instance gets its own private session rather than
    // joining a page-wide `SharedWorker` -- two `Evaluator -> "Worker"` modules on
    // one page are unrelated scopes, same as two plain transcripts are.
    return openSession({ setup });
  }

  /**
   * Runs `json` in this module's session instead of locally -- `notatio-out.ts`
   * calls this only when `evaluatorKind` is `"Worker"`. The session is opened lazily,
   * on the first call, and kept for the module's lifetime (or until a hard kill
   * replaces it, or `disconnectedCallback` closes it) so `:=` bindings persist across
   * cells the way a plain transcript's local scope does.
   */
  evaluateRemote(
    json: unknown,
    options: { signal?: AbortSignal } = {},
  ): Promise<{ value: unknown; reset: boolean }> {
    this.#session ??= this.#openSession();
    const timeMs = this.timeConstraint > 0 ? this.timeConstraint : undefined;
    return this.#session.evaluate(json, { timeMs, signal: options.signal }).then((result) => {
      if (result.reset) this.#onSessionReset();
      else this.#clearSessionResetNotice();
      return result;
    });
  }

  /**
   * A `time-constraint` deadline never got a cooperative answer, so the session's own
   * hard kill fired: the worker was terminated and a fresh one spawned in its place
   * (`@enumeratio/aestimatio/browser`'s own `openSession`), losing every binding this
   * module's cells had made. There is no cooperative recovery from that -- the reader
   * has to re-run the cells that mattered -- so this says so, in the light DOM, since
   * nothing else here renders anything of its own (this class's own doc comment).
   */
  #onSessionReset(): void {
    if (this.querySelector(":scope > .notatio-worker-reset")) return;
    const banner = document.createElement("div");
    banner.className = "notatio-worker-reset";
    banner.setAttribute("role", "status");
    banner.textContent = "Worker session restarted — earlier bindings lost; re-run cells.";
    this.prepend(banner);
  }

  #clearSessionResetNotice(): void {
    this.querySelector(":scope > .notatio-worker-reset")?.remove();
  }

  // Nothing of ours belongs in the document: the prose and its inline controls are the
  // author's own light-DOM markup.
  protected override createRenderRoot(): DocumentFragment {
    return document.createDocumentFragment();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener(CONTROL_EVENT, this.#scope.onControl);
    this.addEventListener("notatio-change", this.#onCellChange as EventListener);
  }

  override disconnectedCallback(): void {
    this.removeEventListener(CONTROL_EVENT, this.#scope.onControl);
    this.removeEventListener("notatio-change", this.#onCellChange as EventListener);
    this.#session?.close();
    this.#session = undefined;
    super.disconnectedCallback();
  }

  /**
   * A descendant `<notatio-cell>` committed a new input -- the trigger a reactive module
   * reacts to (design/rendering-environments.md). Only meaningful once `TrackedSymbols`
   * is set; a plain transcript ignores its own cells' commits here.
   */
  #onCellChange = (event: CustomEvent<{ notatio: string; json: unknown }>): void => {
    if (!this.#reactive) return;
    const el = event.target;
    if (el instanceof Element && el.tagName === "NOTATIO-CELL") {
      this.#reactive.commit(el, event.detail.notatio, event.detail.json as never);
    }
  };

  protected override firstUpdated(): void {
    this.#scope.trace = this.trace;
    void this.#scope.refresh();
  }

  /** Every control this module owns — a nested module keeps its own. */
  get controls(): Element[] {
    return this.#scope.controls;
  }

  /**
   * This module's shared evaluation scope, created the first time any cell inside it asks
   * -- lazily, so a module with no cells never pays for one, and memoized, so the FIRST
   * cell to evaluate (not necessarily the first in document order, since each cell loads
   * the engine on its own schedule) settles which scope every other cell in this module
   * shares. `TrackedSymbols` decides which `Transcript` that first call builds: a plain
   * one (history on, `Out`/`In`/`InString`/`%` live, `In[n]`/`Out[n]` labels) by default,
   * or `history: false` once reactive -- cells can be read in any order there, so a
   * position-keyed label would be misleading, and a reference to one is rejected outright
   * by `tracked-symbols.ts`'s own schedule.
   *
   * When `TrackedSymbols` is set, every call also feeds the reactive graph: cheap, since
   * `register` skips a `<notatio-cell>` it already knows, and it is the only place this
   * class is handed an engine to box a not-yet-edited cell's `value` with.
   */
  transcriptFor(engine: ComputeEngine): Transcript {
    const tracked = parseTrackedSymbols(this.trackedSymbols);
    const transcript = (this.#transcript ??= new Transcript(engine, {
      history: tracked === undefined,
    }));
    if (tracked !== undefined) {
      (this.#reactive ??= new ReactiveModule(tracked)).register(this, engine, transcript);
    }
    return transcript;
  }

  protected override render(): unknown {
    return nothing;
  }
}

if (!customElements.get("notatio-dynamic-module")) {
  customElements.define("notatio-dynamic-module", NotatioDynamicModule);
}
