// A scope: the controls in a stretch of the page and the templates that read them. A
// `<dynamic-module-box>` is an explicit one over its subtree; the PAGE is the implicit one,
// so a `<slider-box name="k">` and a `<dynamic-box value="_k^2">` written
// anywhere on a page, with no wrapper, still find each other -- the wrapper is only
// for isolation, when two examples reuse a name (https://github.com/enumeratio/enumeratio/wiki/Vdom).

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import {
  CONTROL_EVENT,
  type ControlChange,
  debug,
  type VariableSpec,
  variablesOf,
  plainJson,
  resolveNamedDomains,
} from "@enumeratio/frontend/core";
import "./domains.ts";
import type { Template } from "./bindings.ts";
import { CONTROL_TAGS, type ControlElement, controlSelector } from "./define.ts";
import { ensureFor, loadBareEngine } from "./mathlive.ts";

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

/**
 * The explicit scopes: an element under one of these belongs to it, not to the page. Any element
 * that declares `variables` (a `Variables` option, lowered) is one: declaring is what starts a
 * scope, with or without a `DynamicModule` around it.
 */
export const OWNERS = "dynamic-module-box, notatio-manipulate, [variables]";

/** A number where the value is one (`-5` arrives as `Negate(5)`), else the value as read. */
const seedOf = (json: unknown): MathJsonExpression => {
  const plain = plainJson(json);
  if (Array.isArray(plain) && plain[0] === "Negate" && typeof plain[1] === "number") return -plain[1];
  return plain as MathJsonExpression;
};

export class Scope {
  #engine: ComputeEngine | undefined;
  #templates: Template[] = [];
  #templating: typeof import("./bindings.ts") | undefined;
  /** Current value per control name, as MathJSON: a number, `True`, a `List`, ... */
  #values = new Map<string, MathJsonExpression>();
  #pending: Promise<void> | undefined;
  #declared = "";
  #declarations: readonly VariableSpec[] = [];
  #listeners = new Set<() => void>();
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

  /** The variables the owner declares. */
  get declarations(): readonly VariableSpec[] {
    return this.#declarations;
  }

  /** Each variable's current value, by name (no `_`). */
  get values(): ReadonlyMap<string, MathJsonExpression> {
    return this.#values;
  }

  /** Called after every change of value; returns the way to stop. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Set a variable as a control would. */
  set(name: string, value: MathJsonExpression): void {
    this.setMany([[name, value]]);
  }

  /** Set several variables at once, so nothing reads them half-changed. */
  setMany(entries: Iterable<readonly [string, MathJsonExpression]>): void {
    for (const [name, value] of entries) this.#values.set(name, plainJson(value) as MathJsonExpression);
    this.#apply();
  }

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
    await this.#declare();
    const controls = this.controls;
    await Promise.all([...new Set(controls.map((el) => el.localName))].map((tag) => customElements.whenDefined(tag)));
    // No control, no template to fill: a page without one never loads the engine for it.
    if (controls.length === 0 && this.#templates.length === 0 && this.#declarations.length === 0) return;
    // The templates' reader and writer come with the engine: a page of cells loads neither.
    const engine = (this.#engine ??= await loadBareEngine());
    const templating = (this.#templating ??= await import("./bindings.ts"));
    for (const el of controls) this.#read(el);
    // A re-read MERGES: a template already applied has its result where the wildcard
    // was, so it would not be found again -- keep what was captured, forget only what
    // has left the page, and add what is new.
    const kept = this.#templates.filter((t) => t.el.isConnected);
    const seen = new Set(
      kept.map((t) => `${"attr" in t ? "a:" + t.attr : "p:" + t.prop}`).map((k, i) => `${k}@${idOf(kept[i].el)}`),
    );
    const found = templating.captureTemplates(
      this.root,
      new Set(this.#values.keys()),
      engine,
      (el) => !this.owns(el),
      this.owner === this.root,
    );
    for (const t of found) {
      const key = `${"attr" in t ? "a:" + t.attr : "p:" + t.prop}@${idOf(t.el)}`;
      if (!seen.has(key)) {
        kept.push(t);
        seen.add(key);
      }
    }
    this.#templates = kept;
    await templating.whenTemplatesDefined(kept);
    // The libraries the templates name, before any is filled and evaluated.
    await ensureFor(engine, ["List", ...kept.map((t) => t.json)]);
    log("%s: %o over %d templates", this.owner?.localName ?? "page", [...this.#values.keys()], this.#templates.length);
    this.#apply();
  }

  /** Read the owner's `variables` (when they changed) and seed each one not yet set. */
  async #declare(): Promise<void> {
    const text = this.owner?.getAttribute("variables") ?? "";
    if (text === this.#declared) return;
    this.#declared = text;
    if (!text.trim()) {
      this.#declarations = [];
      return;
    }
    const { parseExpression } = await import("@enumeratio/formats/expression");
    const { json, errors } = parseExpression(text);
    if (errors.length > 0) log("variables don't parse: %s", errors.join("; "));
    this.#declarations = errors.length > 0 ? [] : await resolveNamedDomains(variablesOf(plainJson(json)));
    for (const spec of this.#declarations)
      if (!this.#values.has(spec.name)) this.#values.set(spec.name, seedOf(spec.start));
  }

  /**
   * Seed a control's starting value into the scope. Each control exposes `binding` — the
   * one value it contributes, whatever it looks like on the page — so the scope never
   * has to know whether it is reading a scrubber, a list, a word or a bar of them.
   */
  #read(el: Element): void {
    const control = el as Partial<ControlElement>;
    if (!control.name || control.binding === undefined) return;
    // A declared variable starts where its declaration says; its control was drawn from that.
    if (this.#values.has(control.name) && this.#declarations.some((d) => d.name === control.name)) return;
    this.#values.set(control.name, plainJson(control.binding) as MathJsonExpression);
  }

  /** A control moved: take its value, if it is ours, and refill. */
  onControl = (event: Event): void => {
    const { name, value } = (event as CustomEvent<ControlChange>).detail;
    const from = event.target as Element | null;
    if (!name || !from || !this.owns(from)) return;
    // One form for every value (`'a'`, never `{str: "a"}`), so a choice compares with its declaration.
    this.#values.set(name, plainJson(value) as MathJsonExpression);
    if (this.trace) log("%s := %o", name, value);
    this.#apply();
  };

  /** Refill every template from the current scope. */
  #apply(): void {
    const engine = this.#engine;
    const templating = this.#templating;
    if (!engine || !templating) return;
    // An element that reads its wildcards itself gets their values; the rest are refilled.
    const bound = this.#templates.filter(templating.takesBindings);
    const bindings = Object.fromEntries([...this.#values].map(([name, value]) => [`_${name}`, value]));
    for (const t of bound) (t.el as { bindings?: Record<string, unknown> }).bindings = bindings;
    const boxed = new Map<string, BoxedExpression>();
    for (const [name, value] of this.#values) boxed.set(name, engine.box(value as never));
    templating.applyTemplates(
      engine,
      this.#templates.filter((t) => !bound.includes(t)),
      boxed,
    );
    for (const listener of this.#listeners) listener();
  }
}

let page: Scope | undefined;

/** Does an added node bring something a scope binds: a notatio element, a control, a readout, a template? */
const bringsBindings = (records: readonly MutationRecord[]): boolean =>
  records.some((r) =>
    [...r.addedNodes].some((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return false;
      const el = node as Element;
      return (
        el.localName.startsWith("notatio-") ||
        el.querySelector(`${controlSelector()}, dynamic-box, notatio-when, [value*="_"], [variables]`) !== null
      );
    }),
  );

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
    if (!bringsBindings(records)) return;
    declareScopes(document.body);
    void scope.refresh();
  }).observe(document.body, { childList: true, subtree: true });
  declareScopes(document.body);
  void scope.refresh();
  return page;
}

/** Scopes a module element keeps itself (`<dynamic-module-box>`), by owner. */
const registered = new WeakMap<Element, Scope>();
/** Scopes started by an element declaring `variables`, by that element. */
const declared = new WeakMap<Element, Scope>();

/** Make `scope` the one `scopeOf` finds for elements under `owner`. */
export function registerScope(owner: Element, scope: Scope): void {
  registered.set(owner, scope);
}

/** The scope an element declaring `variables` starts, made (and listening) on first use. */
function declaredScope(owner: Element): Scope {
  let scope = registered.get(owner) ?? declared.get(owner);
  if (scope) return scope;
  const made = new Scope(owner, owner);
  declared.set(owner, made);
  owner.addEventListener(CONTROL_EVENT, made.onControl);
  new MutationObserver((records) => {
    if (records.some((r) => r.type === "attributes") || bringsBindings(records)) void made.refresh();
  }).observe(owner, { childList: true, subtree: true, attributes: true, attributeFilter: ["variables"] });
  void made.refresh();
  return made;
}

/** Start (or refresh) the scope of every element under `root` that declares `variables`. */
function declareScopes(root: Element): void {
  for (const el of root.querySelectorAll("[variables]")) void declaredScope(el).refresh();
}

/** The scope `el` belongs to: its nearest declaring ancestor's, a module's, or the page's. */
export function scopeOf(el: Element): Scope | undefined {
  const owner = el.closest(OWNERS);
  if (!owner) return pageScope();
  return registered.get(owner) ?? (owner.hasAttribute("variables") ? declaredScope(owner) : undefined);
}
