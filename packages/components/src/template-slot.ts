import { typeset } from "@enumeratio/formats/typeset";
import { plainJson, pointWords, randomValue, type VariableSpec } from "@enumeratio/frontend/core";
import { html, LitElement, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import "./knob-box.ts";
import "./slider-2d-box.ts";
import "./stepper-box.ts";
import "./toggler-box.ts";
import { type Scope, scopeOf } from "./scope.ts";
import { ensureStyles } from "./styles.ts";

type Json = unknown;

/** A value as the words a sentence shows: a choice's label, a ring's point, a number, a name. */
function wordsOf(spec: VariableSpec | undefined, value: Json, ringOf: (ring: Json) => Json = (r) => r): string {
  if (spec?.domain.kind === "points") {
    const ring = ringOf(spec.domain.ring);
    const points = Array.isArray(value) && value[0] === "List" ? value.slice(1) : [value];
    return points.map((p) => pointWords(ring, p)).join(", ");
  }
  if (spec?.domain.kind === "choices") {
    const k = spec.domain.values.findIndex((v) => JSON.stringify(v) === JSON.stringify(value));
    if (k >= 0) return spec.domain.labels[k]!;
  }
  if (typeof value === "number") return value < 0 ? `−${-value}` : String(value);
  if (typeof value === "string") return value.replace(/^'(.*)'$/s, "$1");
  return JSON.stringify(value);
}

/** A value as TeX, for a hole in a `$…$` island: a number or a ring's point as math, the rest as text. */
function texOf(spec: VariableSpec | undefined, value: Json, ringOf: (ring: Json) => Json): string {
  if (typeof value === "number") return String(value);
  const words = wordsOf(spec, value, ringOf);
  return spec?.domain.kind === "points" ? words.replace(/−/g, "-").replace(/ω/g, "\\omega ") : `\\text{${words}}`;
}

/** `{InputField(Variables)}`'s hole: the scope's variables as one editable, copyable sentence. */
const SETTINGS = "Variables";

/** Points of the complex plane: a 2D pad binds them, as a number. */
const isPlane = (domain: VariableSpec["domain"]): domain is Extract<VariableSpec["domain"], { kind: "points" }> =>
  domain.kind === "points" && domain.ring === "ComplexNumbers";

/** A bare name: MathJSON for a symbol (a quoted `'a'` is a string, a number is not a name). */
const isSymbolName = (v: Json): boolean => typeof v === "string" && /^[A-Za-z_]\w*$/.test(v);

/** A toggler entry for a choice: `value -> label`, the value as Epsil spells it. */
const entryOf = (value: Json, label: string): string =>
  `${typeof value === "string" ? value.replace(/^'(.*)'$/s, '"$1"') : JSON.stringify(value)} -> ${label}`;

/** A fragment of an island's TeX, or the variable standing in it. */
type TexPart = string | { readonly slot: string };

/** The attributes that are no option of the hole. */
const NOT_OPTIONS = new Set(["name", "parts", "class", "style", "id"]);

/**
 * A hole in prose that the page's scope fills (`TemplateSlot` in a `TextData`, the text of a
 * `StringTemplate`): the variables of the scope it sits in, the nearest element declaring
 * `Variables`, else the page.
 *
 * - `<template-slot name="d">` is the variable's own control, chosen by its declared domain: a
 *   stepper for integers, a knob for reals, a word that cycles for choices or booleans. The
 *   options `stepper`, `knob` or `toggler` pick another, and `random` puts a die beside it. A
 *   name no declaration gives is a readout of the variable.
 * - `<template-slot parts="…">` is a `$…$` island with variables in it (`\sqrt{_d}`): the
 *   fragments in order, each variable standing for its value, typeset as it moves.
 * - `<template-slot name="Variables">` holds every declared variable as one sentence of Epsil,
 *   to copy and keep, or to paste back and load.
 */
export class TemplateSlot extends LitElement {
  static properties = {
    /** The variable (without its `_`). */
    name: { type: String },
    /** The TeX of an island as JSON: strings, and `{"slot": name}` for each variable. */
    parts: { type: String },
    _tick: { state: true },
  };

  declare name: string;
  declare parts: string;
  declare _tick: number;

  #scope: Scope | undefined;
  #unsubscribe: (() => void) | undefined;
  #tex = new Map<string, string>();

  constructor() {
    super();
    this.name = "";
    this.parts = "";
    this._tick = 0;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#scope = scopeOf(this);
    this.#unsubscribe = this.#scope?.subscribe(() => this._tick++);
    void this.#scope?.refresh().then(() => this._tick++);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }

  /** The hole's options: its other attributes, `random` and the like. */
  get #options(): Readonly<Record<string, string>> {
    return Object.fromEntries(
      this.getAttributeNames()
        .filter((n) => !NOT_OPTIONS.has(n) && !n.startsWith("data-"))
        .map((n) => [n, this.getAttribute(n) ?? ""]),
    );
  }

  /** A ring the declarations name, or the value of the variable that holds it (`_r`). */
  #ringOf = (ring: Json): Json =>
    typeof ring === "string" && ring.startsWith("_") ? this.#scope?.values.get(ring.slice(1)) : ring;

  #spec(name: string): VariableSpec | undefined {
    return this.#scope?.declarations.find((s) => s.name === name);
  }

  /** An island with each variable filled: a variable no scope holds is left as written. */
  #islandOf(parts: readonly TexPart[]): unknown {
    const latex = parts
      .map((part) => {
        if (typeof part === "string") return part;
        const value = this.#scope?.values.get(part.slot);
        if (value === undefined) return part.slot.length === 1 ? `_${part.slot}` : `_{${part.slot}}`;
        return `{${texOf(this.#spec(part.slot), value, this.#ringOf)}}`;
      })
      .join("");
    let markup = this.#tex.get(latex);
    if (markup === undefined) {
      markup = typeset(latex);
      this.#tex.set(latex, markup);
    }
    return unsafeHTML(markup);
  }

  /** A die beside a control: a random value of the variable's domain. */
  #die(name: string): unknown {
    const spec = this.#spec(name);
    if (!spec || spec.domain.kind === "integers" || isPlane(spec.domain)) return nothing;
    return html`<button
      type="button"
      class="notatio-die"
      aria-label=${`A random ${name}`}
      data-tip="A random one"
      @click=${() => {
        const value = randomValue(spec, this.#scope?.values.get(name));
        if (value !== undefined) this.#scope?.set(name, value as never);
      }}
    >
      ⚄
    </button>`;
  }

  #control(name: string, options: Readonly<Record<string, string>>): unknown {
    // `random`: the variable's control with a die beside it.
    if ("random" in options && !("stepper" in options)) {
      const { random: _, ...rest } = options;
      return html`${this.#control(name, rest)}${this.#die(name)}`;
    }
    const spec = this.#spec(name);
    // A name no declaration gives is read, not set.
    if (spec === undefined) return html`<dynamic-box value=${`_${name}`}></dynamic-box>`;
    const value = this.#scope?.values.get(name);
    const domain = spec.domain;
    // The complex plane: a pad, the variable's real and imaginary parts its two axes.
    if (isPlane(domain)) {
      const [lo, hi] = [domain.min ?? -2, domain.max ?? 2];
      const z =
        typeof value === "number"
          ? [value, 0]
          : Array.isArray(value) && value[0] === "Complex"
            ? value.slice(1)
            : [0, 0];
      return html`<slider-2d-box
        name=${name}
        complex
        .value=${`${z[0]},${z[1]}`}
        min=${`${lo},${lo}`}
        max=${`${hi},${hi}`}
        step="0.05"
        size="56"
      ></slider-2d-box>`;
    }
    const kind =
      "stepper" in options || "knob" in options || "toggler" in options
        ? Object.keys(options).find((k) => k === "stepper" || k === "knob" || k === "toggler")
        : domain.kind === "integers"
          ? "stepper"
          : domain.kind === "reals"
            ? "knob"
            : domain.kind === "choices" || domain.kind === "booleans"
              ? "toggler"
              : undefined;
    switch (kind) {
      case "stepper":
        return html`<stepper-box
          name=${name}
          .value=${Number(value ?? 0)}
          .domain=${domain.kind === "integers" ? domain : undefined}
          ?random=${"random" in options || domain.kind === "integers"}
        ></stepper-box>`;
      case "knob":
        return html`<knob-box
          name=${name}
          .value=${typeof value === "number" ? String(value) : "0"}
          min=${domain.kind === "reals" ? domain.min : 0}
          max=${domain.kind === "reals" ? domain.max : 1}
          step=${domain.kind === "reals" ? domain.step : 0.01}
        ></knob-box>`;
      case "toggler": {
        const values =
          domain.kind === "choices" ? domain.values.map((v, k) => entryOf(v, domain.labels[k]!)).join("|") : undefined;
        // A choice over bare names binds the symbol, not its place in the list.
        const symbols = domain.kind === "choices" && domain.values.every((v) => isSymbolName(v));
        return html`<toggler-box
          name=${name}
          ?symbols=${symbols}
          values=${values ?? nothing}
          .value=${wordsOf(spec, value)}
        ></toggler-box>`;
      }
    }
    return wordsOf(spec, value, this.#ringOf);
  }

  #settingsText = "";

  /** The declared variables as Epsil, `[_r -> GaussianIntegers, _b -> (-1, 1), …]`. */
  async #settingsOf(): Promise<string> {
    const { serializeExpression } = await import("@enumeratio/formats/expression");
    const scope = this.#scope;
    if (!scope) return "";
    const rules = scope.declarations.map((d) => ["Rule", `_${d.name}`, scope.values.get(d.name) ?? "Nothing"]);
    return serializeExpression(["List", ...rules] as never)
      .replace(/\s+/g, " ")
      .replace(/\[ /g, "[")
      .replace(/,? \]/g, "]");
  }

  /** Set every variable a pasted sentence names; a sentence that doesn't read changes nothing. */
  async #applySettings(text: string): Promise<void> {
    const { parseExpression } = await import("@enumeratio/formats/expression");
    const { json, errors } = parseExpression(text);
    if (errors.length > 0) return;
    const plain = plainJson(json) as unknown[];
    const rules = Array.isArray(plain) && plain[0] === "List" ? plain.slice(1) : [];
    const entries: [string, unknown][] = [];
    for (const rule of rules) {
      if (!Array.isArray(rule) || rule.length !== 3 || typeof rule[1] !== "string" || !rule[1].startsWith("_"))
        continue;
      entries.push([rule[1].slice(1), rule[2]]);
    }
    if (entries.length > 0) this.#scope?.setMany(entries as never);
  }

  #settings(): unknown {
    void this.#settingsOf().then((text) => {
      if (text !== this.#settingsText) {
        this.#settingsText = text;
        this.requestUpdate();
      }
    });
    return html`<span class="notatio-settings">
      <input
        type="text"
        spellcheck="false"
        aria-label="Settings"
        .value=${this.#settingsText}
        @change=${(e: Event) => void this.#applySettings((e.target as HTMLInputElement).value)}
      /><button
        type="button"
        data-tip="Copy these settings"
        aria-label="Copy these settings"
        @click=${() => void navigator.clipboard?.writeText(this.#settingsText)}
      >
        ⧉
      </button>
    </span>`;
  }

  protected override render(): unknown {
    if (this.parts) {
      try {
        return this.#islandOf(JSON.parse(this.parts) as TexPart[]);
      } catch {
        return nothing;
      }
    }
    if (this.name === SETTINGS) return this.#settings();
    return this.#control(this.name, this.#options);
  }
}

if (!customElements.get("template-slot")) customElements.define("template-slot", TemplateSlot);
