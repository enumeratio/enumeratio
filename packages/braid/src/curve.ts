// Knots as curves in space, rather than as words.
//
// The combinatorial side of this package says what a knot *is*; these say where it goes,
// so a page can draw one. Both families here are the same list of knots by Ghys's
// theorem -- a torus knot is a positive braid closure, and the Lorenz template realises
// exactly those -- which is why they sit together.
//
// (Points in space are a graphics concern and this is not their permanent home; see
// design/graphics-and-space.md. They are here because this is the package that already
// knows what a torus knot and a Lorenz orbit are.)

/** A point in space. */
export type Point3 = readonly [number, number, number];

/**
 * The torus knot T(p, q): p turns around the axis of the torus while q turns through
 * its hole, traced on the tube of radius 1 about the circle of radius 2.
 */
export function torusKnotCurve(p: number, q: number, samples = 600): Point3[] {
  const n = Math.max(24, Math.min(4000, Math.round(samples)));
  const out: Point3[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const r = 2 + Math.cos(q * t);
    out.push([r * Math.cos(p * t), r * Math.sin(p * t), -Math.sin(q * t)]);
  }
  return out;
}

export interface LorenzOptions {
  steps?: number;
  dt?: number;
  start?: Point3;
  sigma?: number;
  rho?: number;
  beta?: number;
}

/**
 * A trajectory of the Lorenz system, by fourth-order Runge-Kutta. The classic parameters
 * (σ=10, ρ=28, β=8/3) are the ones whose attractor is the familiar pair of wings and
 * whose periodic orbits are the Lorenz knots.
 *
 * The opening stretch is discarded: that is the trajectory falling onto the attractor
 * from wherever it started, which is not part of the picture and drags the bounding box
 * out with it.
 */
export function lorenzCurve(options: LorenzOptions = {}): Point3[] {
  const steps = Math.max(100, Math.min(40000, Math.round(options.steps ?? 5000)));
  const dt = options.dt ?? 0.005;
  const sigma = options.sigma ?? 10;
  const rho = options.rho ?? 28;
  const beta = options.beta ?? 8 / 3;
  const f = (v: Point3): Point3 => [
    sigma * (v[1] - v[0]),
    v[0] * (rho - v[2]) - v[1],
    v[0] * v[1] - beta * v[2],
  ];
  const step = (v: Point3, k: Point3, h: number): Point3 => [
    v[0] + k[0] * h,
    v[1] + k[1] * h,
    v[2] + k[2] * h,
  ];
  const settle = Math.round(steps * 0.15);
  const out: Point3[] = [];
  let v: Point3 = options.start ?? [1, 1, 20];
  for (let i = 0; i < steps + settle; i++) {
    const k1 = f(v);
    const k2 = f(step(v, k1, dt / 2));
    const k3 = f(step(v, k2, dt / 2));
    const k4 = f(step(v, k3, dt));
    v = [
      v[0] + ((k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) * dt) / 6,
      v[1] + ((k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) * dt) / 6,
      v[2] + ((k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]) * dt) / 6,
    ];
    if (i >= settle) out.push(v);
  }
  return out;
}
