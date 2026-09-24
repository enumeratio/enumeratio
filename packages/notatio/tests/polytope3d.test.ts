import {
  ASSOCIAHEDRON,
  CROSS_POLYTOPE,
  HYPERCUBE,
  PERMUTAHEDRON as P,
  SIMPLEX,
} from "@enumeratio/polytope";
import { expect, test } from "vite-plus/test";
import {
  parseFaces,
  parseLabelForm,
  parseLabelWhich,
  polytope3dSvg,
  spellFaces,
  toggleFace,
} from "../src/polytope3d.ts";

const count = (svg: string, tag: string): number => svg.split(`<${tag} `).length - 1;

/** The face labels on a figure, in draw order — the figure's own title is a `<text>` too. */
const faceLabels = (svg: string): string[] =>
  [...svg.matchAll(/<text class="notatio-face-label"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]!);

/** Where a face's polygon sits on the page, to the nearest viewBox unit. */
const centreOf = (svg: string, face: readonly number[]): [number, number] => {
  const match = new RegExp(`<polygon [^>]*data-face="${face.join(",")}"[^>]*points="([^"]*)"`).exec(
    svg,
  );
  const points = (match?.[1] ?? "").split(" ").map((p) => p.split(",").map(Number));
  const xs = points.map((p) => p[0]!);
  const ys = points.map((p) => p[1]!);
  return [
    Math.round((Math.max(...xs) + Math.min(...xs)) / 2),
    Math.round((Math.max(...ys) + Math.min(...ys)) / 2),
  ];
};

test("every mark on the picture is a face", () => {
  // 24 vertices, 36 edges, 14 two-faces — the truncated octahedron, and each drawn mark
  // carries the face data that produced it.
  const svg = polytope3dSvg(P, 4);
  expect(count(svg, "circle")).toBe(24);
  expect(count(svg, "line")).toBe(36);
  expect(count(svg, "polygon")).toBe(14);
  expect(count(svg, "circle")).toBe([...svg.matchAll(/data-dimension="0"/g)].length);
});

test("a face is identified by its DATA, not its position", () => {
  // Two faces can project to the same place; selection has to survive that, so every mark
  // carries the face itself.
  const svg = polytope3dSvg(P, 3);
  const faces = [...svg.matchAll(/data-face="([^"]*)"/g)].map((m) => m[1]);
  expect(new Set(faces).size, "every mark names a distinct face").toBe(faces.length);
  expect(faces).toContain("1,2,3");
});

test("selection highlights by face identity", () => {
  const vertex = P.enumerate(3).find((f) => P.dimension(f) === 0)!;
  const plain = polytope3dSvg(P, 3);
  const picked = polytope3dSvg(P, 3, { selected: [vertex] });
  expect(picked).not.toBe(plain);
  // The chosen vertex is drawn larger; the others are not.
  expect([...picked.matchAll(/r="3.5"/g)].length).toBe(1);
  expect([...plain.matchAll(/r="3.5"/g)].length).toBe(0);
});

test("a dimension can be emphasised, dimming the rest", () => {
  const svg = polytope3dSvg(P, 4, { dimension: 1 });
  // Edges at full opacity, vertices and polygons faint.
  expect(svg).toContain('data-dimension="1"');
  expect([...svg.matchAll(/opacity="0.25"/g)].length).toBeGreaterThan(0);
});

test("recentring puts the chosen face at the middle of the frame", () => {
  // Measured, not merely "the output differs". An earlier version of this test compared
  // against an UNSELECTED figure, so the highlight alone made it pass while recentring was in
  // fact doing nothing at all — the normalisation downstream recomputed the middle from the
  // bounding box and undid the translation.
  const square = P.enumerate(4).find((f) => P.dimension(f) === 2)!;
  const plain = polytope3dSvg(P, 4, { selected: [square] });
  const moved = polytope3dSvg(P, 4, { selected: [square], recentre: true });
  expect(centreOf(moved, square)).toEqual([180, 130]);
  expect(centreOf(plain, square)).not.toEqual([180, 130]);
  // A translation, so nothing is added or lost.
  expect(count(moved, "circle")).toBe(count(plain, "circle"));
  expect(count(moved, "line")).toBe(count(plain, "line"));
});

test("the figure fits the frame from every angle, and never rescales to do it", () => {
  // Normalising to the bounding SPHERE is what buys this. A bounding box grows and shrinks as
  // the solid turns, so a box-fitted figure would rescale on every frame of a drag; a sphere's
  // radius is rotation-invariant, so the scale is fixed and the figure simply turns.
  const half = (260 - 2 * 36) / 2; // the frame's room, less the padding labels ask for
  const radii = [0, 17, 30, 55, 90, 143].map((azimuth) => {
    const svg = polytope3dSvg(P, 4, { azimuth, elevation: 25 });
    const xs = [...svg.matchAll(/<circle [^>]*cx="([-\d.]+)"/g)].map((m) => Number(m[1]));
    const ys = [...svg.matchAll(/<circle [^>]*cy="([-\d.]+)"/g)].map((m) => Number(m[1]));
    return Math.max(...xs.map((x, i) => Math.hypot(x - 180, ys[i]! - 130)));
  });
  // Inside the frame at every angle — an orthographic projection can only shorten a radius,
  // never lengthen it, so the sphere that bounds the solid bounds the picture too.
  for (const radius of radii) expect(radius).toBeLessThanOrEqual(half + 0.5);
  // And it genuinely uses that room rather than sitting small inside it.
  expect(Math.max(...radii)).toBeGreaterThan(0.9 * half);
});

test("the figure fills the frame it is given", () => {
  // Fitting the camera to the unit cube left the solid occupying about a third of the width,
  // because a cube's silhouette is a good deal wider than the solid inscribed in it.
  const svg = polytope3dSvg(P, 4, { labels: "none" });
  const xs = [...svg.matchAll(/<circle [^>]*cx="([-\d.]+)"/g)].map((m) => Number(m[1]));
  const width = Math.max(...xs) - Math.min(...xs);
  expect(width).toBeGreaterThan(0.8 * (260 - 48));
  // Still centred on the frame, not merely large.
  expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(180, 0);
});

test("shading can be turned off", () => {
  expect(count(polytope3dSvg(P, 4, { shade: false }), "polygon")).toBe(0);
  expect(count(polytope3dSvg(P, 4, { shade: false }), "line")).toBe(36);
});

test("the hexagon draws as a hexagon", () => {
  // Order 3 is flat: one 2-face with six vertices, six edges.
  const svg = polytope3dSvg(P, 3);
  const polygon = /<polygon [^>]*points="([^"]*)"/.exec(svg)?.[1] ?? "";
  expect(polygon.split(" ").length).toBe(6);
});

test("every polytope draws, and the marks are the faces", () => {
  // The counts come out of the poset, so this is a check on the whole pipeline rather than on
  // the drawing: a tetrahedron, an octahedron, and the 3-D associahedron.
  const expected = [
    [SIMPLEX, 4, 4, 6, 4],
    [CROSS_POLYTOPE, 3, 6, 12, 8],
    [HYPERCUBE, 3, 8, 12, 6],
    [ASSOCIAHEDRON, 4, 14, 21, 9],
  ] as const;
  for (const [P, n, dots, lines, faces] of expected) {
    const svg = polytope3dSvg(P, n);
    expect(count(svg, "circle"), `${P.name} vertices`).toBe(dots);
    expect(count(svg, "line"), `${P.name} edges`).toBe(lines);
    expect(count(svg, "polygon"), `${P.name} facets`).toBe(faces);
  }
});

test("the associahedron's facets draw as three squares and six pentagons", () => {
  const svg = polytope3dSvg(ASSOCIAHEDRON, 4);
  const sizes = [...svg.matchAll(/<polygon [^>]*points="([^"]*)"/g)]
    .map((m) => m[1]!.split(" ").length)
    .sort((a, b) => a - b);
  expect(sizes).toEqual([4, 4, 4, 5, 5, 5, 5, 5, 5]);
});

test("reorienting turns the selected face flat towards the viewer", () => {
  // A facet seen face-on covers more of the frame than the same facet seen edge-on, so the
  // area of its drawn polygon is the honest check that the turn actually happened.
  const facet = ASSOCIAHEDRON.enumerate(4).find((f) => ASSOCIAHEDRON.dimension(f) === 2)!;
  const area = (svg: string): number => {
    const ring = /<polygon [^>]*data-face="([^"]*)"[^>]*points="([^"]*)"/g;
    for (const match of svg.matchAll(ring)) {
      if (match[1] !== facet.join(",")) continue;
      const pts = match[2]!.split(" ").map((p) => p.split(",").map(Number) as [number, number]);
      return Math.abs(
        pts.reduce((sum, [x, y], i) => {
          const [nx, ny] = pts[(i + 1) % pts.length]!;
          return sum + (x * ny! - nx! * y);
        }, 0) / 2,
      );
    }
    return 0;
  };
  const flat = polytope3dSvg(ASSOCIAHEDRON, 4, { selected: [facet], reorient: true });
  expect(area(flat)).toBeGreaterThan(area(polytope3dSvg(ASSOCIAHEDRON, 4, { selected: [facet] })));
  // A rotation, so nothing is added or lost.
  expect(count(flat, "circle")).toBe(14);
});

test("a selection survives the round trip through an attribute", () => {
  expect(parseFaces("1,1,2;2,1,1")).toEqual([
    [1, 1, 2],
    [2, 1, 1],
  ]);
  expect(spellFaces(parseFaces(" 1,1,2 ; 2,1,1 "))).toBe("1,1,2;2,1,1");
  expect(parseFaces("")).toEqual([]);
  // A half-typed attribute keeps the rest of the selection rather than rendering nothing.
  expect(parseFaces("1,1,2;;oops")).toEqual([[1, 1, 2]]);
});

test("clicking the same mark twice backs out of the selection", () => {
  const a = [1, 1, 2];
  const b = [2, 1, 1];
  expect(toggleFace([], a)).toEqual([a]);
  expect(toggleFace([a], b)).toEqual([a, b]);
  expect(toggleFace([a, b], a)).toEqual([b]);
  // By VALUE — a face read back out of an attribute is a different array object.
  expect(toggleFace([a], [1, 1, 2])).toEqual([]);
});

test("a clicked mark names the face that drew it", () => {
  // The handler reads `data-face` off the mark, so what a click can select is exactly what the
  // picture drew — this is the contract between the two halves.
  const svg = polytope3dSvg(P, 4, { selected: [[1, 1, 2, 2]] });
  const marks = [...svg.matchAll(/data-face="([^"]*)"/g)].map((m) => parseFaces(m[1]!)[0]!);
  expect(marks).toContainEqual([1, 1, 2, 2]);
  for (const face of marks) expect(P.dimension(face)).toBeGreaterThanOrEqual(0);
});

test("labels are keyed by cell dimension, the way MeshCellLabel is", () => {
  const texts = (svg: string): string[] =>
    [...svg.matchAll(/<text [^>]*>([^<]*)<\/text>/g)]
      .map((m) => m[1]!)
      .filter((t) => t !== "Permutahedron");

  // The resting default labels the selection only: 45 labels at once is not a picture.
  expect(texts(polytope3dSvg(P, 4))).toEqual([]);
  expect(texts(polytope3dSvg(P, 4, { selected: [[1, 1, 2, 2]] }))).toEqual(["1,1,2,2"]);
  expect(texts(polytope3dSvg(P, 4, { labels: "none", selected: [[1, 1, 2, 2]] }))).toEqual([]);
  // A stratum at a time: the 24 vertices, and nothing else.
  expect(texts(polytope3dSvg(P, 4, { labels: [0] })).length).toBe(24);
  expect(texts(polytope3dSvg(P, 4, { labels: [0, 2] })).length).toBe(24 + 14);
  expect(texts(polytope3dSvg(P, 4, { labels: "all" })).length).toBe(24 + 36 + 14);
});

test("a label can say what the face IS, or merely count it", () => {
  const texts = (options: Parameters<typeof polytope3dSvg>[2]): string[] =>
    faceLabels(polytope3dSvg(P, 3, options));

  // `data` is the face's own carrier element — the thing it is, not a name given to it.
  expect(texts({ labels: [0], labelForm: "data" })).toContain("1,2,3");
  // `index` counts WITHIN the stratum, so the six vertices are 1…6.
  expect(texts({ labels: [0], labelForm: "index" })).toEqual(["1", "2", "3", "4", "5", "6"]);
  expect(texts({ labels: [1], labelForm: "dimension" })).toEqual(Array(6).fill("1"));
  // The hexagon has six vertices, and says so.
  expect(texts({ labels: [2], labelForm: "vertices" })).toEqual(["6"]);
});

test("label attributes are read leniently", () => {
  expect(parseLabelWhich(undefined)).toBe("none");
  expect(parseLabelWhich("ALL")).toBe("all");
  expect(parseLabelWhich("selected")).toBe("selected");
  expect(parseLabelWhich("0, 2")).toEqual([0, 2]);
  expect(parseLabelWhich("nonsense")).toBe("none");
  expect(parseLabelForm("INDEX")).toBe("index");
  expect(parseLabelForm("nonsense")).toBe("data");
});

test("a label does not swallow the click meant for the face beneath it", () => {
  // Labels sit on top of the marks they name; if they took pointer events, labelling a face
  // would make it unselectable.
  const svg = polytope3dSvg(P, 4, { labels: "all" });
  const labels = svg.match(/<text class="notatio-face-label"[^>]*>/g) ?? [];
  expect(labels.length).toBe(24 + 36 + 14);
  for (const text of labels) expect(text, "labels are inert").toContain('pointer-events="none"');
});
