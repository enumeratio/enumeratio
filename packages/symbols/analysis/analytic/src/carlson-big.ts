// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal } from "@enumeratio/engine/unstable";
import { atDigits } from "@enumeratio/ce-patches";

// The BigDecimal twin of carlson.ts for positive real arguments: the same duplication steps
// (DLMF 19.26), run until the arguments agree to the working digits. RC comes in closed form
// (DLMF 19.2.17-19), which is what RJ's sum calls. Anything outside the positive reals is
// declined, so the caller can stay unevaluated rather than print a double's digits as more.

const GUARD = 15;
const MAX_STEPS = 600;

const big = (x: number): BigDecimal => new BigDecimal(x);
const round = (x: BigDecimal): BigDecimal => x.toPrecision(BigDecimal.precision);

/** Have the values come together, to the working digits? */
function converged(values: readonly BigDecimal[]): boolean {
  const mu = values.reduce((a, b) => a.add(b)).div(values.length);
  const tol = big(10).pow(-(BigDecimal.precision - 2));
  return values.every((v) => v.sub(mu).abs().lte(mu.mul(tol)));
}

/** One duplication step: x ← (x + λ)/4, with λ built from the three roots. */
function duplicate(values: BigDecimal[]): { next: BigDecimal[]; roots: BigDecimal[]; lam: BigDecimal } {
  const roots = values.slice(0, 3).map((v) => v.sqrt());
  const [sx, sy, sz] = roots as [BigDecimal, BigDecimal, BigDecimal];
  const lam = round(sx.mul(sy).add(sy.mul(sz)).add(sz.mul(sx)));
  return { next: values.map((v) => round(v.add(lam).div(4))), roots, lam };
}

function rc(x: BigDecimal, y: BigDecimal): BigDecimal {
  if (x.isZero()) return round(BigDecimal.PI.div(y.sqrt().mul(2))); // DLMF 19.6.15
  // The Cauchy principal value for y < 0 < x (DLMF 19.2.20), which lands on y' < x'.
  if (y.isNegative())
    return round(
      x
        .div(x.sub(y))
        .sqrt()
        .mul(rc(x.sub(y), y.neg())),
    );
  const c = x.cmp(y);
  if (c === 0) return round(big(1).div(x.sqrt()));
  if (c < 0) {
    const d = y.sub(x);
    return round(round(y.sub(x).div(x).sqrt()).atan().div(d.sqrt()));
  }
  const d = x.sub(y);
  return round(round(d.div(x).sqrt()).atanh().div(d.sqrt()));
}

/** RF and RD at the caller's working precision (`atDigits`), for kernels built on them. */
export function rf(x0: BigDecimal, y0: BigDecimal, z0: BigDecimal): BigDecimal | undefined {
  let v = [x0, y0, z0];
  for (let i = 0; i < MAX_STEPS; i++) {
    if (converged(v))
      return round(
        big(1).div(
          v
            .reduce((a, b) => a.add(b))
            .div(3)
            .sqrt(),
        ),
      );
    v = duplicate(v).next;
  }
  return undefined;
}

export function rd(x0: BigDecimal, y0: BigDecimal, z0: BigDecimal): BigDecimal | undefined {
  let v = [x0, y0, z0];
  let sum = big(0);
  let fac = big(1);
  for (let i = 0; i < MAX_STEPS; i++) {
    if (converged(v)) {
      const mu = v.reduce((a, b) => a.add(b)).div(3);
      return round(sum.add(fac.div(mu.mul(mu.sqrt()))));
    }
    const { next, roots, lam } = duplicate(v);
    const sz = roots[2]!;
    sum = round(sum.add(fac.mul(3).div(sz.mul(v[2]!.add(lam)))));
    fac = fac.div(4);
    v = next;
  }
  return undefined;
}

function rj(x0: BigDecimal, y0: BigDecimal, z0: BigDecimal, p0: BigDecimal): BigDecimal | undefined {
  let v = [x0, y0, z0, p0];
  let sum = big(0);
  let fac = big(1);
  // δ stays at the original arguments (see carlson.ts's RJ).
  const delta = p0.sub(x0).mul(p0.sub(y0)).mul(p0.sub(z0));
  const floor = big(10).pow(-(BigDecimal.precision + 2));
  for (let i = 0; i < MAX_STEPS; i++) {
    const { next, roots } = duplicate(v);
    const sp = v[3]!.sqrt();
    const dm = round(sp.add(roots[0]!).mul(sp.add(roots[1]!)).mul(sp.add(roots[2]!)));
    const em = round(delta.mul(fac).mul(fac).mul(fac).div(dm.mul(dm)));
    const onePlus = big(1).add(em);
    if (!onePlus.isPositive()) return undefined;
    sum = round(sum.add(fac.mul(rc(big(1), onePlus)).div(dm)));
    fac = fac.div(4);
    v = next;
    if (fac.lt(floor)) return round(sum.mul(6));
  }
  return undefined;
}

function rg(x: BigDecimal, y: BigDecimal, z: BigDecimal): BigDecimal | undefined {
  const nonzero = [x, y, z].filter((v) => !v.isZero());
  if (nonzero.length === 0) return big(0);
  if (nonzero.length === 1) return round(nonzero[0]!.sqrt().div(2)); // RG(0,0,z) = √z/2
  // RG is symmetric: the largest argument plays the divisor (DLMF 19.21.10).
  const [a, b, c] = [x, y, z].toSorted((p, q) => p.cmp(q)) as [BigDecimal, BigDecimal, BigDecimal];
  const f = rf(a, b, c);
  const d = rd(a, b, c);
  if (f === undefined || d === undefined) return undefined;
  const term = c
    .mul(f)
    .sub(a.sub(c).mul(b.sub(c)).mul(d).div(3))
    .add(a.mul(b).div(c).sqrt());
  return round(term.div(2));
}

/**
 * Run `compute` at the digits asked for plus a guard, over nonnegative reals where `allowed`
 * says the zero pattern is one the function has a value at (RF and RJ lose it with two zeros
 * among x, y, z, RD at z = 0).
 */
function onNonNegatives(
  args: readonly BigDecimal[],
  digits: number,
  allowed: (zeros: readonly boolean[]) => boolean,
  compute: (...v: BigDecimal[]) => BigDecimal | undefined,
): BigDecimal | undefined {
  if (!args.every((a) => a.isFinite() && !a.isNegative())) return undefined;
  if (!allowed(args.map((a) => a.isZero()))) return undefined;
  return atDigits(digits + GUARD, () => compute(...args)?.toPrecision(digits));
}

/** At most one of the first three is zero. */
const fewZeros = (zeros: readonly boolean[]): boolean => zeros.slice(0, 3).filter(Boolean).length <= 1;

export const carlsonRFBig = (x: BigDecimal, y: BigDecimal, z: BigDecimal, digits: number) =>
  onNonNegatives([x, y, z], digits, fewZeros, rf);
export const carlsonRDBig = (x: BigDecimal, y: BigDecimal, z: BigDecimal, digits: number) =>
  onNonNegatives([x, y, z], digits, (zeros) => fewZeros(zeros) && !zeros[2], rd);
export const carlsonRGBig = (x: BigDecimal, y: BigDecimal, z: BigDecimal, digits: number) =>
  onNonNegatives([x, y, z], digits, () => true, rg);
export const carlsonRJBig = (x: BigDecimal, y: BigDecimal, z: BigDecimal, p: BigDecimal, digits: number) =>
  onNonNegatives([x, y, z, p], digits, (zeros) => fewZeros(zeros) && !zeros[3], rj);

/** RC over x ≥ 0 and y > 0, or x > 0 and y < 0 (the principal value). */
export function carlsonRCBig(x: BigDecimal, y: BigDecimal, digits: number): BigDecimal | undefined {
  if (!x.isFinite() || x.isNegative() || !y.isFinite() || y.isZero()) return undefined;
  if (x.isZero() && y.isNegative()) return undefined;
  return atDigits(digits + GUARD, () => rc(x, y).toPrecision(digits));
}
