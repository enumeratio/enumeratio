// Every symbol as an element (design/vdom.md). For each head the engine knows that has
// no hand-written component, a generic `notatio-<head>` is registered here. It stands
// for the expression `Head(args)`:
//
//   - `value` is the text the head's constructor takes -- the whole expression as
//     notatio, or for an atom (`Integer`, `Real`, `String`, `Symbol`) its literal --
//     which is what a framework or a scope writes into it;
//   - otherwise its ARGUMENTS ARE ITS CHILDREN: each child element contributes its own
//     `expression`, and a run of text is a notatio argument list, so
//     `<notatio-binomial>n, 2</notatio-binomial>` and
//     `<notatio-binomial><notatio-symbol value="n" /><notatio-integer value="2" /></notatio-binomial>`
//     are the same thing -- or, for a head of fixed arity whose parameters the reference
//     names, the arguments are ATTRIBUTES: `<notatio-binomial n="5" k="2">`;
//   - every other attribute is an OPTION, Wolfram's way: `<notatio-plot plot-range="All">`
//     is `Plot(…, PlotRange -> All)`, the name un-kebab-cased.
//
// Only the OUTERMOST generic element typesets, through `<notatio-out>`; the ones inside
// it are structure -- they exist so the tree is addressable, not so each draws. Inside
// a scope the outermost's `value` is a template like any other attribute, which is how
// `<notatio-binomial>_n, 2</notatio-binomial>` follows a knob.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { optionsOf, withOptions } from "@enumeratio/formats";
import { parseNotatio, serializeNotatio } from "@enumeratio/formats/notatio";
import { HEADS, PARAMS, tagOf } from "@enumeratio/notatio";
import { html, LitElement, nothing } from "lit";
import "./notatio-out.ts";
import { ensureStyles } from "./styles.ts";

/** The leaf tags: their text is a literal, not an argument list. */
const ATOMS: Record<string, (text: string) => MathJsonExpression> = {
  Integer: (t) => Number(t.replace(/_/g, "")),
  Real: (t) => Number(t.replace(/_/g, "")),
  Rational: (t) => {
    const [p, q] = t.split("/").map((s) => Number(s.trim()));
    return ["Rational", p, q ?? 1] as MathJsonExpression;
  },
  Complex: (t) => {
    const m = /^\s*([+-]?[\d.]+)?\s*([+-]\s*[\d.]*)?\s*i?\s*$/.exec(t);
    const re = Number(m?.[1] ?? 0);
    const im = m?.[2] === undefined ? 0 : Number(m[2].replace(/\s/g, "") || "1");
    return ["Complex", re, im] as MathJsonExpression;
  },
  String: (t) => ({ str: t }) as MathJsonExpression,
  Symbol: (t) => t.trim(),
};

/** Attributes that are the element's own, never an option. */
const OWN = new Set(["value", "evaluate", "class", "style", "id", "slot", "hidden", "title", "role", "tabindex"]);

/** `plot-range` -> `PlotRange`: an attribute's option name. */
export const optionNameOf = (attr: string): string =>
  attr
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");

/** What every element in a structural tree offers: the expression it stands for. */
export interface Expressive extends HTMLElement {
  readonly expression: MathJsonExpression | undefined;
}

export const isExpressive = (el: Element): el is Expressive => "expression" in el;

/**
 * The generic element behind a head. One class per head is made by `defineGeneric`;
 * this is what they share.
 */
export class NotatioGeneric extends LitElement {
  /** The head this element stands for; set per subclass. */
  static head = "";

  static properties = {
    /**
     * The expression as text -- the whole `Head(args)` as notatio, or an atom's literal.
     * Set, it wins over the children; inside a scope it is a template.
     */
    value: { type: String },
    /** Evaluate before typesetting, rather than showing the expression as written. */
    evaluate: { type: Boolean },
    _root: { state: true },
  };

  declare value: string;
  declare evaluate: boolean;
  declare _root: boolean;

  #observer: MutationObserver | undefined;
  /**
   * The outermost element's original children, moved into a hidden holder so the
   * arguments stay readable (and watched) while only the typeset result shows.
   */
  #args: HTMLElement | undefined;

  constructor() {
    super();
    this.value = "";
    this.evaluate = false;
    this._root = false;
    ensureStyles();
  }

  get head(): string {
    return (this.constructor as typeof NotatioGeneric).head;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The outermost generic element draws; one inside another is structure.
    this._root = this.parentElement?.closest("[data-notatio-generic]") === null;
    this.setAttribute("data-notatio-generic", "");
    if (this._root && this.#args === undefined) {
      const holder = document.createElement("span");
      holder.className = "notatio-generic-args";
      holder.hidden = true;
      // The author's nodes only: an element re-rooted by a move (a layout unwrapping
      // its list) already holds Lit's markers and its own typeset output.
      const own = [...this.childNodes].filter(
        (n) =>
          n.nodeType !== Node.COMMENT_NODE && !(n instanceof Element && n.classList.contains("notatio-generic-out")),
      );
      holder.append(...own);
      this.prepend(holder);
      this.#args = holder;
      this.#derive();
      this.#observer = new MutationObserver(() => {
        this.#derive();
        this.requestUpdate();
      });
      this.#observer.observe(holder, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
      // An option or a named argument is an attribute on the element itself.
      this.#observer.observe(this, { attributes: true });
    }
  }

  override disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#observer = undefined;
    super.disconnectedCallback();
  }

  /** Did we write `value` ourselves, from the children? Then the children still lead. */
  #derived = false;

  /**
   * Publish the children's expression as `value`, so a scope sees it as a template
   * (a scope reads attributes and string properties, not text) and can write the bound
   * result back. An author's own `value` is left alone.
   */
  #derive(): void {
    if (this.value.trim() && !this.#derived) return;
    const fromChildren = this.#fromChildren();
    if (fromChildren === undefined) return;
    const text = ATOMS[this.head] ? this.#ownText() : serializeNotatio(fromChildren);
    if (text !== this.value) {
      this.#derived = true;
      this.value = text;
    }
  }

  /** The head over its arguments -- named attributes, else children -- with the options. */
  #fromChildren(): MathJsonExpression | undefined {
    const atom = ATOMS[this.head];
    if (atom) {
      const text = this.#ownText();
      return text ? atom(text) : undefined;
    }
    const named = this.#namedArguments();
    const args = named ?? this.#arguments();
    return withOptions(this.head, args, this.#options());
  }

  /** The arguments spelled as attributes, when this head's parameters are named and given. */
  #namedArguments(): MathJsonExpression[] | undefined {
    const params = PARAMS[this.head];
    if (params === undefined || !params.some((p) => this.hasAttribute(p.toLowerCase()))) return undefined;
    const args: MathJsonExpression[] = [];
    for (const p of params) {
      const raw = this.getAttribute(p.toLowerCase());
      if (raw === null) break;
      const { json, errors } = parseNotatio(raw);
      if (errors.length) break;
      args.push(json as MathJsonExpression);
    }
    return args;
  }

  /** Every attribute that is neither the element's own nor a named argument: an option. */
  #options(): Record<string, MathJsonExpression> {
    const params = new Set((PARAMS[this.head] ?? []).map((p) => p.toLowerCase()));
    const options: Record<string, MathJsonExpression> = {};
    for (const { name, value } of this.attributes) {
      if (OWN.has(name) || params.has(name) || name.startsWith("data-") || name.startsWith("aria-")) continue;
      const { json, errors } = parseNotatio(value === "" || value === "true" ? "True" : value);
      if (!errors.length) options[optionNameOf(name)] = json as MathJsonExpression;
    }
    return options;
  }

  /** The expression this element stands for: `value` if set, else the head over its children. */
  get expression(): MathJsonExpression | undefined {
    const head = this.head;
    const text = this.value.trim();
    // A derived `value` is a publication of the children, and can lag them (a child
    // adopted after it was written); the children themselves are current.
    if (text && !this.#derived) {
      const atom = ATOMS[head];
      if (atom) return atom(text);
      const { json, errors } = parseNotatio(text);
      return errors.length ? undefined : (json as MathJsonExpression);
    }
    return this.#fromChildren();
  }

  /** The positional arguments and the options, apart. */
  get split(): {
    ops: readonly MathJsonExpression[];
    options: Readonly<Record<string, MathJsonExpression>>;
  } {
    const e = this.expression;
    return e === undefined ? { ops: [], options: {} } : optionsOf(e);
  }

  /** The nodes that are the arguments: the holder's, once moved; else the element's own. */
  get #nodes(): NodeListOf<ChildNode> {
    return (this.#args ?? this).childNodes;
  }

  /** The text the element holds itself, not counting what it rendered. */
  #ownText(): string {
    return [...this.#nodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? "")
      .join("")
      .trim();
  }

  /** The arguments: element children's expressions, and text runs as notatio lists. */
  #arguments(): MathJsonExpression[] {
    const args: MathJsonExpression[] = [];
    for (const node of this.#nodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent ?? "").trim();
        if (!text) continue;
        const { json, errors } = parseNotatio(`(${text})`);
        if (errors.length) continue;
        const fn = (json as { fn?: unknown[] }).fn;
        if (Array.isArray(fn) && fn[0] === "Tuple") args.push(...(fn.slice(1) as MathJsonExpression[]));
        else args.push(json as MathJsonExpression);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (isExpressive(el)) {
          const e = el.expression;
          if (e !== undefined) args.push(e);
        }
      }
    }
    return args;
  }

  protected override render(): unknown {
    if (!this._root) return nothing;
    const expr = this.expression;
    if (expr === undefined) return nothing;
    return html`<notatio-out
      class="notatio-generic-out"
      format="mathjson"
      value=${JSON.stringify(expr)}
      ?evaluate=${this.evaluate}
    ></notatio-out>`;
  }
}

/** Register a generic element for `head` at its tag, unless something already owns the tag. */
export function defineGeneric(head: string): boolean {
  const tag = tagOf(head);
  if (customElements.get(tag)) return false;
  const cls = class extends NotatioGeneric {
    static override head = head;
  };
  customElements.define(tag, cls);
  return true;
}

/** Register every head that has no hand-written element. Idempotent. */
export function defineGenerics(heads: readonly string[] = HEADS): number {
  let n = 0;
  for (const head of heads) if (defineGeneric(head)) n++;
  return n;
}

/** The expression a whole subtree of elements stands for, from its outermost generic. */
export const expressionOf = (el: Element): MathJsonExpression | undefined =>
  isExpressive(el) ? el.expression : undefined;
