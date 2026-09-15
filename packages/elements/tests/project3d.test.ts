import { expect, test } from "vite-plus/test";
import { axisBoxSvg, axisLabel, camera, farCorner, frameSvg, unitScale } from "../src/project3d.ts";

const count = (s: string, tag: string): number => s.split(`<${tag}`).length - 1;

/**
 * The straight-on view: azimuth 0, elevation 0. cos/sin land on 0 and 1, so
 * every projected coordinate is hand-derivable. With W=360, H=260, pad=24 the
 * unit cube spans 1 in both projected axes, so the fit scale is
 * min(312, 212) = 212 and the cube's centre sits at (180, 130):
 * x = 0 → 74, x = 1 → 286; z = 0 → 236, z = 1 → 24; depth = y − ½.
 */
const flat = () => camera({ azimuth: 0, elevation: 0 });

test("the straight-on view projects the cube's corners onto exact coordinates", () => {
  const cam = flat();
  expect(cam.at(0, 0, 0)).toEqual({ x: 74, y: 236, depth: -0.5 });
  expect(cam.at(1, 0, 0)).toEqual({ x: 286, y: 236, depth: -0.5 });
  expect(cam.at(0, 0, 1)).toEqual({ x: 74, y: 24, depth: -0.5 });
  expect(cam.at(0.5, 0.5, 0.5)).toEqual({ x: 180, y: 130, depth: 0 });
});

test("depth grows toward the viewer along y at elevation 0", () => {
  const cam = flat();
  expect(cam.at(0, 1, 0).depth).toBeGreaterThan(cam.at(0, 0, 0).depth);
  // With no tilt, height contributes nothing to depth.
  expect(cam.at(0, 0, 1).depth).toBe(cam.at(0, 0, 0).depth);
});

test("elevation tilts height into the depth ordering", () => {
  const cam = camera({ azimuth: 0, elevation: 90 });
  expect(cam.at(0, 0, 1).depth).toBeGreaterThan(cam.at(0, 0, 0).depth);
});

test("azimuth 90 swaps the screen axes", () => {
  const cam = camera({ azimuth: 90, elevation: 0 });
  // u = −(y − ½), so +y now runs to the left and +x toward the viewer.
  expect(cam.at(0, 1, 0).x).toBeCloseTo(74, 9);
  expect(cam.at(1, 0, 0).depth).toBeCloseTo(0.5, 9);
});

test("project agrees with at", () => {
  const cam = camera({ azimuth: 37, elevation: 19 });
  expect(cam.project({ x: 0.3, y: 0.7, z: 0.2 })).toEqual(cam.at(0.3, 0.7, 0.2));
});

test("the whole cube fits inside the padded frame at any view", () => {
  for (const azimuth of [0, 30, 45, 137, 300]) {
    for (const elevation of [-60, 0, 25, 80]) {
      const cam = camera({ azimuth, elevation });
      for (const x of [0, 1])
        for (const y of [0, 1])
          for (const z of [0, 1]) {
            const p = cam.at(x, y, z);
            expect(p.x).toBeGreaterThanOrEqual(24 - 1e-9);
            expect(p.x).toBeLessThanOrEqual(336 + 1e-9);
            expect(p.y).toBeGreaterThanOrEqual(24 - 1e-9);
            expect(p.y).toBeLessThanOrEqual(236 + 1e-9);
          }
    }
  }
});

test("zoom magnifies about the frame's centre", () => {
  const one = camera({ azimuth: 0, elevation: 0 });
  const two = camera({ azimuth: 0, elevation: 0, zoom: 2 });
  expect(two.at(0.5, 0.5, 0.5)).toEqual(one.at(0.5, 0.5, 0.5));
  // Twice the scale: the corner sits twice as far from the centre.
  expect(two.at(0, 0, 0).x).toBe(180 - 2 * (180 - 74));
});

test("elevation is clamped to a view that still has a floor", () => {
  const a = camera({ azimuth: 0, elevation: 900 });
  const b = camera({ azimuth: 0, elevation: 89 });
  expect(a.at(0.2, 0.4, 0.6)).toEqual(b.at(0.2, 0.4, 0.6));
});

test("unitScale maps a range onto [0, 1] and a flat range to the middle", () => {
  expect(unitScale(0, 10)(5)).toBe(0.5);
  expect(unitScale(4, 4)(4)).toBe(0.5);
  expect(unitScale(4, 1)(99)).toBe(0.5);
});

test("axisLabel keeps small numbers plain and large ones exponential", () => {
  expect(axisLabel(0)).toBe("0");
  expect(axisLabel(1.234)).toBe("1.23");
  expect(axisLabel(5000)).toBe("5.0e+3");
  expect(axisLabel(Number.NaN)).toBe("");
});

// ---------------------------------------------------------------------------
// axis box
// ---------------------------------------------------------------------------

test("the axis box draws a floor and three edges from the far corner", () => {
  const box = axisBoxSvg(camera({ azimuth: 30, elevation: 25 }));
  expect(count(box, "polygon")).toBe(1);
  expect(count(box, "line")).toBe(3);
  // No labels unless ends are given.
  expect(count(box, "text")).toBe(0);
});

test("axis ends are labelled at each edge's free end", () => {
  const box = axisBoxSvg(camera({ azimuth: 30, elevation: 25 }), {
    xEnd: 3,
    yEnd: 4,
    zEnd: 5,
  });
  expect(count(box, "text")).toBe(3);
  expect(box).toContain(">3<");
  expect(box).toContain(">5<");
});

test("floor:false drops the floor outline but keeps the edges", () => {
  const box = axisBoxSvg(camera({}), { floor: false });
  expect(count(box, "polygon")).toBe(0);
  expect(count(box, "line")).toBe(3);
});

test("the far corner is the floor corner with the least depth", () => {
  const cam = camera({ azimuth: 0, elevation: 25 });
  const [bx, by] = farCorner(cam);
  const depth = cam.at(bx, by, 0).depth;
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ])
    expect(cam.at(x, y, 0).depth).toBeGreaterThanOrEqual(depth);
});

test("frameSvg emits a viewBox and no fixed width", () => {
  const s = frameSvg(360, 260, "test figure", "<g/>");
  expect(s).toContain('viewBox="0 0 360 260"');
  expect(s).toContain('aria-label="test figure"');
  expect(s).not.toContain("width=");
});

test("determinism: the same view projects identically twice", () => {
  const a = camera({ azimuth: 33, elevation: 17, zoom: 1.4 });
  const b = camera({ azimuth: 33, elevation: 17, zoom: 1.4 });
  expect(a.at(0.31, 0.62, 0.17)).toEqual(b.at(0.31, 0.62, 0.17));
  expect(axisBoxSvg(a, { xEnd: 1, yEnd: 2, zEnd: 3 })).toBe(
    axisBoxSvg(b, { xEnd: 1, yEnd: 2, zEnd: 3 }),
  );
});
