// The polytope frame: a layer for `Show` whose addresses are (k, index), the dimension of a face
// and its position among the faces of that dimension in the collection's own order, vertices at
// k = 0. `PolytopeFaces(Permutahedron(4))` is one polytope's face poset; several in a `Show` share
// one frame and one camera, their faces numbered on through each dimension in the order given.
//
// A face's place is its barycenter in the polytope's ambient space, centered and scaled so the
// circumscribed sphere (as projected by the default map) has radius 1. The layer's `projection`
// is that default 3 × d map, its span's leading three axes; the frame's `ProjectionMatrix`
// option replaces it. Its mark is a
// Disk (k = 0), a Line (1), a Polygon (2) or, for a solid, a Polyhedron shown as its boundary;
// all of them are points of the same space, the `camera` view's.
//
// Properties: IsVertex, IsEdge, IsRidge (k = d - 2), IsFacet (k = d - 1), IsInterior (k >= 2,
// faces with area), IsTop (the polytope itself), Dimension<k>. Values: Dimension, VertexCount,
// Valence (the faces it is on: those containing it, itself aside), Index. The camera adds Depth.
// Relations to the selection: FaceOf (the selected face contains this one, so the closure; also
// reflexive), HasFace and Cofaces (this contains the selected one: the star), Incident (either),
// Adjacent (a cover in the face poset: dimensions one apart, one containing the other),
// SameDimension.
//
// Option `MeshCellLabel -> [Selected -> "Data", 0 -> "Index", All -> "Name"]` captions faces: the
// first rule a face matches says what with: its Data (the carrier's element), Name (its
// set-composition or subset as such), Index (among its dimension, from 1), Dimension or Vertices.

import { cast, type Face, POLYTOPES, type Polytope, spanBasis } from "@enumeratio/polytope";
import { argsOf, type FigureLayer, headOf, intOf, type Json, normal, UNIT_BASIS } from "./frame-json.ts";
import { splitOptions } from "./graphics-rules.ts";
import type { Address, FigureLabel, FramePoint, GraphicsPrimitive } from "./tiles-canvas.ts";

/** The polytopes by the head that names them in a `PolytopeFaces`. */
export const POLYTOPE_HEADS: Readonly<Record<string, string>> = {
  Permutahedron: "permutahedron",
  Simplex: "simplex",
  CrossPolytope: "cross-polytope",
  Hypercube: "hypercube",
  Associahedron: "associahedron",
};

/** The head naming a polytope by its `which` spelling (`cross-polytope`). */
export const polytopeHeadOf = (which: string): string | undefined =>
  Object.keys(POLYTOPE_HEADS).find((head) => POLYTOPE_HEADS[head] === which.trim().toLowerCase());

/** Faces a polytope may have and still be tabulated: the poset is computed from its vertices. */
const MAX_FACES = 1500;

/** A point in the polytope's ambient space, centered and scaled to the unit sphere. */
type Point = readonly number[];

/** One polytope at one order, its faces placed and its poset read off. */
interface Part {
  readonly polytope: Polytope;
  readonly n: number;
  readonly faces: readonly Face[];
  /** The polytope's own dimension. */
  readonly dimension: number;
  readonly dims: readonly number[];
  readonly places: readonly Point[];
  /** The default 3 × d map to 3-D: its span's leading three axes. */
  readonly projection: readonly (readonly number[])[];
  /** For each face, the vertices it contains, as sorted ordinals among the vertices. */
  readonly vertices: readonly (readonly number[])[];
  readonly vertexPlaces: readonly Point[];
}

const parts = new Map<Polytope, Map<number, Part | string>>();

const length = (p: readonly number[]): number => Math.hypot(...p);

/** `a` is inside `b`: both sorted. */
function subset(a: readonly number[], b: readonly number[]): boolean {
  let k = 0;
  for (const x of a) {
    while (k < b.length && b[k]! < x) k++;
    if (b[k] !== x) return false;
  }
  return true;
}

/** The faces of `polytope` at order `n`, placed and with their vertex sets; why not, as a string. */
function partOf(polytope: Polytope, n: number): Part | string {
  const known = parts.get(polytope)?.get(n);
  if (known) return known;
  const faces = polytope.enumerate(n);
  let part: Part | string;
  if (faces.length === 0) part = `${polytope.title} has no faces at order ${n}.`;
  else if (faces.length > MAX_FACES)
    part = `${polytope.title} at order ${n} has ${faces.length} faces: too many to draw (at most ${MAX_FACES}).`;
  else {
    const dims = faces.map((f) => polytope.dimension(f));
    const { at, basis, centre } = cast(polytope, n);
    // Places stay in the ambient space; the frame's projection takes them down to 3-D.
    const radius = Math.max(...faces.map((f) => length(at(polytope.point(f)))), 1e-9);
    const places = faces.map((f) => polytope.point(f).map((x, k) => (x - (centre[k] ?? 0)) / radius));
    const width = places[0]!.length;
    const projection = [0, 1, 2].map((r) => basis[r] ?? Array.from({ length: width }, () => 0));
    const vertexFaces = faces.flatMap((_, f) => (dims[f] === 0 ? [f] : []));
    const vertices = faces.map((face, f) =>
      vertexFaces.flatMap((v, ordinal) => (v === f || polytope.hasVertex(face, faces[v]!) ? [ordinal] : [])),
    );
    part = {
      polytope,
      n,
      faces,
      dimension: polytope.dimensionAt(n),
      dims,
      places,
      projection,
      vertices,
      vertexPlaces: vertexFaces.map((f) => places[f]!),
    };
  }
  if (!parts.has(polytope)) parts.set(polytope, new Map());
  parts.get(polytope)!.set(n, part);
  return part;
}

/** What `MeshCellLabel` captions a face with. */
const LABEL_FORMS = ["Data", "Name", "Index", "Dimension", "Vertices"] as const;
type LabelForm = (typeof LABEL_FORMS)[number];

interface LabelRule {
  readonly when: "All" | "Selected" | readonly number[];
  readonly form: LabelForm;
}

/** What a `PolytopeFaces` layer, or several sharing a frame, says. */
export interface PolytopeModel {
  readonly polytopes: readonly { readonly polytope: Polytope; readonly n: number }[];
  readonly labels: readonly LabelRule[];
  readonly title?: string;
}

const LAYER_OPTIONS: ReadonlySet<string> = new Set([
  "ColorRules",
  "ColorMixing",
  "BoundaryStyle",
  "MeshCellLabel",
  "PlotLabel",
]);

const stringOf = (json: Json): string | undefined =>
  typeof json === "string" ? json.replace(/^'([\s\S]*)'$/, "$1") : (json as { str?: string } | undefined)?.str;

/** `MeshCellLabel`'s value: `None`, or rules `which -> form`, `which` being All, Selected, a dimension or a list of them. */
function labelRulesOf(json: Json): LabelRule[] | string {
  if (json === undefined) return [{ when: "Selected", form: "Data" }];
  if (json === "None") return [];
  const entries = headOf(json) === "List" ? argsOf(json) : [json];
  const rules: LabelRule[] = [];
  for (const entry of entries) {
    const [which, how] = argsOf(entry);
    const form = LABEL_FORMS.find((f) => f === stringOf(how));
    const dimensions = (headOf(which) === "List" ? argsOf(which) : [which]).map(intOf);
    const when =
      which === "All" || which === "Selected"
        ? which
        : dimensions.every((d) => d !== undefined)
          ? (dimensions as number[])
          : undefined;
    if (!form || when === undefined)
      return 'MeshCellLabel needs rules like Selected -> "Data", 0 -> "Index" or All -> "Name" (Data, Name, Index, Dimension, Vertices).';
    rules.push({ when, form });
  }
  return rules;
}

/** The model the `PolytopeFaces` expressions of a `Show` name: `PolytopeFaces(Permutahedron(4))`, each one polytope. */
export function polytopeModelOf(layers: readonly Json[]): PolytopeModel | string {
  const polytopes: { polytope: Polytope; n: number }[] = [];
  let labels: Json;
  let title: string | undefined;
  for (const layer of layers) {
    const { positional, options } = splitOptions(layer, LAYER_OPTIONS);
    const [spec] = positional;
    const polytope = POLYTOPES[POLYTOPE_HEADS[headOf(spec) ?? ""] ?? ""];
    const n = intOf(argsOf(spec)[0]);
    if (!polytope || n === undefined || n < 1)
      return "PolytopeFaces needs a polytope and its order: Permutahedron(4), Simplex(4), CrossPolytope(3), Hypercube(3) or Associahedron(4).";
    polytopes.push({ polytope, n });
    labels ??= options.get("MeshCellLabel");
    title ??= stringOf(options.get("PlotLabel"));
  }
  const rules = labelRulesOf(labels);
  if (typeof rules === "string") return rules;
  for (const { polytope, n } of polytopes) {
    const part = partOf(polytope, n);
    if (typeof part === "string") return part;
  }
  return { polytopes, labels: rules, ...(title ? { title } : {}) };
}

/** A face as its carrier names it: a set composition as `{{1, 2}, {3}}`, a subset as `{1, 3}`. */
export function faceName(polytope: Polytope, face: Face): string {
  if (polytope.faces === "set_composition") {
    const blocks = Math.max(0, ...face);
    return `{${Array.from({ length: blocks }, (_, b) => `{${face.flatMap((l, x) => (l === b + 1 ? [x + 1] : [])).join(", ")}}`).join(", ")}}`;
  }
  if (polytope.faces === "subset") return `{${face.flatMap((bit, x) => (bit ? [x + 1] : [])).join(", ")}}`;
  return `(${face.join(",")})`;
}

/** A face's vertices in order around it, in its plane. */
function ringOf(vertices: readonly Point[]): Point[] {
  if (vertices.length < 4) return [...vertices];
  const width = vertices[0]!.length;
  const c = Array.from({ length: width }, (_, k) => vertices.reduce((s, p) => s + p[k]!, 0) / vertices.length);
  const [u, v] = spanBasis(vertices.map((p) => p.map((x, k) => x - c[k]!)));
  if (!u || !v) return [...vertices];
  const angle = (p: Point): number => {
    const d = p.map((x, k) => x - c[k]!);
    return Math.atan2(
      d.reduce((s, x, k) => s + x * v[k]!, 0),
      d.reduce((s, x, k) => s + x * u[k]!, 0),
    );
  };
  return vertices.toSorted((a, b) => angle(a) - angle(b));
}

const IDENTITY = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** A vertex's mark, in the layer's units. */
const VERTEX_RADIUS = 0.025;
/** Where a vertex's caption sits, outside the vertex so the dot stays visible. */
const CAPTION_OUT = 1.13;
/** A caption's height, in the layer's units. */
const CAPTION_SIZE = 0.08;

/** One or more polytopes as a layer for `Show`. */
export function polytopeLayer(model: PolytopeModel): FigureLayer {
  const ps = model.polytopes.map(({ polytope, n }) => partOf(polytope, n) as Part);
  const top = Math.max(...ps.map((p) => p.dimension));
  // Face (k, i) is the i-th of the dimension's faces across the polytopes, in the order given.
  const entries: { part: Part; f: number }[][] = Array.from({ length: top + 1 }, () => []);
  for (const part of ps) part.faces.forEach((_, f) => entries[part.dims[f]!]?.push({ part, f }));
  const entryAt = (k: number, i: number) => entries[k]?.[i];
  const addresses: Address[] = entries.flatMap((list, k) => list.map((_, i): Address => [k, i]));
  const counts = entries.map((list) => list.length);

  const marks = new Map<string, GraphicsPrimitive>();
  const markAt = (k: number, i: number): GraphicsPrimitive => {
    const key = `${k},${i}`;
    let mark = marks.get(key);
    if (mark) return mark;
    const { part, f } = entryAt(k, i)!;
    const own = part.vertices[f]!.map((o) => part.vertexPlaces[o]!);
    if (k === 0) mark = { head: "Disk", radius: VERTEX_RADIUS };
    else if (k === 1 && own.length === 2) mark = { head: "Line", points: own };
    else if (k === 2) mark = { head: "Polygon", points: ringOf(own) };
    else if (k >= 3) {
      // The solid shown as its boundary: the rings of the 2-faces it contains.
      const sides = part.faces.flatMap((_, g) =>
        part.dims[g] === 2 && subset(part.vertices[g]!, part.vertices[f]!)
          ? [ringOf(part.vertices[g]!.map((o) => part.vertexPlaces[o]!))]
          : [],
      );
      mark = { head: "Polyhedron", faces: sides };
    } else mark = { head: "Disk", radius: VERTEX_RADIUS };
    marks.set(key, mark);
    return mark;
  };

  /** Whether `big` contains `small` as faces of one polytope. */
  const contains = (a: { part: Part; f: number }, b: { part: Part; f: number }): boolean =>
    a.part === b.part && subset(b.part.vertices[b.f]!, a.part.vertices[a.f]!);

  const cofaces = new Map<string, number>();
  const valence = (k: number, i: number): number => {
    const key = `${k},${i}`;
    let count = cofaces.get(key);
    if (count === undefined) {
      const self = entryAt(k, i)!;
      count = self.part.faces.reduce(
        (s, _, g) => s + (g !== self.f && contains({ part: self.part, f: g }, self) ? 1 : 0),
        0,
      );
      cofaces.set(key, count);
    }
    return count;
  };

  const titleOf = (p: Part): string => `${p.polytope.title}, order ${p.n}`;
  const summaryRows: [string, string][] = [
    ["faces", String(counts.reduce((s, c) => s + c, 0))],
    ["f-vector", counts.join(", ")],
    ["dimension", String(top)],
  ];

  const caption = (k: number, i: number, selected = false): FigureLabel | undefined => {
    const rule = model.labels.find((r) => r.when === "All" || (r.when === "Selected" ? selected : r.when.includes(k)));
    const entry = entryAt(k, i);
    if (!rule || !entry) return undefined;
    const { part, f } = entry;
    const text =
      rule.form === "Data"
        ? part.faces[f]!.join(",")
        : rule.form === "Name"
          ? faceName(part.polytope, part.faces[f]!)
          : rule.form === "Index"
            ? String(i + 1)
            : rule.form === "Dimension"
              ? String(k)
              : String(part.vertices[f]!.length);
    const out = k === 0 ? CAPTION_OUT : 1;
    return {
      text,
      size: CAPTION_SIZE,
      at: part.places[f]!.map((x) => x * out),
    };
  };

  return {
    title: model.title ?? ps.map(titleOf).join(" and "),
    view: "camera",
    basis: UNIT_BASIS,
    maxIndex: Math.max(...counts),
    bounds: { i: [0, top], j: [0, Math.max(...counts) - 1] },
    grid: UNIT_BASIS,
    gridLabel: (_axis, k) => String(k),
    addresses: () => addresses,
    place: (k, i): FramePoint => entryAt(k, i)?.part.places[entryAt(k, i)!.f] ?? [0, 0, 0],
    projection: (k, i) => entryAt(k, i)?.part.projection ?? IDENTITY,
    mark: markAt,
    label: caption,
    known: () => true,
    prepare: () => {},
    has: (k, i, name) => {
      const entry = entryAt(k, i);
      if (!entry) return undefined;
      const d = entry.part.dimension;
      const word = normal(name);
      const dimension = /^dimension(\d+)$/.exec(word);
      if (dimension) return k === Number(dimension[1]);
      switch (word) {
        case "vertex":
          return k === 0;
        case "edge":
          return k === 1;
        case "ridge":
          return d >= 2 && k === d - 2;
        case "facet":
          return d >= 1 && k === d - 1;
        case "interior":
          return k >= 2;
        case "top":
          return k === d;
      }
      return undefined;
    },
    value: (k, i, name) => {
      const entry = entryAt(k, i);
      if (!entry) return undefined;
      switch (normal(name)) {
        case "dimension":
          return k;
        case "vertexcount":
          return entry.part.vertices[entry.f]!.length;
        case "valence":
          return valence(k, i);
        case "index":
          return i;
      }
      return undefined;
    },
    relatedTo: (relation, [sk, si], k, i) => {
      const [face, picked] = [entryAt(k, i), entryAt(sk, si)];
      if (!face || !picked) return false;
      switch (relation) {
        case "FaceOf":
          return contains(picked, face);
        case "HasFace":
        case "Cofaces":
          return contains(face, picked);
        case "Incident":
          return contains(picked, face) || contains(face, picked);
        case "Adjacent":
          return Math.abs(k - sk) === 1 && (contains(picked, face) || contains(face, picked));
        case "SameDimension":
          return k === sk;
      }
      return false;
    },
    summary: () => summaryRows,
    describe: (k, i) => {
      const entry = entryAt(k, i);
      if (!entry) return { title: `(${k}, ${i})`, rows: [] };
      const { part, f } = entry;
      const incident = part.faces.reduce(
        (s, _, g) => s + (g !== f && (contains(entry, { part, f: g }) || contains({ part, f: g }, entry)) ? 1 : 0),
        0,
      );
      return {
        title: `${k}-face ${faceName(part.polytope, part.faces[f]!)}`,
        rows: [
          ["dimension", String(k)],
          ["vertices", String(part.vertices[f]!.length)],
          ["incident", `${incident} ${incident === 1 ? "face" : "faces"}`],
          ...(ps.length > 1 ? ([["polytope", titleOf(part)]] as [string, string][]) : []),
        ],
      };
    },
  };
}
