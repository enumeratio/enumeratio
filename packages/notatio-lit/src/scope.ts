// A scope: the controls in a stretch of the page and the templates that read them. A
// `<notatio-dynamic-module>` is an explicit one over its subtree; the PAGE is the implicit one,
// so a `<notatio-slider name="k">` and a `<notatio-dynamic value="_k^2">` written
// anywhere on a page, with no wrapper, still find each other -- the wrapper is only
// for isolation, when two examples reuse a name (design/vdom.md).

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { CONTROL_EVENT, type ControlChange, debug } from "@enumeratio/notatio";
import { applyTemplates, captureTemplates, type Template } from "./bindings.ts";
import { CONTROL_TAGS, type ControlElement, controlSelector } from "./define.ts";
import { loadEngine } from "./mathlive.ts";

const log = debug("scope");

/** A stable id per element, for telling templates apart across re-reads. */
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

/** The explicit scopes: an element under one of these belongs to it, not to the page. */
const OWNERS = "notatio-dynamic-module, notatio-manipulate";

export class Scope {
  #engine: ComputeEngine | undefined;
  #templates: Template[] = [];
  /** Current value per control name, as MathJSON: a number, `True`, a `List`, ... */
  #values = new Map<string, MathJsonExpression>();
  #pending: Promise<void> | undefined;
  trace = false;

  /**
   * `root` is what is scanned; `owner` is the element controls and templates must
   * belong to (their nearest explicit scope), or undefined for the page, whose members
   * are the ones under no explicit scope at all.
   */
  constructor(
    readonly root: Element,
    readonly owner?: Element,
  ) {}

  /** Does this element belong to this scope, rather than to a scope nested in it? */
  owns(el: Element): boolean {
    return el.closest(OWNERS) === (this.owner ?? null);
  }

  /** Every control this scope owns. */
  get controls(): Element[] {
    if (CONTROL_TAGS.size === 0) return [];
    return [...this.root.querySelectorAll(controlSelector())].filter((el) => this.owns(el));
  }

  /** Read the controls, capture the templates, apply. Coalesced: one pass per tick. */
  refresh(): Promise<void> {
    this.#pending ??= Promise.resolve().then(async () => {
      this.#pending = undefined;
      await this.#capture();
    });
    return this.#pending;
  }

  async #capture(): Promise<void> {
    // The controls may not have been upgraded yet, and their values live on the
    // instances (VitePress binds custom-element strings as properties).
    customElements.upgrade(this.root);
    const controls = this.controls;
    await Promise.all(
      [...new Set(controls.map((el) => el.localName))].map((tag) =>
        customElements.whenDefined(tag),
      ),
    );
    const engine = (this.#engine ??= await loadEngine());
    for (const el of controls) this.#read(el);
    // A re-read MERGES: a template already applied has its result where the wildcard
    // was, so it would not be found again -- keep what was captured, forget only what
    // has left the page, and add what is new.
    const kept = this.#templates.filter((t) => t.el.isConnected);
    const seen = new Set(
      kept
        .map((t) => `${"attr" in t ? "a:" + t.attr : "p:" + t.prop}`)
        .map((k, i) => `${k}@${idOf(kept[i].el)}`),
    );
    const found = captureTemplates(
      this.root,
      new Set(this.#values.keys()),
      engine,
      (el) => !this.owns(el),
    );
    for (const t of found) {
      const key = `${"attr" in t ? "a:" + t.attr : "p:" + t.prop}@${idOf(t.el)}`;
      if (!seen.has(key)) {
        kept.push(t);
        seen.add(key);
      }
    }
    this.#templates = kept;
    log(
      "%s: %o over %d templates",
      this.owner?.localName ?? "page",
      [...this.#values.keys()],
      this.#templates.length,
    );
    this.#apply();
  }

  /**
   * Seed a control's starting value into the scope. Each control exposes `binding` — the
   * one value it contributes, whatever it looks like on the page — so the scope never
   * has to know whether it is reading a scrubber, a list, a word or a bar of them.
   */
  #read(el: Element): void {
    const control = el as Partial<ControlElement>;
    if (!control.name || control.binding === undefined) return;
    this.#values.set(control.name, control.binding);
  }

  /** A control moved: take its value, if it is ours, and refill. */
  onControl = (event: Event): void => {
    const { name, value } = (event as CustomEvent<ControlChange>).detail;
    const from = event.target as Element | null;
    if (!name || !from || !this.owns(from)) return;
    this.#values.set(name, value);
    if (this.trace) log("%s := %o", name, value);
    this.#apply();
  };

  /** Refill every template from the current scope. */
  #apply(): void {
    const engine = this.#engine;
    if (!engine) return;
    const boxed = new Map<string, BoxedExpression>();
    for (const [name, value] of this.#values) boxed.set(name, engine.box(value as never));
    applyTemplates(engine, this.#templates, boxed);
  }
}

let page: Scope | undefined;

/**
 * The page's scope, made on first use: every control and template under no explicit
 * scope. It listens for control changes at the document and re-captures whenever
 * notatio elements arrive, so a page assembled by a framework binds as it mounts.
 */
export function pageScope(): Scope {
  if (page) return page;
  page = new Scope(document.body);
  document.addEventListener(CONTROL_EVENT, page.onControl);
  const scope = page;
  new MutationObserver((records) => {
    for (const r of records) {
      for (const node of r.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const el = node as Element;
        // A notatio element, or something with one inside: a control, a readout, a
        // conditional, or any element whose attribute holds a wildcard.
        if (
          el.localName.startsWith("notatio-") ||
          el.querySelector(`${controlSelector()}, notatio-dynamic, notatio-when, [value*="_"]`)
        ) {
          void scope.refresh();
          return;
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
  void scope.refresh();
  return page;
}
