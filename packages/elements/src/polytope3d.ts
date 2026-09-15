// A polytope's face poset, drawn.
//
// The geometry and the poset live in @enumeratio/polytope; this is only the cast onto the
// page. It reuses the same camera as the other 3d renderers, so a polytope sits in the same
// projection as a surface or a curve and can share a figure with them.
//
// What makes the picture worth having is that every mark on it is a FACE. Clicking a polygon
// selects a 2-face, a line a 1-face, a dot a 0-face — and the highlight follows face IDENTITY,
// not screen position, so faces that overlap in projection stay distinguishable.

import {
  type DrawOptions,
  drawn,
  type Face,
  type Polytope,
  type Projected,
  sameFace,
} from "@enumeratio/polytope";
import { camera, type CameraOptions, frameSvg, titleSvg, viewDirection } from "./project3d.ts";

export interface Polytope3dOptions extends CameraOptions, Omit<DrawOptions, "reorient"> {
  readonly title?: string;
  /** Emphasise this stratum; faces of other dimensions are drawn faintly. */
  readonly dimension?: number;
  /** Shade the two-dimensional faces (default true). */
  readonly shade?: boolean;
  /** Turn the selection to face the viewer. A boolean here where `drawn` wants a direction,
   *  because at this layer the camera is known and can say which way that is. */
  readonly reorient?: boolean;
  /** Which faces are labelled (default `"selected"`). */
  readonly labels?: LabelWhich;
  /** What a label says (default `"data"`). */
  readonly labelForm?: LabelForm;
}

// ── labels ───────────────────────────────────────────────────────────────────────────────
//
// Wolfram's `MeshCellLabel` is the model worth stealing: labels are specified per CELL
// DIMENSION, not per cell, so "number the vertices" and "name the facets" are the same option
// with a different key. Two attributes carry it here — which faces speak, and what they say —
// because an HTML attribute is a poor place for Wolfram's rule syntax.
//
// The resting default is `"selected"`: a picture with 45 faces labelled at once is unreadable,
// and the label a viewer actually wants is the one for the face they just clicked.

/** Which faces are labelled: none, all of them, only the selection, or named strata. */
export type LabelWhich = "none" | "all" | "selected" | readonly number[];

/** What a label says. `data` is the face's own carrier element — the thing it IS. */
export type LabelForm = "data" | "index" | "dimension" | "vertices";

const n2 = (v: number): string => (Math.round(v * 100) / 100).toString();
const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A face's data as an attribute, so a click handler can recover WHICH face was hit without
 *  consulting geometry. */
const faceAttr = (face: Face): string => `data-face="${face.join(",")}"`;

const ACCENT = "var(--notatio-accent, #b8860b)";
const INK = "var(--notatio-ink, #333)";

// ── selection, as text ───────────────────────────────────────────────────────────────────
//
// A selection has to survive a round trip through an HTML attribute, so a face is spelled as
// its own data and a selection joins them with a semicolon. Keeping this here rather than in
// the element keeps it a pure function of a string, which is what makes it testable without a
// browser — and it is the part with the edge cases.

/** Read a `selected` attribute: `"1,1,2;2,1,1"`. Junk is dropped rather than thrown on, so a
 *  half-typed attribute renders the rest of the selection instead of nothing. */
export const parseFaces = (value: string): number[][] =>
  value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => part.split(",").map(Number))
    .filter((face) => face.length > 0 && face.every(Number.isFinite));

export const spellFaces = (faces: readonly Face[]): string =>
  faces.map((face) => face.join(",")).join(";");

/** Add `face` to the selection, or drop it if it is already there — so clicking the same mark
 *  twice backs out of a selection without a second control to do it with. */
export const toggleFace = (selection: readonly Face[], face: Face): Face[] =>
  selection.some((other) => sameFace(other, face))
    ? selection.filter((other) => !sameFace(other, face))
    : [...selection, face];

/** Read a `labels` attribute: `none` / `all` / `selected`, or a list of dimensions. */
export function parseLabelWhich(value: string | undefined): LabelWhich {
  const text = (value ?? "").trim().toLowerCase();
  if (text === "" || text === "none" || text === "false") return "none";
  if (text === "all" || text === "true") return "all";
  if (text === "selected") return "selected";
  const dimensions = text.split(",").map((part) => Number(part.trim()));
  return dimensions.every(Number.isInteger) ? dimensions : "none";
}

const LABEL_FORMS: readonly LabelForm[] = ["data", "index", "dimension", "vertices"];

export const parseLabelForm = (value: string | undefined): LabelForm => {
  const text = (value ?? "").trim().toLowerCase() as LabelForm;
  return LABEL_FORMS.includes(text) ? text : "data";
};

/** Does this mark get a label? */
const labelled = (which: LabelWhich, dimension: number, selected: boolean): boolean =>
  which === "all"
    ? true
    : which === "selected"
      ? selected
      : which !== "none" && which.includes(dimension);

/** What a label says. `index` counts within the mark's own stratum, which is what makes
 *  "number the vertices" produce 1…v rather than a position in the whole face list. */
const labelText = (
  form: LabelForm,
  face: Face,
  dimension: number,
  index: number,
  vertices: number,
): string =>
  form === "index"
    ? String(index + 1)
    : form === "dimension"
      ? String(dimension)
      : form === "vertices"
        ? String(vertices)
        : face.join(",");

/**
 * Draw the face poset of `polytope` at order `n`.
 *
 * The camera is fitted to the CONTENT rather than to the unit cube it is normalised into: the
 * cube's own silhouette is a good deal wider than the solid inscribed in it, and fitting to the
 * cube left the figure occupying about a third of the frame. `render.ts` scales the solid to
 * the cube's inscribed sphere, so the fit is one number and — being a sphere — it does not
 * change as the figure turns.
 */
export function polytope3dSvg(
  polytope: Polytope,
  n: number,
  options: Polytope3dOptions = {},
): string {
  const which = options.labels ?? "selected";
  const form = options.labelForm ?? "data";
  // Labels sit outside the marks they name, so they need room the solid does not.
  const padding = (options.padding ?? 24) + (which === "none" ? 0 : 12);
  const loose = camera({ ...options, padding, zoom: 1 });
  const room = Math.min(loose.width, loose.height) - 2 * padding;
  const cam = camera({
    ...options,
    padding,
    zoom: (room / loose.scale) * (options.zoom && options.zoom > 0 ? options.zoom : 1),
  });
  const project = (at: readonly [number, number, number]): Projected => cam.at(at[0], at[1], at[2]);
  const picture = drawn(polytope, n, project, {
    ...options,
    reorient: options.reorient === true ? viewDirection(options) : undefined,
  });

  const emphasised = options.dimension;
  const faint = (dimension: number): number =>
    emphasised === undefined || emphasised === dimension ? 1 : 0.25;

  const polygons =
    options.shade === false
      ? ""
      : picture.shaded
          .map(
            (face) =>
              `<polygon ${faceAttr(face.face)} data-dimension="2" points="${face.ring
                .map((p) => `${n2(p.x)},${n2(p.y)}`)
                .join(" ")}" fill="${face.selected ? ACCENT : INK}" fill-opacity="${
                face.selected ? 0.35 : 0.08
              }" stroke="none" opacity="${faint(2)}"/>`,
          )
          .join("");

  const lines = picture.edges
    .map(
      (edge) =>
        `<line ${faceAttr(edge.face)} data-dimension="1" x1="${n2(edge.from.x)}" y1="${n2(
          edge.from.y,
        )}" x2="${n2(edge.to.x)}" y2="${n2(edge.to.y)}" stroke="${
          edge.selected ? ACCENT : INK
        }" stroke-width="${edge.selected ? 2 : 1}" opacity="${faint(1)}"/>`,
    )
    .join("");

  const dots = picture.vertices
    .map(
      (vertex) =>
        `<circle ${faceAttr(vertex.face)} data-dimension="0" cx="${n2(vertex.at.x)}" cy="${n2(
          vertex.at.y,
        )}" r="${vertex.selected ? 3.5 : 2}" fill="${
          vertex.selected ? ACCENT : INK
        }" opacity="${faint(0)}"/>`,
    )
    .join("");

  // One list for every dimension, so a label is styled the same way whatever it names, and the
  // selected ones are drawn LAST — a label is worth nothing if a neighbouring polygon covers it.
  const marks: { face: Face; dimension: number; at: Projected; selected: boolean; ring: number }[] =
    [
      ...picture.vertices.map((v) => ({ ...v, dimension: 0, ring: 1 })),
      ...picture.edges.map((e) => ({ ...e, dimension: 1, ring: 2 })),
      ...picture.shaded.map((f) => ({ ...f, dimension: 2, ring: f.ring.length })),
    ];
  const byDimension = new Map<number, number>();
  const texts = marks
    .map((mark) => {
      const index = byDimension.get(mark.dimension) ?? 0;
      byDimension.set(mark.dimension, index + 1);
      return { ...mark, index };
    })
    .filter((mark) => labelled(which, mark.dimension, mark.selected))
    .sort((a, b) => Number(a.selected) - Number(b.selected))
    .map((mark) => {
      // A vertex's label is nudged away from the middle so the dot it names stays visible;
      // an edge's or a facet's sits on the mark, which is already open space.
      const away = mark.dimension === 0 ? 9 : 0;
      const dx = mark.at.x - cam.width / 2;
      const dy = mark.at.y - cam.height / 2;
      const far = Math.hypot(dx, dy) || 1;
      const x = mark.at.x + (dx / far) * away;
      const y = mark.at.y + (dy / far) * away;
      const text = labelText(form, mark.face, mark.dimension, mark.index, mark.ring);
      // `paint-order` puts the halo under the glyphs, so a label stays legible over shading
      // without a box behind it.
      return (
        `<text class="notatio-face-label" x="${n2(x)}" y="${n2(y)}" text-anchor="middle" ` +
        `dominant-baseline="central" ` +
        `pointer-events="none" font-size="${mark.selected ? 9 : 8}" font-weight="${
          mark.selected ? 600 : 400
        }" fill="${mark.selected ? ACCENT : INK}" opacity="${faint(mark.dimension)}" ` +
        `paint-order="stroke" stroke="var(--notatio-bg, #fff)" stroke-width="3" ` +
        `stroke-linejoin="round">${esc(text)}</text>`
      );
    })
    .join("");

  const label = options.title ?? polytope.title;
  return frameSvg(
    cam.width,
    cam.height,
    esc(`${label}, order ${n}`),
    `${titleSvg(cam.width, label)}${polygons}${lines}${dots}${texts}`,
  );
}
