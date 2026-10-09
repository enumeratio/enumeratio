// The structural spelling of a built component, lowered in place: a `<notatio-plot>`
// whose children are `<notatio-sin>…</notatio-sin><notatio-tuple>x 0 10</notatio-tuple>`
// is `Plot(Sin(x), (x, 0, 10))`, and the same table `renderingOf` uses to turn that
// expression into attributes (`symbols.ts`, in the base) turns these children into
// them here. A framework that emits the structural tree -- `<Notatio>` in Vue or React,
// or a hand-written `<Plot><Sin>…` -- needs to know nothing about the lowering: the
// element does it (https://github.com/enumeratio/enumeratio/wiki/Vdom).
//
// Options arrive as attributes already (`plot-range="All"`); the ones a component
// spells differently (`PlotLabel` is the plot's `label`) are mapped the same way.

import { isClaimed } from "./lazy.ts";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { closeDollar } from "@enumeratio/boxes/render";
import { withOptions } from "@enumeratio/formats";
import { parseExpression } from "@enumeratio/formats/expression";
import { tokenize } from "@enumeratio/formats/markup";
import {
  CONTROL_HEADS,
  debug,
  DRAWING_SYMBOLS,
  leafOf,
  lowerOptions,
  markupOf,
  optionAttribute,
  renderingOf,
  slottedExceptDeclarations,
  type VisualSymbol,
} from "@enumeratio/frontend";
import { controlSelector } from "./define.ts";
import { defineUsed, isExpressive } from "./generic.ts";

const BY_TAG = new Map<string, VisualSymbol>();
for (const s of DRAWING_SYMBOLS) if (!BY_TAG.has(s.tag) && s.fixed === undefined) BY_TAG.set(s.tag, s);
for (const s of DRAWING_SYMBOLS) if (!BY_TAG.has(s.tag)) BY_TAG.set(s.tag, s);

const ADOPTED = new WeakSet<Element>();
const log = debug("structure");

/**
 * A body's loose text apart into prose and `$…$` islands, whitespace-only text dropped. An
 * expression in a body is an element or an island; a bare word between controls ("Choose a
 * value:") is prose, as it is on a page where only markup is read as an expression. An island
 * is what record prose and the site's markdown read (`closeDollar`): no space just inside
 * either `$`, no digit after the closer, and `\$` a dollar sign, so "costs $5 and $10" is prose.
 */
export function proseRuns(text: string): { island: boolean; text: string }[] {
  if (!text.trim()) return [];
  const runs: { island: boolean; text: string }[] = [];
  let at = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] !== "$") continue;
    const end = closeDollar(text, i);
    if (end < 0) continue;
    if (i > at) runs.push({ island: false, text: text.slice(at, i) });
    runs.push({ island: true, text: text.slice(i, end + 1) });
    at = end + 1;
    i = end;
  }
  if (at < text.length) runs.push({ island: false, text: text.slice(at) });
  return runs;
}

/**
 * The author's text runs among `el`'s children. A head whose body is prose (`prose` on its
 * symbol: a dynamic module, a Manipulate) keeps its prose and lowers each `$…$` island to the
 * `<dynamic-box>` that shows its value. Any other head's text is its atoms as leaf elements
 * (`<notatio-plot>x <notatio-tuple>…` holds the symbol `x`), so what follows reads every
 * argument as an element. Only the text before the first comment: Lit renders a light-DOM
 * component's own output after its marker.
 */
function leavesForText(el: Element, prose: boolean): void {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.COMMENT_NODE) return;
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
    if (prose) {
      const runs = proseRuns(node.textContent);
      if (!runs.some((r) => r.island)) continue;
      node.replaceWith(
        ...runs.map((r) => {
          if (!r.island) return document.createTextNode(r.text);
          const box = document.createElement("dynamic-box");
          box.setAttribute("value", r.text);
          return box;
        }),
      );
      continue;
    }
    const errors: string[] = [];
    const atoms = tokenize(node.textContent, errors);
    if (errors.length) log("text isn't atoms (Epsil goes in value):", node.textContent, errors);
    const leaves = atoms.flatMap((a) => {
      const leaf = leafOf(a as MathJsonExpression);
      if (leaf === undefined) return [];
      const e = document.createElement(leaf.tag);
      for (const [k, v] of Object.entries(leaf.attributes)) e.setAttribute(k, v);
      return [e];
    });
    node.replaceWith(...leaves);
  }
}

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
    const { json, errors } = parseExpression(raw === "true" ? "True" : raw);
    if (!errors.length) options[name] = json as MathJsonExpression;
  }
  return options;
}

const SCOPES = "dynamic-module-box, notatio-manipulate";

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
  leavesForText(el, symbol.prose === true);
  // A hand-written element in it whose module is still loading (`lazy.ts`) is waited for:
  // its class reads the arguments.
  const pending = [el, ...el.querySelectorAll("*")]
    .map((e) => e.localName)
    .filter((tag, i, all) => all.indexOf(tag) === i && isClaimed(tag) && customElements.get(tag) === undefined);
  if (pending.length > 0) {
    void Promise.all(pending.map((tag) => customElements.whenDefined(tag))).then(() => adoptStructure(el));
    return;
  }
  // The children may not have been defined or upgraded yet, and their expressions live
  // on the instances.
  defineUsed(el);
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
    for (const [attr, value] of Object.entries(symbol.attributes(args))) {
      if (!el.getAttribute(attr)) el.setAttribute(attr, value);
    }
  }
  for (const [attr, value] of Object.entries(lowerOptions(symbol, options).attributes)) {
    if (el.getAttribute(attr) !== value) el.setAttribute(attr, value);
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
    el.insertAdjacentHTML("beforeend", shown.map((r) => markupOf(r)).join(""));
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
  // A selector for none of them when there are none.
  const any = (list: readonly string[]): string => (list.length > 0 ? list.join(",") : ":not(*)");
  const within = Array.from(root.querySelectorAll(any(rest))).filter(
    (el) => el.parentElement?.closest(any(controls)) != null,
  );
  for (const el of within.toReversed()) adoptStructure(el);
  for (const el of root.querySelectorAll(any(controls))) adoptStructure(el);
  // Reverse document order: a descendant always follows its ancestor.
  const others = Array.from(root.querySelectorAll(any(rest)));
  for (const el of others.toReversed()) adoptStructure(el);
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
