import {
  fillTex,
  parseProse,
  plainJson,
  pointWords,
  type ProsePart,
  randomValue,
  type VariableSpec,
} from "@enumeratio/frontend/core";
import katex from "katex";
import { html, LitElement, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import "./notatio-knob.ts";
import "./notatio-stepper.ts";
import "./notatio-toggler.ts";
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

/** A setter hole, Wolfram's `Setter(_e, value, "label")`: a link that sets the variable to the value. */
const SETTER = /^Setter\(\s*_([A-Za-z]\w*)\s*,\s*(.+?)\s*,\s*"([^"]*)"\s*\)$/s;

/** `{InputField(Variables)}`: the scope's variables as one editable, copyable sentence. */
const SETTINGS = /^InputField\(\s*Variables\s*\)$/;

/** A setter's value as MathJSON: a quoted string, a number, or a name. */
function setterValue(text: string): Json {
  const quoted = /^"(.*)"$/s.exec(text);
  if (quoted) return `'${quoted[1]}'`;
  const n = Number(text);
  return Number.isFinite(n) ? n : text;
}

/** A toggler entry for a choice: `value -> label`, the value as Epsil spells it. */
const entryOf = (value: Json, label: string): string =>
  `${typeof value === "string" ? value.replace(/^'(.*)'$/s, '"$1"') : JSON.stringify(value)} -> ${label}`;

/**
 * `<notatio-string-template>Primes of $\mathbb{Q}(\sqrt{_d})$, d = {_d}, lighting the {_h} of the
 * selection.</notatio-string-template>` -- Wolfram's `StringTemplate`, with Epsil holes: prose
 * whose holes are the variables of the scope it sits in (the nearest element declaring
 * `Variables`, else the page).
 *
 * - `{_d}` is the variable's own control, chosen by its declared domain: a stepper for integers,
 *   a knob for reals, a word that cycles for choices or booleans. `{_d | stepper}`,
 *   `{_d | knob}` or `{_d | toggler}` picks another.
 * - Any other hole, `{N(_d^2)}`, is a readout, refilled as the variables move.
 * - In a `$…$` island, `_d` or `_{name}` standing alone (`\sqrt{_d}`) is the variable's value.
 * - `{Setter(_e, "twindragon", "the twindragon")}` (Wolfram's `Setter`) is a link that sets `_e`.
 * - `{InputField(Variables)}` (Wolfram's `InputField`) holds every declared variable as one
 *   sentence of Epsil, to copy and keep, or to paste back and load.
 */
export class NotatioStringTemplate extends LitElement {
  static properties = {
    /** The template; when absent, the element's text when it connects. */
    template: { type: String },
    _tick: { state: true },
  };

  declare template: string;
  declare _tick: number;

  #scope: Scope | undefined;
  #unsubscribe: (() => void) | undefined;
  #tex = new Map<string, string>();

  constructor() {
    super();
    this.template = "";
    this._tick = 0;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    // Authored as text: take it as the template before rendering replaces it.
    if (!this.template && this.textContent?.trim()) {
      this.template = this.textContent.trim().replace(/\s+/g, " ");
      this.replaceChildren();
    }
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

  /** A ring the declarations name, or the value of the variable that holds it (`_r`). */
  #ringOf = (ring: Json): Json =>
    typeof ring === "string" && ring.startsWith("_") ? this.#scope?.values.get(ring.slice(1)) : ring;

  #spec(name: string): VariableSpec | undefined {
    return this.#scope?.declarations.find((s) => s.name === name);
  }

  #texOf(latex: string): unknown {
    const values = new Map<string, string>();
    for (const [name, value] of this.#scope?.values ?? [])
      values.set(name, texOf(this.#spec(name), value, this.#ringOf));
    const filled = fillTex(latex, values);
    let markup = this.#tex.get(filled);
    if (markup === undefined) {
      markup = katex.renderToString(filled, { throwOnError: false });
      this.#tex.set(filled, markup);
    }
    return unsafeHTML(markup);
  }

  /** A die beside a control: a random value of the variable's domain. */
  #die(name: string): unknown {
    const spec = this.#spec(name);
    if (!spec || spec.domain.kind === "integers") return nothing;
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
    // `{_d | random}`: the variable's control with a die beside it.
    if ("random" in options && !("stepper" in options)) {
      const { random: _, ...rest } = options;
      return html`${this.#control(name, rest)}${this.#die(name)}`;
    }
    const spec = this.#spec(name);
    const value = this.#scope?.values.get(name);
    const domain = spec?.domain;
    const kind =
      "stepper" in options || "knob" in options || "toggler" in options
        ? Object.keys(options).find((k) => k === "stepper" || k === "knob" || k === "toggler")
        : domain?.kind === "integers"
          ? "stepper"
          : domain?.kind === "reals"
            ? "knob"
            : domain?.kind === "choices" || domain?.kind === "booleans"
              ? "toggler"
              : undefined;
    switch (kind) {
      case "stepper":
        return html`<notatio-stepper
          name=${name}
          .value=${Number(value ?? 0)}
          .domain=${domain?.kind === "integers" ? domain : undefined}
          ?random=${"random" in options || domain?.kind === "integers"}
        ></notatio-stepper>`;
      case "knob":
        return html`<notatio-knob
          name=${name}
          .value=${typeof value === "number" ? String(value) : "0"}
          min=${domain?.kind === "reals" ? domain.min : 0}
          max=${domain?.kind === "reals" ? domain.max : 1}
          step=${domain?.kind === "reals" ? domain.step : 0.01}
        ></notatio-knob>`;
      case "toggler": {
        const values =
          domain?.kind === "choices" ? domain.values.map((v, k) => entryOf(v, domain.labels[k]!)).join("|") : undefined;
        return html`<notatio-toggler
          name=${name}
          values=${values ?? nothing}
          .value=${wordsOf(spec, value)}
        ></notatio-toggler>`;
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
    const rules = scope.declarations.map((d) => ["KeyValuePair", `_${d.name}`, scope.values.get(d.name) ?? "Nothing"]);
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

  #part(part: ProsePart): unknown {
    switch (part.kind) {
      case "text":
        return part.text;
      case "tex":
        return this.#texOf(part.latex);
      case "knob":
        return this.#control(part.name.replace(/^_/, ""), part.options);
      case "dynamic": {
        if (SETTINGS.test(part.value.trim())) return this.#settings();
        const setter = SETTER.exec(part.value.trim());
        if (setter) {
          const [, name, value, label] = setter;
          return html`<a
            href="#"
            class="notatio-setter"
            @click=${(e: Event) => {
              e.preventDefault();
              this.#scope?.set(name!, setterValue(value!) as never);
            }}
            >${label}</a
          >`;
        }
        return html`<notatio-dynamic value=${part.value}></notatio-dynamic>`;
      }
    }
    return nothing;
  }

  protected override render(): unknown {
    const names = new Set((this.#scope?.declarations ?? []).map((s) => `_${s.name}`));
    return html`${parseProse(this.template, names).map((p) => this.#part(p))}`;
  }
}

if (!customElements.get("notatio-string-template"))
  customElements.define("notatio-string-template", NotatioStringTemplate);
