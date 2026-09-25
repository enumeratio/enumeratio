// The structural spelling of a built component, lowered in place: a `<notatio-plot>`
// whose children are `<notatio-sin>…</notatio-sin><notatio-tuple>x, 0, 10</notatio-tuple>`
// is `Plot(Sin(x), (x, 0, 10))`, and the same table `renderingOf` uses to turn that
// expression into attributes (`symbols.ts`, in the base) turns these children into
// them here. A framework that emits the structural tree -- `<Notatio>` in Vue or React,
// or a hand-written `<Plot><Sin>…` -- needs to know nothing about the lowering: the
// element does it (design/vdom.md).
//
// Options arrive as attributes already (`plot-range="All"`); the ones a component
// spells differently (`PlotLabel` is the plot's `label`) are mapped the same way.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { withOptions } from "@enumeratio/formats";
import { parseNotatio, serializeNotatio } from "@enumeratio/formats/notatio";
import {
  CONTROL_HEADS,
  DRAWING_SYMBOLS,
  lowerOptions,
  markupOf,
  optionAttribute,
  renderingOf,
  slottedExceptDeclarations,
  type VisualSymbol,
} from "@enumeratio/notatio";
import { controlSelector } from "./define.ts";
import { isExpressive } from "./generic.ts";

const BY_TAG = new Map<string, VisualSymbol>();
for (const s of DRAWING_SYMBOLS)
  if (!BY_TAG.has(s.tag) && s.fixed === undefined) BY_TAG.set(s.tag, s);
for (const s of DRAWING_SYMBOLS) if (!BY_TAG.has(s.tag)) BY_TAG.set(s.tag, s);

const ADOPTED = new WeakSet<Element>();

/** The argument children: the expressive ones that are not slotted options. */
function argumentsOf(el: Element): MathJsonExpression[] {
  const out: MathJsonExpression[] = [];
  for (const child of el.children) {
    if (child.hasAttribute("slot") || child.classList.contains("notatio-structure-args")) continue;
    if (isExpressive(child)) {
      const e = child.expression;
      if (e !== undefined) out.push(e);
    }
  }
  return out;
}

/** The options the element's attributes spell in Wolfram's names, parsed back. */
function optionsOn(el: Element, symbol: VisualSymbol): Record<string, MathJsonExpression> {
  const options: Record<string, MathJsonExpression> = {};
  for (const name of Object.keys(symbol.options ?? {})) {
    const raw = el.getAttribute(optionAttribute(name));
    if (raw === null) continue;
    const { json, errors } = parseNotatio(raw === "true" ? "True" : raw);
    if (!errors.length) options[name] = json as MathJsonExpression;
  }
  return options;
}

const SCOPES = "notatio-dynamic-module, notatio-manipulate";

/** The heads whose arguments are their children on the page, not attributes. */
const LAYOUT_HEADS = new Set(["Row", "Column", "Grid", "Panel", "Labeled"]);

/** A generic element's argument children: the ones its hidden holder keeps. */
const heldArguments = (el: Element): Element[] => {
  const holder = el.querySelector(":scope > .notatio-generic-args");
  return Array.from((holder ?? el).children);
};

/**
 * A layout written structurally -- `<notatio-row><notatio-list>…</notatio-list></notatio-row>`
 * -- lays out the list's entries, so they come up to be the layout's own children; a
 * grid's rows come up two levels. A string among them is a run of text, as
 * `renderingOf` reads it; a label is an attribute, so it goes into the holder. An
 * expression that reads a control's variable is a readout of it, as `renderingOf` makes
 * one: `Sin(Pi * t)` beside `Animator(t, …)` follows the animator.
 */
function unwrapLayout(el: Element, head: string, names: ReadonlySet<string>): void {
  const entries: Element[] = [];
  const spread = (child: Element, depth: number): void => {
    if (child.localName === "notatio-list" && depth > 0) {
      for (const inner of heldArguments(child)) spread(inner, depth - 1);
      child.remove();
      return;
    }
    entries.push(child);
  };
  const expressive = Array.from(el.children).filter(
    (c) => !c.hasAttribute("slot") && isExpressive(c),
  );
  const asText = (entry: Element): void => {
    if (entry.localName !== "notatio-string") return;
    const text = document.createElement("span");
    // The property, when a framework set it that way; the attribute otherwise.
    text.textContent = (entry as { value?: string }).value || entry.getAttribute("value") || "";
    entry.replaceWith(text);
  };
  const asReadout = (entry: Element): void => {
    const generic = entry.hasAttribute("data-notatio-generic") && isExpressive(entry);
    const expr = generic ? entry.expression : undefined;
    if (expr === undefined || names.size === 0) return;
    const slotted = slottedExceptDeclarations(expr as never, names);
    if (JSON.stringify(slotted) === JSON.stringify(expr)) return;
    const readout = document.createElement("notatio-dynamic");
    readout.setAttribute("value", serializeNotatio(slotted as never));
    entry.replaceWith(readout);
  };
  if (head === "Labeled") {
    // `Labeled(body, label, position)`: everything past the body is an attribute already.
    const [body, ...rest] = expressive;
    if (rest.length > 0) {
      const holder = document.createElement("span");
      holder.className = "notatio-structure-args";
      holder.hidden = true;
      holder.append(...rest);
      el.prepend(holder);
    }
    if (body !== undefined) {
      asText(body);
      asReadout(body);
    }
    return;
  }
  for (const child of expressive) spread(child, head === "Grid" ? 2 : 1);
  for (const entry of entries) {
    if (entry.parentElement !== el) el.append(entry);
    asText(entry);
    asReadout(entry);
  }
}

/**
 * The names the controls in `el`'s scope declare -- what a readout beside them reads
 * as wildcards. A control's own name is on it once it is adopted, which is why the
 * controls are adopted first.
 */
function scopeNames(el: Element): Set<string> {
  const root = el.closest(SCOPES) ?? document.body;
  const names = new Set<string>();
  for (const c of root.querySelectorAll(controlSelector())) {
    if (c.closest(SCOPES) !== (root === document.body ? null : root)) continue;
    const name = c.getAttribute("name") ?? (c as { name?: string }).name;
    if (name) names.add(name);
  }
  return names;
}

/**
 * Lower a built component's structural children and Wolfram-named options into its
 * own attributes, once, leaving an attribute the author set alone. The argument
 * children are moved into a hidden holder so they stay readable but do not show. A
 * variable a control in the same scope declares is read as its wildcard, so
 * `Dynamic(k^2)` beside `Slider(k, …)` follows the slider -- the realisation of a scope,
 * done where the expression meets the page.
 */
export function adoptStructure(el: Element): void {
  const symbol = BY_TAG.get(el.localName);
  if (symbol === undefined || ADOPTED.has(el)) return;
  // The children may not have been upgraded yet, and their expressions live on the
  // instances.
  customElements.upgrade(el);
  let args = argumentsOf(el);
  const options = optionsOn(el, symbol);
  if (args.length === 0 && Object.keys(options).length === 0) return;
  ADOPTED.add(el);
  // The element now stands for an expression, like a generic one does, so a layout or a
  // Labeled around it can read it as an argument. The declared spelling, not the
  // wildcarded one: a scope is realisation, not structure.
  Object.defineProperty(el, "expression", {
    value: withOptions(symbol.head, args, options),
    configurable: true,
    writable: true,
  });
  if (args.length > 0) {
    const names = scopeNames(el);
    if (names.size > 0) {
      // A control declares its variable in its first argument; everything else reads.
      const whole = slottedExceptDeclarations([symbol.head, ...args] as never, names) as unknown;
      const fn = (whole as { fn?: unknown[] }).fn ?? (whole as unknown[]);
      args = (fn as MathJsonExpression[]).slice(1);
    }
  }
  // An argument's attribute yields to one the author set -- empty counts as unset, since
  // an upgraded control has already reflected `name=""`. An option's attribute is
  // rewritten: it came from the element's own `plot-range="(-1, 1)"`, in Wolfram's
  // spelling, and the component wants its own.
  if (args.length > 0) {
    // A layout's shape IS its children (a grid's `columns` is the rows' width), and the
    // element has already reflected its default, so there the arguments win.
    const layout = LAYOUT_HEADS.has(symbol.head);
    for (const [attr, value] of Object.entries(symbol.attributes(args))) {
      if (layout || !el.getAttribute(attr)) el.setAttribute(attr, value);
    }
  }
  for (const [attr, value] of Object.entries(lowerOptions(symbol, options).attributes)) {
    if (el.getAttribute(attr) !== value) el.setAttribute(attr, value);
  }
  if (LAYOUT_HEADS.has(symbol.head)) {
    unwrapLayout(el, symbol.head, scopeNames(el));
    return;
  }
  if (args.length > 0) {
    const holder = document.createElement("span");
    holder.className = "notatio-structure-args";
    holder.hidden = true;
    // A copy: appending to the holder removes from the live collection.
    for (const child of Array.from(el.children)) {
      if (!child.hasAttribute("slot") && isExpressive(child)) holder.append(child);
    }
    el.prepend(holder);
  }
  // A head whose operands render as children (a Manipulate's body) shows them as the
  // markup path does -- its parameters read as wildcards -- while the structure stays held.
  if (symbol.children !== undefined && args.length > 0) {
    const shown = renderingOf(withOptions(symbol.head, args, options), true)?.children ?? [];
    el.insertAdjacentHTML("beforeend", shown.map(markupOf).join(""));
  }
}

/**
 * Adopt every built component under `root` that was written structurally: what sits
 * inside a control's arguments, then the controls, so their names are on them when a
 * readout looks for its scope; then the rest deepest first, so a component's
 * expression is there before its parent reads it.
 */
export function adoptStructures(root: ParentNode): void {
  const tags = [...BY_TAG.entries()];
  const controls = tags.filter(([, s]) => CONTROL_HEADS.has(s.head)).map(([t]) => t);
  const rest = tags.filter(([, s]) => !CONTROL_HEADS.has(s.head)).map(([t]) => t);
  // A control's own arguments can be built too (a `Labeled` entry); they must stand for
  // their expressions before the control reads its entries from them.
  const within = Array.from(root.querySelectorAll(rest.join(","))).filter(
    (el) => el.parentElement?.closest(controls.join(",")) != null,
  );
  for (const el of within.reverse()) adoptStructure(el);
  for (const el of root.querySelectorAll(controls.join(","))) adoptStructure(el);
  // Reverse document order: a descendant always follows its ancestor.
  const others = Array.from(root.querySelectorAll(rest.join(",")));
  for (const el of others.reverse()) adoptStructure(el);
}

let watching = false;

/** Watch the document for structurally written components as they arrive. */
export function watchStructures(): void {
  if (watching || typeof document === "undefined") return;
  watching = true;
  const scan = (): void => adoptStructures(document.body);
  new MutationObserver((records) => {
    if (records.some((r) => [...r.addedNodes].some((n) => n.nodeType === Node.ELEMENT_NODE))) {
      queueMicrotask(scan);
    }
  }).observe(document.body, { childList: true, subtree: true });
  queueMicrotask(scan);
}
