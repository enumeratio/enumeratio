import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { parseNotatio } from "@enumeratio/formats/notatio";
import {
  cellBindings,
  schedule,
  type CellBindings,
  type TrackedSymbols,
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

/**
 * The DOM-facing half of `TrackedSymbols` (`@enumeratio/notatio`'s `tracked-symbols.ts`
 * has the pure graph): one `CellBindings` per `<notatio-cell>` a `<notatio-dynamic-module>`
 * has seen, kept current as each cell commits, and `schedule`'s diagnostics turned into
 * `data-reactive-error` on the cells they cite -- a duplicate definition or a cycle shown
 * on every cell it names, an ordinal reference rejected outright, the way
 * design/rendering-environments.md's `TrackedSymbols` capability is supposed to read.
 *
 * What this class does NOT yet do: make a downstream cell actually re-evaluate when an
 * upstream one commits. That needs a hook into `notatio-cell`/`notatio-out`'s own
 * evaluation -- exactly the files a sibling branch is mid-rewrite on (commit-on-blur for
 * `notatio-cell`/`notatio-in`/`notatio-out`). Landing that wire now would conflict with
 * work already in flight; everything below "make the sibling redraw" -- the graph, the
 * order, the diagnostics -- is real and independently tested.
 */
export class ReactiveModule {
  readonly tracked: TrackedSymbols;
  #engine: ComputeEngine | undefined;
  readonly #cells = new Map<number, CellBindings>();
  readonly #elements = new Map<number, Element>();

  constructor(tracked: TrackedSymbols) {
    this.tracked = tracked;
  }

  /**
   * Pick up every `<notatio-cell>` under `root` this module has not seen yet, from its
   * own `value` attribute -- the only source of truth for a cell that has never been
   * edited, since `notatio-cell` fires no `notatio-change` until a reader commits one.
   * Cheap to call on every evaluation (`transcriptFor`'s caller already has the engine);
   * a cell already known is left as its last commit found it.
   */
  register(root: ParentNode, engine: ComputeEngine): void {
    this.#engine = engine;
    const known = new Set(this.#elements.values());
    for (const el of root.querySelectorAll("notatio-cell")) {
      if (known.has(el)) continue;
      // Only `format="notatio"` (the default, and what a lowered `Cell(...)` always
      // gets) is read this way; a hand-authored LaTeX/MathJSON/Wolfram cell registers
      // for real the first time it commits.
      const format = el.getAttribute("format") ?? "notatio";
      if (format !== "notatio") continue;
      this.#update(el, el.getAttribute("value") ?? "");
    }
    this.#revalidate();
  }

  /** A cell committed (`notatio-change`): refresh its bindings and recheck the graph. */
  commit(el: Element, notatioSource: string, json: MathJsonExpression | undefined): void {
    if (!this.#engine) return;
    this.#elements.set(idOf(el), el);
    this.#cells.set(idOf(el), cellBindings(this.#engine, idOf(el), notatioSource, json));
    this.#revalidate();
  }

  #update(el: Element, source: string): void {
    if (!this.#engine) return;
    const id = idOf(el);
    this.#elements.set(id, el);
    let json: MathJsonExpression | undefined;
    try {
      json = parseNotatio(source, { allow: ["Assign"] }).json;
    } catch {
      json = undefined;
    }
    this.#cells.set(id, cellBindings(this.#engine, id, source, json));
  }

  #revalidate(): void {
    const sched = schedule([...this.#cells.values()]);
    const errored = new Map(sched.diagnostics.map((d) => [d.cellId, d.message]));
    for (const [id, el] of this.#elements) {
      const message = errored.get(id);
      el.toggleAttribute("data-reactive-error", message !== undefined);
      if (message !== undefined) el.setAttribute("title", message);
      else el.removeAttribute("title");
    }
  }
}
