import type { ComputeEngine } from "@cortex-js/compute-engine";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { applyTemplates, captureTemplates, type Template } from "./bindings.ts";
import { controlsTemplate } from "./manipulate-ui.ts";
import { loadEngine, loadMarkup } from "./mathlive.ts";
import "./notatio-dynamic.ts";
import "./notatio-knob.ts";
import { openPlaybackMenu } from "./playback-menu.ts";
import { LONG_PRESS_MS } from "./choice-menu.ts";
import { ensureStyles } from "./styles.ts";
import {
  clamp,
  type Control,
  CONTROL_EVENT,
  type ControlChange,
  type Loop,
  parseControls,
  parseProse,
  type ProsePart,
} from "@enumeratio/notatio";
import { SliderPlayback } from "./sweep.ts";

/**
 * `<notatio-manipulate params="{a, 1, 5}">` -- a generic Wolfram-style
 * `Manipulate`: it renders a slider (or setter) per parameter and re-binds those
 * parameters into its slotted content live. Any descendant attribute that is a
 * **notatio** expression containing a **named wildcard** (`_a`) is treated as a
 * template: the wildcard is compute-engine's slot notation, filled from the
 * control `a` and re-evaluated on every change. So the same wrapper drives a
 * plot, a glyph, several elements at once, or plain markup:
 *
 * ```html
 * <notatio-manipulate params="{n, 1, 8, 1}">
 *   <notatio-plot value="Sin(_n * x)" />
 *   <notatio-figure kind="subset" value="[1]" n="_n" />
 * </notatio-manipulate>
 * ```
 *
 * A slot body is any notatio expression over the parameter wildcards (`_n * 20`),
 * evaluated through the engine. Every slider carries a play button (▶) that
 * animates it on a loop. Plots/surfaces also accept a `params` attribute directly
 * as a shorthand for the single-child case.
 *
 * A dragged slider applies immediately. Playback, on the other hand, advances
 * *continuously* — covering one step per interval, but moving through the values in
 * between rather than jumping between them, which is what makes a swept parameter look
 * smooth on a target that redraws in under a frame. A whole-number step (an order, a
 * count) stays on its grid regardless.
 *
 * `fps` shows a frame-rate readout, measured only while a slider is playing; an idle
 * Manipulate renders nothing and reports nothing. Controls sit above the content by
 * default (`controls="below"` to flip). `loop` says what playback does at the ends
 * -- `cycle` (the default, Manipulate's own), `reflect` or `none` -- and a long press
 * on any play button opens a panel for that and for the speed.
 *
 * **Prose mode.** Give it `prose` and the control panel is a *sentence* instead of a
 * strip of sliders -- Tangle's idea, with Manipulate's declaration. The string is
 * running text with holes: `{k}` names a parameter and becomes a draggable knob with
 * that parameter's range, anything else in braces (`{2 * _k + 1}`) becomes a readout,
 * and `$…$` is typeset. Options ride after a bar -- `{k | axis=y play}`,
 * `{N(_a) | digits=4}` -- so the range stays in `params` and the hole says only how
 * the value is shown.
 *
 * ```html
 * <notatio-manipulate
 *   params="{k, 1, 8, 1}; {a, 0, 2, 0.1}"
 *   prose="The curve $\sin(kx)$ with frequency {k}, scaled by {a}, crosses zero {2 * _k + 1} times.">
 *   <notatio-plot value="_a Sin(_k x)" />
 * </notatio-manipulate>
 * ```
 *
 * The knobs are ordinary `<notatio-knob>`s with every gesture that implies -- gears,
 * keyboard, typing, Space to play -- and the content below re-derives as they move.
 */
export class NotatioManipulate extends LitElement {
  static properties = {
    /** Control tuples: `{a, min, max}`, `{a, min, max, step}`, `{ {a, init}, min, max}` or a
     * discrete `{k, {1, 2, 3}}`; separate several with `;` or `,`. */
    params: { type: String },
    /** `below` puts the control panel under the content instead of above it. */
    controls: { type: String },
    /** A sentence to render as the control panel, with `{k}` holes for the parameters. */
    prose: { type: String },
    /** What playback does at the ends: `cycle` (default), `reflect` or `none`. */
    loop: { type: String, reflect: true },
    /** Show a frame-rate readout while a slider is playing. */
    fps: { type: Boolean },
    _controls: { state: true },
    _fps: { state: true },
  };

  declare params: string;
  /** Where the control panel sits: "above" (default) or "below" the content. */
  declare controls: string;
  declare prose: string;
  declare loop: Loop | "";
  declare fps: boolean;
  declare _controls: Control[];
  declare _fps: number;

  #host!: HTMLElement;
  #engine: ComputeEngine | undefined;
  #templates: Template[] = [];
  #captured = false;
  #playback = new SliderPlayback(
    {
      slider: (name) => {
        const c = this._controls.find((k) => k.name === name);
        return c?.kind === "slider" ? c : undefined;
      },
      set: (name, value) => this.#setControl(name, String(value)),
      loop: () => this.#loop,
      setLoop: (loop) => (this.loop = loop),
      interval: NotatioManipulate.PLAY_INTERVAL_MS,
      motion: "continuous",
      update: () => this.#onFrame(),
    },
    openPlaybackMenu,
    LONG_PRESS_MS,
  );
  #frames = 0;
  #fpsAt = 0;
  /** Typeset `$…$` islands of the prose, filled in as MathLive loads. */
  #tex = new Map<string, string>();

  constructor() {
    super();
    this.params = "";
    this.controls = "above";
    this.prose = "";
    this.loop = "";
    this.fps = false;
    this._controls = [];
    this._fps = 0;
    ensureStyles();
  }

  // Render the controls into a dedicated appended host so the slotted content
  // (the element's own light-DOM children) is left untouched.
  protected override createRenderRoot(): HTMLElement {
    this.#host = document.createElement("div");
    this.#host.className = "notatio-manip-host";
    // Controls lead, as in Wolfram's own Manipulate: they are what you reach for, and
    // a panel underneath a tall target can fall off the bottom of the screen entirely.
    // `controls="below"` puts them back after the content.
    if (this.controls === "below") this.append(this.#host);
    else this.prepend(this.#host);
    // A prose panel's knobs report the way a dynamic module's do.
    this.#host.addEventListener(CONTROL_EVENT, this.#onKnob as EventListener);
    return this.#host;
  }

  #onKnob = (event: CustomEvent<ControlChange>): void => {
    event.stopPropagation();
    this.#setControl(event.detail.name, String(event.detail.re));
  };

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("params")) this._controls = parseControls(this.params);
  }

  protected override firstUpdated(): void {
    // The engine is needed to parse the notatio slots; once captured, apply the
    // initial values (later control moves re-apply via `updated`). A prose panel's
    // readouts only exist once the controls have rendered, hence the wait.
    void this.updateComplete.then(() => this.#capture()).then(() => this.#apply());
  }

  // Record every descendant attribute (or custom-element string property) that is a
  // notatio expression carrying a named wildcard matching a control -- those are the
  // templates. The controls host and its subtree are skipped -- unless the panel is
  // prose, whose readouts are templates like any other.
  async #capture(more = false): Promise<void> {
    this.#captured = true;
    const engine = (this.#engine ??= await loadEngine());
    const names = new Set(this._controls.map((c) => c.name));
    const found = captureTemplates(this, names, engine, this.prose ? undefined : this.#host);
    // A template already applied no longer reads as one; keep it rather than lose it.
    const slot = (t: Template): string => ("attr" in t ? `@${t.attr}` : t.prop);
    const fresh = found.filter(
      (t) => !this.#templates.some((o) => o.el === t.el && slot(o) === slot(t)),
    );
    this.#templates = more ? [...this.#templates, ...fresh] : found;
  }

  // Fill each template's `_name` wildcards with the current control values and
  // write the re-serialized notatio back to the attribute/property.
  #apply(): void {
    const engine = this.#engine;
    if (!engine) return;
    applyTemplates(
      engine,
      this.#templates,
      new Map(this._controls.map((c) => [c.name, engine.number(c.value)])),
    );
  }

  /** Playback covers one step per this many milliseconds, whatever the frame rate. */
  static readonly PLAY_INTERVAL_MS = 120;

  /** Apply an input immediately — never interpolated; see `advanceValue`. */
  #setControl = (name: string, raw: string): void => {
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    this._controls = this._controls.map((c) => {
      if (c.name !== name) return c;
      return c.kind === "slider" ? { ...c, value: clamp(v, c.min, c.max) } : { ...c, value: v };
    });
  };

  get #loop(): Loop {
    return this.loop === "reflect" || this.loop === "none" ? this.loop : "cycle";
  }

  /** Once a frame while anything plays: the rate readout, then a render. */
  #onFrame(): void {
    if (this.fps) {
      const now = performance.now();
      if (this.#playback.playing.size === 0) {
        this._fps = 0; // nothing is moving; a stale rate would mislead
      } else {
        if (this.#frames === 0) this.#fpsAt = now;
        this.#frames++;
        if (now - this.#fpsAt > 400) {
          this._fps = Math.round((this.#frames * 1000) / (now - this.#fpsAt));
          this.#frames = 0;
        }
      }
    }
    this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#playback.stop();
  }

  /** The control paragraph of prose mode. */
  #proseTemplate(): unknown {
    const names = new Set(this._controls.map((c) => c.name));
    const parts = parseProse(this.prose, names);
    void this.#typesetIslands(parts);
    return html`<p class="notatio-manip-prose">${parts.map((part) => this.#part(part))}</p>`;
  }

  async #typesetIslands(parts: readonly ProsePart[]): Promise<void> {
    const missing = parts.filter((p) => p.kind === "tex" && !this.#tex.has(p.latex));
    if (missing.length === 0) return;
    const markup = await loadMarkup();
    for (const p of missing) if (p.kind === "tex") this.#tex.set(p.latex, markup(p.latex));
    this.requestUpdate();
  }

  #part(part: ProsePart): unknown {
    switch (part.kind) {
      case "text":
        return part.text;
      case "tex": {
        const markup = this.#tex.get(part.latex);
        return markup === undefined ? part.latex : unsafeHTML(markup);
      }
      case "dynamic":
        return html`<notatio-dynamic
          value=${part.value}
          digits=${ifDefined(part.options.digits)}
        ></notatio-dynamic>`;
      case "knob": {
        const c = this._controls.find((k) => k.name === part.name);
        if (c === undefined) return nothing;
        const o = part.options;
        // The knob's own attributes are plain numbers, so nothing here reads as a
        // template; the control's live value is pushed in as a property.
        return html`<notatio-knob
          name=${c.name}
          .value=${String(c.value)}
          min=${ifDefined(c.kind === "slider" ? c.min : undefined)}
          max=${ifDefined(c.kind === "slider" ? c.max : undefined)}
          step=${ifDefined(c.kind === "slider" ? c.step : undefined)}
          choices=${ifDefined(c.kind === "choice" ? c.choices.join("|") : undefined)}
          axis=${ifDefined(o.axis)}
          sensitivity=${ifDefined(o.sensitivity)}
          interval=${ifDefined(o.interval)}
          rate=${ifDefined(o.rate)}
          loop=${ifDefined(o.loop)}
          ?play=${"play" in o}
          ?autoplay=${"autoplay" in o}
        ></notatio-knob>`;
      }
      default:
        return nothing;
    }
  }

  protected override render(): unknown {
    if (this.prose) return this.#proseTemplate();
    return controlsTemplate(
      this._controls,
      this.#playback.playing,
      { set: this.#setControl, toggle: this.#playback.toggle, press: this.#playback.press },
      this.fps ? this._fps : undefined,
    );
  }

  // Re-apply after each render so animation frames reach the slotted content. Params
  // that arrive late (a structural Manipulate is lowered after it first renders) bring
  // their body with them, so its templates are captured then.
  protected override updated(changed: PropertyValues): void {
    if (changed.has("params") && this.#captured) {
      void this.#capture(true).then(() => this.#apply());
      return;
    }
    this.#apply();
  }
}

if (!customElements.get("notatio-manipulate")) {
  customElements.define("notatio-manipulate", NotatioManipulate);
}
