import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { parseNotatio } from "@enumeratio/formats/notatio";
import {
  affected,
  cellBindings,
  schedule,
  type CellBindings,
  type Schedule,
  type TrackedSymbols,
  type Transcript,
} from "@enumeratio/notatio";

/** A stable id per element, the same idiom `scope.ts` uses for templates and controls. */
const ids = new WeakMap<Element, number>();
let nextId = 1;
const idOf = (el: Element): number => {
  let id = ids.get(el);
  if (id === undefined) {
    id = nextId++;
    ids.set(el, id);
  }
  return id;
};

/** The `<notatio-out>` a `<notatio-cell>` (light DOM) renders for its Out row, if any. */
interface RevalidatableOut extends Element {
  revalidate?: () => Promise<void>;
}
const outOf = (cell: Element): RevalidatableOut | null => cell.querySelector("notatio-out");

/**
 * The DOM-facing half of `TrackedSymbols` (`@enumeratio/notatio`'s `tracked-symbols.ts`
 * has the pure graph): one `CellBindings` per `<notatio-cell>` a `<notatio-dynamic-module>`
 * has seen, kept current as each cell commits, and `schedule`'s diagnostics turned into
 * `data-reactive-error` on the cells they cite -- a duplicate definition or a cycle shown
 * on every cell it names, an ordinal reference rejected outright, the way
 * design/rendering-environments.md's `TrackedSymbols` capability is supposed to read.
 *
 * Making a cell's binding actually visible to another cell is two steps, not one:
 *
 * 1. **Prewarm** -- evaluate each cell's own MathJSON (already in hand from `#update`/
 *    `commit`, never from a `<notatio-out>`'s current display) directly through the
 *    shared `Transcript`'s scope, in `schedule` order. This is what actually binds `a`
 *    before `b := a + 1` reads it, and it does not depend on any `<notatio-cell>`'s own
 *    async load having settled -- it runs off the JSON this class already parsed.
 * 2. **Revalidate** -- ask each affected cell's own `<notatio-out>` (`revalidate`, added
 *    for this) to re-run its normal evaluation, so the DISPLAYED markup/messages/status
 *    catch up to what the prewarm just bound. A cell that has not rendered its Out yet
 *    is left alone: once it does, it reads the already-correct scope on its own.
 *
 * Re-entrancy: `register` is called on every evaluation inside this module (any
 * `<notatio-cell>`'s `<notatio-out>` asks `transcriptFor` for its scope), including the
 * ones this class triggers itself via `revalidate`. It only starts a prewarm pass when
 * it finds cells it has not seen before, so a call with nothing new is a cheap no-op --
 * which is also what stops the prewarm pass from re-triggering itself forever.
 */
export class ReactiveModule {
  readonly tracked: TrackedSymbols;
  #engine: ComputeEngine | undefined;
  #transcript: Transcript | undefined;
  readonly #cells = new Map<number, CellBindings>();
  readonly #json = new Map<number, MathJsonExpression | undefined>();
  readonly #elements = new Map<number, Element>();
  readonly #known = new Set<Element>();

  constructor(tracked: TrackedSymbols) {
    this.tracked = tracked;
  }

  /**
   * Pick up every `<notatio-cell>` under `root` this module has not seen yet, from its
   * own `value` attribute -- the only source of truth for a cell that has never been
   * edited, since `notatio-cell` fires no `notatio-change` until a reader commits one.
   * Cheap to call on every evaluation; a cell already known is left where its last
   * commit (or the last prewarm pass) put it.
   */
  register(root: ParentNode, engine: ComputeEngine, transcript: Transcript): void {
    this.#engine = engine;
    this.#transcript = transcript;
    const discovered: number[] = [];
    for (const el of root.querySelectorAll("notatio-cell")) {
      if (this.#known.has(el)) continue;
      this.#known.add(el);
      // Only `format="notatio"` (the default, and what a lowered `Cell(...)` always
      // gets) is read this way; a hand-authored LaTeX/MathJSON/Wolfram cell registers
      // for real the first time it commits.
      const format = el.getAttribute("format") ?? "notatio";
      if (format !== "notatio") continue;
      discovered.push(this.#update(el, el.getAttribute("value") ?? ""));
    }
    const sched = this.#applyDiagnostics();
    if (discovered.length > 0) void this.#settle(sched);
  }

  /** A cell committed (`notatio-change`): refresh its bindings, recheck the graph, re-run. */
  commit(el: Element, notatioSource: string, json: MathJsonExpression | undefined): void {
    if (!this.#engine) return;
    this.#known.add(el);
    const id = idOf(el);
    this.#elements.set(id, el);
    this.#json.set(id, json);
    this.#cells.set(id, cellBindings(this.#engine, id, notatioSource, json));
    const sched = this.#applyDiagnostics();
    void this.#run(affected([...this.#cells.values()], sched, id, this.tracked), sched);
  }

  #update(el: Element, source: string): number {
    const id = idOf(el);
    this.#elements.set(id, el);
    let json: MathJsonExpression | undefined;
    try {
      json = parseNotatio(source, { allow: ["Assign"] }).json;
    } catch {
      json = undefined;
    }
    this.#json.set(id, json);
    this.#cells.set(id, cellBindings(this.#engine!, id, source, json));
    return id;
  }

  #applyDiagnostics(): Schedule {
    const sched = schedule([...this.#cells.values()]);
    const errored = new Map(sched.diagnostics.map((d) => [d.cellId, d.message]));
    for (const [id, el] of this.#elements) {
      const message = errored.get(id);
      el.toggleAttribute("data-reactive-error", message !== undefined);
      if (message !== undefined) el.setAttribute("title", message);
      else el.removeAttribute("title");
    }
    return sched;
  }

  /** Every known cell, once, in dependency order -- the initial-load settle pass. */
  #settle(sched: Schedule): Promise<void> {
    return this.#run(sched.order, sched);
  }

  /** Prewarm `ids` through the shared scope, in order, then revalidate their Outs. */
  async #run(ids: readonly number[], sched: Schedule): Promise<void> {
    if (!this.#engine || !this.#transcript) return;
    const bad = new Set(sched.diagnostics.map((d) => d.cellId));
    for (const id of ids) {
      if (bad.has(id)) continue; // a duplicate/cycle/ordinal cell has nothing safe to run
      const json = this.#json.get(id);
      if (json === undefined) continue;
      try {
        this.#transcript.run(() => this.#engine!.box(json).evaluate());
      } catch {
        // Surfaced through the cell's own Out (revalidate, below) rather than here.
      }
    }
    for (const id of ids) {
      const out = this.#elements.get(id) && outOf(this.#elements.get(id)!);
      if (out?.revalidate) await out.revalidate();
    }
  }
}
