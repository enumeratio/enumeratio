import { POLYTOPES, type Polytope } from "@enumeratio/polytope";
import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { Orbit, ORBIT_HINT } from "./orbit.ts";
import {
  parseFaces,
  parseLabelForm,
  parseLabelWhich,
  polytope3dSvg,
  spellFaces,
  toggleFace,
} from "./polytope3d.ts";
import { ensureStyles } from "./styles.ts";

/**
 * `<notatio-polytope which="permutahedron" n="4">` -- a polytope's face poset, drawn,
 * draggable and clickable.
 *
 * Every mark on the picture IS a face: clicking a polygon selects a 2-face, a line a 1-face, a
 * dot a 0-face. Selection follows face identity rather than screen position, which is what
 * makes it survive two faces landing on the same pixels -- the SVG generator writes each face's
 * own data into `data-face`, so the handler never has to consult geometry to know what was hit.
 *
 * Clicking REPLACES the selection and shift-clicking extends it, which is the convention
 * everywhere else a list can be selected from. `recentre` brings the selection to the middle of
 * the figure and `reorient` turns it to face the viewer.
 *
 * The picture is a pure function of the attributes, so it renders identically under SSR. The
 * live parts -- the drag and the click -- both work by writing attributes back.
 */
export class NotatioPolytope extends LitElement {
  static properties = {
    which: { type: String },
    n: { type: Number },
    // Reflected: a click writes the selection back to the attribute, so what is selected is
    // visible in the markup and can be read by anything watching the element.
    selected: { type: String, reflect: true },
    dimension: { type: Number },
    labels: { type: String },
    labelForm: { type: String, attribute: "label-form" },
    recentre: { type: String },
    reorient: { type: String },
    shade: { type: String },
    azimuth: { type: Number },
    elevation: { type: Number },
    zoom: { type: Number },
    label: { type: String },
    _svg: { state: true },
  };

  declare which: string;
  declare n: number;
  declare selected: string;
  declare dimension: number;
  declare labels: string;
  declare labelForm: string;
  declare recentre: string;
  declare reorient: string;
  declare shade: string;
  declare azimuth: number;
  declare elevation: number;
  declare zoom: number;
  declare label: string;
  declare _svg: string;

  #orbit = new Orbit(this);

  constructor() {
    super();
    this.which = "permutahedron";
    this.n = 4;
    this.selected = "";
    this.dimension = -1;
    this.labels = "selected";
    this.labelForm = "data";
    this.recentre = "false";
    this.reorient = "false";
    this.shade = "true";
    this.azimuth = 30;
    this.elevation = 25;
    this.zoom = 1;
    this.label = "";
    this._svg = "";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override firstUpdated(): void {
    this.#orbit.remember();
  }

  protected override willUpdate(_changed: PropertyValues): void {
    this.#recompute();
  }

  get #polytope(): Polytope | undefined {
    return POLYTOPES[this.which.trim().toLowerCase()];
  }

  #recompute(): void {
    const polytope = this.#polytope;
    if (!polytope) {
      this._svg = "";
      return;
    }
    const view = this.#orbit.view;
    this._svg = polytope3dSvg(polytope, Number(this.n) || 0, {
      selected: parseFaces(this.selected),
      dimension: Number(this.dimension) >= 0 ? Number(this.dimension) : undefined,
      labels: parseLabelWhich(this.labels),
      labelForm: parseLabelForm(this.labelForm),
      recentre: this.recentre !== "false",
      reorient: this.reorient !== "false",
      shade: this.shade !== "false",
      azimuth: view.azimuth,
      elevation: view.elevation,
      zoom: view.zoom,
      title: this.label || undefined,
    });
  }

  /** Select whichever face was clicked, and say so. */
  #onClick(event: MouseEvent): void {
    // The click that ends a drag is not a selection -- the pointer finished on whatever the
    // rotation brought under it, which is nobody's intent.
    if (this.#orbit.dragged) return;
    const mark = (event.target as Element | null)?.closest?.("[data-face]");
    const spelling = mark?.getAttribute("data-face");
    if (spelling === null || spelling === undefined) return;
    const face = spelling.split(",").map(Number);
    const already = parseFaces(this.selected);
    const extending = event.shiftKey || event.metaKey || event.ctrlKey;
    const next = extending
      ? toggleFace(already, face)
      : already.length === 1 && already[0]?.join(",") === spelling
        ? []
        : [face];
    this.selected = spellFaces(next);
    this.dispatchEvent(
      new CustomEvent("select", {
        bubbles: true,
        composed: true,
        detail: {
          face,
          dimension: Number(mark?.getAttribute("data-dimension") ?? -1),
          selected: next,
          extending,
        },
      }),
    );
  }

  protected override render(): unknown {
    return html`<span
      class="notatio-polytope-box"
      title=${`${ORBIT_HINT} · click a face to select · shift-click to add`}
      @pointerdown=${this.#orbit.onPointerDown}
      @pointermove=${this.#orbit.onPointerMove}
      @pointerup=${this.#orbit.onPointerUp}
      @pointercancel=${this.#orbit.onPointerUp}
      @wheel=${this.#orbit.onWheel}
      @dblclick=${this.#orbit.onDblClick}
      @click=${(event: MouseEvent) => {
        this.#onClick(event);
      }}
      >${unsafeHTML(this._svg)}</span
    >`;
  }
}

if (!customElements.get("notatio-polytope")) {
  customElements.define("notatio-polytope", NotatioPolytope);
}
