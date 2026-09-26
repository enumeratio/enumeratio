import {
  openSession,
  type BrowserSession,
  type SharedWorkerFactory,
  type WorkerFactory,
} from "@enumeratio/aestimatio/browser";
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
 * `Dynamic` (design/computation.md §5.3). Anything else (absent, `"Local"`,
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

/** The `createWorker`/`createSharedWorker` factories a page builds around a literal,
 * Vite-bundleable `new Worker(new URL(...))` (`web/.vitepress/theme/worker-factories.ts`'s
 * own comment explains why a library can't do this itself) -- set once by the host, same
 * gate pattern as `WorkerSetupGate`. Without it, `openSession` falls back to computing
 * the worker's own URL, which is fine for a dev server serving raw source on request but
 * 404s ("Failed to fetch a worker script") once a production build never emitted that
 * file as an asset. */
type WorkerFactoriesGate = {
  __notatioWorkerFactories?: {
    readonly createWorker?: WorkerFactory;
    readonly createSharedWorker?: SharedWorkerFactory;
  };
};

/** Thrown by `evaluateRemote` when a session's worker (and its one respawned retry)
 * both failed to ever start -- `notatio-out.ts`'s worker branch catches exactly this and
 * evaluates that one cell locally instead of showing `$Aborted` for a failure that was
 * never the reader's doing. */
export class WorkerUnavailableError extends Error {
  constructor() {
    super('Evaluator -> "Worker": no worker could be started for this session');
    this.name = "WorkerUnavailableError";
  }
}

/**
 * How long `stop()` waits for the worker's own answer to arrive on its own before
 * giving up and hard-killing the session. `@enumeratio/aestimatio/browser`'s session
 * has no channel to tell an ALREADY-DISPATCHED, no-deadline call to check a cooperative
 * stop -- that only happens for a call started with its own `timeMs` (`TimeConstraint`,
 * below). So this is the closest honest approximation of "cooperative, then hard kill":
 * a short, fixed wait for a race the in-flight call might still win (it was nearly done
 * anyway), and a real `session.close()` + respawn if not -- the only reliable way to stop
 * a tight, uncooperative loop (design/computation.md §5.3). Aborting the call *without* this
 * (`BrowserSession.evaluate`'s own `signal`) only abandons it -- the worker keeps
 * computing in the background, and a later cell queues behind it on the same session.
 */
const STOP_GRACE_MS = 300;

/**
 * `<notatio-dynamic-module>` -- a **reactive document**, after Bret Victor's
 * [Tangle](http://worrydream.com/Tangle/): prose whose numbers you can grab, and whose
 * other numbers follow.
 *
 * It is the scope, not a control panel. The controls live inline where they are read —
 * a `<notatio-knob>` you drag, a `<notatio-toggler>` you click — and each contributes
 * its `name` as a wildcard. Everything else in the subtree that is an Epsil expression
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
     * `TimeConstraint`, in SECONDS -- Wolfram's own option name and unit
     * (`VerificationTest`'s `TimeConstraint` is seconds too, unlike aestimatio's own
     * internal `timeMs`): tried cooperatively first, then hard-kills and restarts the
     * session (design/computation.md §5.2–5.3). Unset (the default, `0`) means no deadline
     * at all -- a `Worker` evaluator without one can still be interrupted by the
     * "stop" control, just never automatically.
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
  // Set once no worker could be started for this module at all (both the original
  // attempt and its one respawned retry failed) -- `evaluatorKind` then reports
  // `"Local"` for every LATER cell too, so a page that can't run workers at all (no
  // `Worker`/`SharedWorker` support, a CSP that blocks them, ...) settles into running
  // normally instead of retrying forever, cell after cell.
  #workerUnavailable = false;

  constructor() {
    super();
    this.trace = false;
    this.trackedSymbols = "";
    this.evaluator = "";
    this.workerSetup = "";
    this.timeConstraint = 0;
    ensureStyles();
  }

  /** `"Worker"` once `Evaluator -> "Worker"` is set AND a worker has actually managed
   * to start at least once; `"Local"` otherwise (the default, or once
   * `#workerUnavailable` gives up for good). `notatio-out.ts`'s `TranscriptHost` reads
   * this to decide whether a cell's evaluation belongs on this thread or in
   * `#session`. */
  get evaluatorKind(): Evaluator {
    if (this.#workerUnavailable) return "Local";
    return parseEvaluator(this.evaluator);
  }

  #openSession(): BrowserSession {
    const setup = this.workerSetup || (globalThis as WorkerSetupGate).__notatioWorkerSetup || undefined;
    const factories = (globalThis as WorkerFactoriesGate).__notatioWorkerFactories;
    // Not `name`d: each module instance gets its own private session rather than
    // joining a page-wide `SharedWorker` -- two `Evaluator -> "Worker"` modules on
    // one page are unrelated scopes, same as two plain transcripts are.
    return openSession({
      setup,
      createWorker: factories?.createWorker,
      createSharedWorker: factories?.createSharedWorker,
    });
  }

  /**
   * Runs `json` in this module's session instead of locally -- `notatio-out.ts`
   * calls this only when `evaluatorKind` is `"Worker"`. The session is opened lazily,
   * on the first call, and kept for the module's lifetime (or until a hard kill
   * replaces it, or `disconnectedCallback` closes it) so `:=` bindings persist across
   * cells the way a plain transcript's local scope does.
   *
   * `options.signal` is THIS call's own stop request (a cell's "stop" control, or
   * Escape) -- deliberately NOT forwarded straight to `BrowserSession.evaluate`'s own
   * `signal`, which only abandons the call locally and leaves the worker running it in
   * the background (see `STOP_GRACE_MS`'s own comment). Instead, an abort here starts a
   * short race: the underlying call still wins if it lands within the grace, otherwise
   * the session is hard-killed and respawned, same outcome (and notice) as a
   * `TimeConstraint` deadline's own hard kill.
   */
  evaluateRemote(json: unknown, options: { signal?: AbortSignal } = {}): Promise<{ value: unknown; reset: boolean }> {
    const session = (this.#session ??= this.#openSession());
    // Wolfram's own unit (`TimeConstraint`, `VerificationTest`) is seconds; aestimatio's
    // session API wants ms.
    const timeMs = this.timeConstraint > 0 ? this.timeConstraint * 1000 : undefined;
    const attempt = (): Promise<{ value: unknown; reset: boolean }> => session.evaluate(json, { timeMs });

    // `reset: true` here is never a user-requested stop (that path is the `signal`
    // branch below, which resolves its own `Aborted` directly) -- it's the session's
    // OWN worker/port failing to ever start, or an uncooperative deadline hard-killing
    // it. Either way `openSession` has already respawned a fresh worker by the time
    // this promise settles, so give THIS call one more try on it before reporting
    // anything to the reader as `$Aborted` -- a worker that merely needed a second
    // attempt is not the same failure as one the reader actually asked to stop.
    const runWithRetry = async (): Promise<{ value: unknown; reset: boolean }> => {
      const first = await attempt();
      if (!first.reset) {
        this.#clearSessionResetNotice();
        return first;
      }
      const second = await attempt();
      if (!second.reset) {
        this.#clearSessionResetNotice();
        return second;
      }
      // Both the original worker/port and its replacement failed -- no more retries.
      // `notatio-out.ts`'s worker branch catches this and evaluates the cell locally
      // instead; `evaluatorKind` reports `"Local"` from here on so later cells don't
      // each retry the same dead end.
      this.#onWorkerUnavailable();
      throw new WorkerUnavailableError();
    };

    const { signal } = options;
    if (!signal) return runWithRetry();
    return new Promise((resolve, reject) => {
      let settled = false;
      let graceTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        if (graceTimer !== undefined) clearTimeout(graceTimer);
        signal.removeEventListener("abort", onAbort);
        fn();
      };
      const onAbort = (): void => {
        graceTimer = setTimeout(() => {
          // Nothing landed within the grace -- the only reliable way to stop an
          // uncooperative loop with no deadline of its own (design/computation.md §5.3).
          // This tab's bindings are gone either way; other calls already queued behind
          // this one on the session are abandoned along with it. This IS a genuine
          // user-requested stop, so `$Aborted` is the right answer -- no retry.
          finish(() => {
            if (this.#session === session) {
              session.close();
              this.#session = undefined;
            }
            this.#onSessionReset();
            resolve({ value: "Aborted", reset: true });
          });
        }, STOP_GRACE_MS);
      };
      signal.addEventListener("abort", onAbort);
      runWithRetry().then(
        (result) => finish(() => resolve(result)),
        (error: unknown) => finish(() => reject(error)),
      );
    });
  }

  /**
   * Neither the session's own worker nor its one respawned retry ever started --
   * distinct from `#onSessionReset` (a deadline that DID start a worker, then had to
   * hard-kill it): there is nothing a "re-run cells" notice would fix here, since
   * nothing about this reader's session is ever going to work. `evaluatorKind` reports
   * `"Local"` from here on (this method's own caller, `evaluateRemote`, still throws
   * for THIS call so `notatio-out.ts` can fall back for it specifically).
   */
  #onWorkerUnavailable(): void {
    this.#workerUnavailable = true;
    this.#clearSessionResetNotice();
    if (this.querySelector(":scope > .notatio-worker-unavailable")) return;
    const banner = document.createElement("div");
    banner.className = "notatio-worker-reset notatio-worker-unavailable";
    banner.setAttribute("role", "status");
    banner.textContent = "Worker unavailable — evaluating locally instead.";
    this.prepend(banner);
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
  #onCellChange = (event: CustomEvent<{ epsil: string; json: unknown }>): void => {
    if (!this.#reactive) return;
    const el = event.target;
    if (el instanceof Element && el.tagName === "NOTATIO-CELL") {
      this.#reactive.commit(el, event.detail.epsil, event.detail.json as never);
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
