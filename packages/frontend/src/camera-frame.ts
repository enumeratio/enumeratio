// The camera view of a frame (`view: "camera"`): a layer whose places and marks are points of 3-D
// space (a frame of higher dimension is cast down to 3-D by its layer, with a fixed linear map).
// `Show`'s `ViewPoint`, `ViewVertical`, `ViewAngle`, `ViewCenter`, `SphericalRegion` and
// `Magnification` say how it is looked at; only a camera frame reads them. `throughCamera`
// projects the layer to the plane, so the drawing, hit-testing and fitting of a 2-D figure
// layer serve it unchanged, back to front.

import { argsOf, headOf, type Json } from "./frame-json.ts";
import type { LatticeView, Vec2 } from "./lattice.ts";
import {
  type Address,
  type FigureLabel,
  type FramePoint,
  fitView,
  type GraphicsPrimitive,
  type TileLayer,
} from "./tiles-canvas.ts";

export type Vec3 = readonly [number, number, number];

/** A matrix by rows. */
export type Matrix = readonly (readonly number[])[];

/**
 * The one step from a frame's space to 3-D: `M p`, the point padded (or cut) to the matrix's
 * width. `ProjectionMatrix -> M` (3 x d) replaces a layer's default map; a slice or a different
 * orientation of a higher-dimensional figure is another matrix here, and nothing else changes.
 */
export function projectTo3(p: FramePoint, m: Matrix): Vec3 {
  const row = (r: readonly number[]): number => r.reduce((sum, x, k) => sum + x * (p[k] ?? 0), 0);
  return [row(m[0] ?? []), row(m[1] ?? []), row(m[2] ?? [])];
}

/** The map of a layer that has none of its own: its first three coordinates. */
const FIRST_THREE: Matrix = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** A layer's places and marks taken to 3-D by `override` or else the layer's own default map. */
export function liftedToThree(layer: TileLayer, override?: Matrix): TileLayer {
  const lift =
    (i: number, j: number) =>
    (p: FramePoint): FramePoint =>
      projectTo3(p, override ?? layer.projection?.(i, j) ?? FIRST_THREE);
  return {
    ...layer,
    place: (i, j) => lift(i, j)(layer.place?.(i, j) ?? []),
    mark: (i, j) => {
      const m = layer.mark?.(i, j);
      const f = lift(i, j);
      if (!m) return { head: "Disk", radius: 0.03 };
      if (m.head === "Disk") return m.center ? { ...m, center: f(m.center) } : m;
      if (m.head === "Line" || m.head === "Polygon") return { head: m.head, points: m.points.map(f) };
      if (m.head === "Polyhedron") return { head: "Polyhedron", faces: m.faces.map((r) => r.map(f)) };
      return m.at ? { ...m, at: f(m.at) } : m;
    },
    ...(layer.label
      ? {
          label: (i, j, selected) => {
            const text = layer.label!(i, j, selected);
            return text?.at ? { ...text, at: lift(i, j)(text.at) } : text;
          },
        }
      : {}),
  };
}

/** Wolfram's `ViewPoint`, `ViewVertical`, `ViewAngle`, `ViewCenter` and `SphericalRegion`. */
export interface CameraSpec {
  /** `ProjectionMatrix`: the 3 x d map to 3-D, in place of each layer's own (`Automatic`). */
  readonly projection?: Matrix;
  /** Where the viewer is, as a direction from `viewCenter`; its length is the distance, in radii of the layer. */
  readonly viewPoint: Vec3;
  readonly viewVertical: Vec3;
  /** The lens in degrees: a perspective view from `viewPoint`. Absent (`Automatic`): a parallel projection. */
  readonly viewAngle?: number;
  readonly viewCenter: Vec3;
  /** Fit the circumscribed sphere, so the figure keeps its size as it turns. */
  readonly spherical: boolean;
  /** `Magnification`: the factor the picture is enlarged by. */
  readonly magnification: number;
}

/** Wolfram's default `ViewPoint`. */
export const DEFAULT_VIEW_POINT: Vec3 = [1.3, -2.4, 2];

const NAMED_VIEW_POINTS: Readonly<Record<string, Vec3>> = {
  Front: [0, -3, 0],
  Back: [0, 3, 0],
  Left: [-3, 0, 0],
  Right: [3, 0, 0],
  Above: [0, 0, 3],
  Below: [0, 0, -3],
};

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a: Vec3): Vec3 | undefined => {
  const l = length(a);
  return l > 1e-12 ? scale(a, 1 / l) : undefined;
};

/** The first three coordinates of a point of any dimension, padded with zeros. */
export const vec3 = (p: FramePoint): Vec3 => [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];

function numberOf(json: Json): number {
  if (headOf(json) === "Negate") return -numberOf(argsOf(json)[0]);
  const n = typeof json === "number" ? json : typeof json === "string" ? Number(json) : Number.NaN;
  return n;
}

const vectorOf = (json: Json): Vec3 | undefined => {
  if (headOf(json) !== "List" || argsOf(json).length !== 3) return undefined;
  const v = argsOf(json).map(numberOf);
  return v.every(Number.isFinite) ? (v as unknown as Vec3) : undefined;
};

const matrixOf = (json: Json): Matrix | undefined => {
  if (headOf(json) !== "List" || argsOf(json).length !== 3) return undefined;
  const rows = argsOf(json).map((r) => (headOf(r) === "List" ? argsOf(r).map(numberOf) : []));
  const width = rows[0]!.length;
  return width > 0 && rows.every((r) => r.length === width && r.every(Number.isFinite)) ? rows : undefined;
};

/** The camera `Show`'s options say; defaults where one is absent or unreadable. */
export function cameraSpecOf(options: ReadonlyMap<string, Json>): CameraSpec {
  const point = options.get("ViewPoint");
  const named = typeof point === "string" ? NAMED_VIEW_POINTS[point] : undefined;
  const viewPoint = named ?? vectorOf(point) ?? DEFAULT_VIEW_POINT;
  const angle = numberOf(options.get("ViewAngle"));
  const magnification = numberOf(options.get("Magnification"));
  const projection = matrixOf(options.get("ProjectionMatrix"));
  return {
    ...(projection ? { projection } : {}),
    viewPoint: length(viewPoint) > 1e-12 ? viewPoint : DEFAULT_VIEW_POINT,
    viewVertical: vectorOf(options.get("ViewVertical")) ?? [0, 0, 1],
    ...(angle > 0 && angle < 180 ? { viewAngle: angle } : {}),
    viewCenter: vectorOf(options.get("ViewCenter")) ?? [0, 0, 0],
    spherical: options.get("SphericalRegion") === "True",
    magnification: magnification > 0 ? magnification : 1,
  };
}

/** What the reader changes with gestures: where the viewer is, and how far in. */
export interface CameraState {
  readonly viewPoint: Vec3;
  readonly zoom: number;
}

export const ZOOM_RANGE: readonly [number, number] = [0.25, 8];

/** Degrees of turn per pixel of drag. */
const DEGREES_PER_PIXEL = 0.5;

/** The highest the viewer may climb toward the pole, in degrees: past it the view flips. */
const POLE = 89;

/** An orthonormal pair across `up`, fixed by `up` alone so a drag has the same axes throughout. */
function horizontals(up: Vec3): [Vec3, Vec3] {
  const hint: Vec3 = Math.abs(up[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = unit(cross(cross(up, hint), up))!;
  return [e1, cross(up, e1)];
}

/**
 * The viewer moved by a drag of `dx`, `dy` CSS pixels: around the vertical by dx and up and down
 * by dy, the figure following the pointer. The distance is kept, and the elevation held short of
 * the poles.
 */
export function orbited(viewPoint: Vec3, viewVertical: Vec3, dx: number, dy: number): Vec3 {
  const up = unit(viewVertical) ?? [0, 0, 1];
  const [e1, e2] = horizontals(up);
  const r = length(viewPoint);
  let azimuth = Math.atan2(dot(viewPoint, e2), dot(viewPoint, e1));
  let elevation = Math.asin(Math.max(-1, Math.min(1, dot(viewPoint, up) / r)));
  azimuth -= (dx * DEGREES_PER_PIXEL * Math.PI) / 180;
  const pole = (POLE * Math.PI) / 180;
  elevation = Math.max(-pole, Math.min(pole, elevation + (dy * DEGREES_PER_PIXEL * Math.PI) / 180));
  const flat = Math.cos(elevation) * r;
  return [0, 1, 2].map(
    (k) => flat * (Math.cos(azimuth) * e1[k]! + Math.sin(azimuth) * e2[k]!) + Math.sin(elevation) * r * up[k]!,
  ) as unknown as Vec3;
}

/** A zoom, kept in its range. */
export const zoomed = (zoom: number): number => Math.max(ZOOM_RANGE[0], Math.min(ZOOM_RANGE[1], zoom));

/** A point of the scene on the page: `x` right and `y` up in frame units, `depth` toward the viewer. */
export interface Projected {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

export interface ViewCamera {
  project(p: FramePoint): Projected;
  /** The unit vector from the scene to the viewer. */
  readonly toViewer: Vec3;
  /** Pixels-per-unit factor at `p`'s depth: 1 for a parallel projection. */
  magnification(depth: number): number;
}

/** The camera looking at `spec.viewCenter` from `state.viewPoint`, for a scene of the given radius. */
export function cameraOf(spec: CameraSpec, state: CameraState, radius: number): ViewCamera {
  const toViewer = unit(state.viewPoint)!;
  let right = unit(cross(spec.viewVertical, toViewer));
  // Looking along the vertical: any perpendicular will do.
  right ??= unit(cross([0, 1, 0], toViewer)) ?? [1, 0, 0];
  const up = cross(toViewer, right);
  const distance = length(state.viewPoint) * radius;
  const magnification = (depth: number): number =>
    spec.viewAngle === undefined ? 1 : distance / Math.max(distance - depth, distance * 1e-3);
  return {
    toViewer,
    magnification,
    project: (p) => {
      const q: Vec3 = [p[0]! - spec.viewCenter[0], (p[1] ?? 0) - spec.viewCenter[1], (p[2] ?? 0) - spec.viewCenter[2]];
      const depth = dot(q, toViewer);
      const k = magnification(depth);
      return { x: dot(q, right) * k, y: dot(q, up) * k, depth };
    },
  };
}

/** The largest distance of a mark's points from `center`. */
export function frameRadius(layer: TileLayer, center: Vec3): number {
  let r = 0;
  const reach = (p: FramePoint): void => {
    r = Math.max(r, length([p[0]! - center[0], (p[1] ?? 0) - center[1], (p[2] ?? 0) - center[2]]));
  };
  for (const [i, j] of layer.addresses?.() ?? []) {
    const at = layer.place?.(i, j) ?? [0, 0, 0];
    reach(at);
    const mark = layer.mark?.(i, j);
    if (mark?.head === "Line" || mark?.head === "Polygon") mark.points.forEach(reach);
    else if (mark?.head === "Polyhedron") mark.faces.forEach((f) => f.forEach(reach));
    else if (mark?.head === "Disk")
      r = Math.max(r, length([at[0]! - center[0], (at[1] ?? 0) - center[1], (at[2] ?? 0) - center[2]]) + mark.radius);
  }
  return r;
}

/** Back to front: a body's outline, then faces, then lines, then points and text. */
const RANK: Readonly<Record<GraphicsPrimitive["head"], number>> = {
  Polyhedron: 0,
  Polygon: 1,
  Line: 2,
  Disk: 3,
  Text: 4,
};

/** Room around a fitted figure, as a fraction of its radius. */
const MARGIN = 1.1;

/**
 * A camera layer as the 2-D figure layer a camera sees: places and marks taken to 3-D by the
 * projection (`ProjectionMatrix`, else the layer's own), then through the camera, addresses
 * in painter's order (far to near, bodies and faces before lines before points), and a
 * `Depth` value, 0 at the nearest point of the circumscribed sphere and 1 at the farthest. With
 * the view that fits it.
 */
export function throughCamera(
  source: TileLayer,
  spec: CameraSpec,
  state: CameraState,
  aspect: number,
): { readonly layer: TileLayer; readonly view: LatticeView } {
  const layer = liftedToThree(source, spec.projection);
  const radius = Math.max(frameRadius(layer, spec.viewCenter), 1e-9);
  const camera = cameraOf(spec, state, radius);
  const place = (i: number, j: number): FramePoint => layer.place?.(i, j) ?? [0, 0, 0];
  const flat = (p: FramePoint): Vec2 => {
    const q = camera.project(p);
    return [q.x, q.y];
  };
  const depthOf = (i: number, j: number): number => camera.project(place(i, j)).depth;

  const marks = new Map<string, GraphicsPrimitive>();
  const markOf = (i: number, j: number): GraphicsPrimitive => {
    const key = `${i},${j}`;
    const known = marks.get(key);
    if (known) return known;
    const m: GraphicsPrimitive = layer.mark?.(i, j) ?? { head: "Disk", radius: 0.03 };
    const at = camera.project(place(i, j));
    const mark: GraphicsPrimitive =
      m.head === "Disk"
        ? { head: "Disk", radius: m.radius * camera.magnification(at.depth), center: flat(m.center ?? place(i, j)) }
        : m.head === "Line" || m.head === "Polygon"
          ? { head: m.head, points: m.points.map(flat) }
          : m.head === "Polyhedron"
            ? { head: "Polyhedron", faces: m.faces.map((f) => f.map(flat)) }
            : { head: "Text", text: m.text, size: m.size, at: flat(m.at ?? place(i, j)) };
    marks.set(key, mark);
    return mark;
  };

  const order = [...(layer.addresses?.() ?? [])]
    .map(([i, j]) => ({ at: [i, j] as Address, rank: RANK[markOf(i, j).head], depth: depthOf(i, j) }))
    .toSorted((a, b) => a.rank - b.rank || a.depth - b.depth)
    .map((a) => a.at);

  const shown: TileLayer = {
    ...layer,
    addresses: () => order,
    place: (i, j) => flat(place(i, j)),
    mark: markOf,
    ...(layer.label
      ? {
          label: (i, j, selected): FigureLabel | undefined => {
            const text = layer.label!(i, j, selected);
            return text && { ...text, at: flat(text.at ?? place(i, j)) };
          },
        }
      : {}),
    value: (i, j, name) =>
      name.replace(/^Is(?=[A-Z])/, "").toLowerCase() === "depth"
        ? Math.max(0, Math.min(1, (radius - depthOf(i, j)) / (2 * radius)))
        : layer.value(i, j, name),
  };

  const zoom = state.zoom * spec.magnification;
  if (spec.viewAngle !== undefined) {
    const distance = length(state.viewPoint) * radius;
    return {
      layer: shown,
      view: { center: [0, 0], extent: (distance * Math.tan((spec.viewAngle * Math.PI) / 360)) / zoom },
    };
  }
  if (spec.spherical) return { layer: shown, view: { center: [0, 0], extent: (radius * MARGIN) / zoom } };
  const fit = fitView(shown, aspect, 0);
  return { layer: shown, view: { center: fit.center, extent: (fit.extent * MARGIN) / zoom } };
}
