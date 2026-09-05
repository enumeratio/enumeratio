// Differential oracle for @enumeratio/math: every ported primitive that has an SQL twin must return the exact
// same value as its twin, across a range of inputs. Mirrors the style of packages/data/selfcert.mts (accelerated
// == naive), but here the two sides are TS == SQL rather than two SQL paths.
//
//   node --import tsx selfcert-math.mts
//
// @enumeratio/math itself stays zero-dependency; this script is the one place in the package that boots the SQL
// core (via @enumeratio/data/node, a devDependency) to check TS against it.

import { bootCore } from "@enumeratio/data/node";
import * as M from "./src/index.js";

const pg = await bootCore();
const q = async (sql: string): Promise<string[][]> => (await pg.query(sql)).rows.map((r: any) => Object.values(r).map(String));

let checked = 0;
const mismatches: string[] = [];

function record(label: string, expected: unknown, got: unknown) {
  checked++;
  if (String(expected) !== String(got)) mismatches.push(`${label}: SQL=${expected} TS=${got}`);
}

// ---- number theory ----
for (let a = -15; a <= 15; a++) {
  for (let b = -15; b <= 15; b++) {
    const [[sql]] = await q(`SELECT gcd_int(${a},${b})::text`);
    record(`gcd_int(${a},${b})`, sql, M.gcd_int(a, b));
  }
}
for (let b = -5; b <= 5; b++) {
  for (let e = 0; e <= 8; e++) {
    if (b === 0 && e === 0) continue; // 0^0 — pow_int loop gives 1 either side, skip nothing actually; keep for parity
    const [[sql]] = await q(`SELECT pow_int(${b},${e})::text`);
    record(`pow_int(${b},${e})`, sql, M.pow_int(b, e));
  }
}
for (let n = 0; n <= 12; n++) {
  const [[sql]] = await q(`SELECT double_factorial_odd(${n})::text`);
  record(`double_factorial_odd(${n})`, sql, M.double_factorial_odd(n));
}

// ---- combinat ----
for (let n = 0; n <= 15; n++) {
  const [[sql]] = await q(`SELECT factorial(${n})::text`);
  record(`factorial(${n})`, sql, M.factorial(n));
}
for (let n = 0; n <= 20; n++) {
  const [[sql]] = await q(`SELECT factorial_bigint(${n})::text`);
  record(`factorial_bigint(${n})`, sql, M.factorial_bigint(n));
}
for (let n = 0; n <= 30; n++) {
  for (let k = -1; k <= n + 1; k++) {
    const [[sql]] = await q(`SELECT binomial(${n},${k})::text`);
    record(`binomial(${n},${k})`, sql, M.binomial(n, k));
  }
}
for (let n = 0; n <= 40; n++) {
  for (let k = -1; k <= n + 1; k++) {
    const [[sql]] = await q(`SELECT binomial_bigint(${n},${k})::text`);
    record(`binomial_bigint(${n},${k})`, sql, M.binomial_bigint(n, k));
  }
}
for (let n = 0; n <= 18; n++) {
  const [[sql]] = await q(`SELECT bell(${n})::text`);
  record(`bell(${n})`, sql, M.bell(n));
}
for (let n = 0; n <= 15; n++) {
  const [[sql]] = await q(`SELECT fubini(${n})::text`);
  record(`fubini(${n})`, sql, M.fubini(n));
}
for (let n = 0; n <= 15; n++) {
  for (let k = 0; k <= n + 1; k++) {
    const [[sql]] = await q(`SELECT stirling_second(${n},${k})::text`);
    record(`stirling_second(${n},${k})`, sql, M.stirling_second(n, k));
  }
}
for (let n = 0; n <= 40; n++) {
  const [[sql]] = await q(`SELECT partition_number(${n})::text`);
  record(`partition_number(${n})`, sql, M.partition_number(n));
}

// ---- catalan family ----
for (let k = 0; k <= 20; k++) {
  const [[sql]] = await q(`SELECT catalan_number(${k})::text`);
  record(`catalan_number(${k})`, sql, M.catalan_number(k));
}
for (let m = 0; m <= 15; m++) {
  const [[sql]] = await q(`SELECT little_schroder_number(${m})::text`);
  record(`little_schroder_number(${m})`, sql, M.little_schroder_number(m));
}

// ---- gaussian integers ----
const gpts: M.GaussianInteger[] = [
  { re: 0, im: 0 }, { re: 1, im: 0 }, { re: 0, im: 1 }, { re: -1, im: -1 },
  { re: 3, im: -4 }, { re: -7, im: 2 }, { re: 5, im: 5 }, { re: -2, im: 3 },
];
const grow = (g: M.GaussianInteger) => `ROW(${g.re},${g.im})::gaussian_integer`;
for (const a of gpts) {
  for (const b of gpts) {
    {
      const [[sql]] = await q(`SELECT (gaussian_add(${grow(a)},${grow(b)})).re::text || ',' || (gaussian_add(${grow(a)},${grow(b)})).im::text`);
      const r = M.gaussian_add(a, b);
      record(`gaussian_add(${a.re}+${a.im}i,${b.re}+${b.im}i)`, sql, `${r.re},${r.im}`);
    }
    {
      const [[sql]] = await q(`SELECT (gaussian_sub(${grow(a)},${grow(b)})).re::text || ',' || (gaussian_sub(${grow(a)},${grow(b)})).im::text`);
      const r = M.gaussian_sub(a, b);
      record(`gaussian_sub(${a.re}+${a.im}i,${b.re}+${b.im}i)`, sql, `${r.re},${r.im}`);
    }
    {
      const [[sql]] = await q(`SELECT (gaussian_mul(${grow(a)},${grow(b)})).re::text || ',' || (gaussian_mul(${grow(a)},${grow(b)})).im::text`);
      const r = M.gaussian_mul(a, b);
      record(`gaussian_mul(${a.re}+${a.im}i,${b.re}+${b.im}i)`, sql, `${r.re},${r.im}`);
    }
  }
  const [[sql]] = await q(`SELECT (gaussian_neg(${grow(a)})).re::text || ',' || (gaussian_neg(${grow(a)})).im::text`);
  const r = M.gaussian_neg(a);
  record(`gaussian_neg(${a.re}+${a.im}i)`, sql, `${r.re},${r.im}`);
  const [[sqln]] = await q(`SELECT gaussian_norm(${grow(a)})::text`);
  record(`gaussian_norm(${a.re}+${a.im}i)`, sqln, M.gaussian_norm(a));
}

// ---- multicomplex ----
const mcRow = (z: M.Multicomplex) => `ROW(ARRAY[${z.coeffs.join(",")}],${z.modulus})::multicomplex`;
const mcs: M.Multicomplex[] = [
  { coeffs: [3], modulus: 5 },
  { coeffs: [0, 1], modulus: 5 },
  { coeffs: [1, 1], modulus: 5 },
  { coeffs: [3, 4], modulus: 5 },
  { coeffs: [0, 1, 0, 0], modulus: 5 },
  { coeffs: [0, 0, 1, 0], modulus: 5 },
  { coeffs: [1, 2, 0, 3], modulus: 5 },
  { coeffs: [4, 4, 4, 4], modulus: 5 },
  { coeffs: [1, 0, 0, 0], modulus: 7 },
  { coeffs: [2, 3, 1, 6], modulus: 7 },
];
const mcVal = (z: M.Multicomplex) => `(SELECT array_to_string((${mcRow(z)}).coeffs, ','))`;
for (const a of mcs) {
  for (const b of mcs) {
    if (a.coeffs.length !== b.coeffs.length) continue; // mc_* requires matching dimension (and here, modulus)
    if (a.modulus !== b.modulus) continue;
    for (const [label, sqlFn, tsFn] of [
      ["mc_add", "mc_add", M.mc_add],
      ["mc_sub", "mc_sub", M.mc_sub],
      ["mc_mul", "mc_mul", M.mc_mul],
    ] as const) {
      const [[sql]] = await q(`SELECT array_to_string((${sqlFn}(${mcRow(a)},${mcRow(b)})).coeffs, ',')`);
      const r = (tsFn as (a: M.Multicomplex, b: M.Multicomplex) => M.Multicomplex)(a, b);
      record(`${label}(${JSON.stringify(a)},${JSON.stringify(b)})`, sql, r.coeffs.join(","));
    }
  }
  const [[sqlNeg]] = await q(`SELECT array_to_string((mc_neg(${mcRow(a)})).coeffs, ',')`);
  record(`mc_neg(${JSON.stringify(a)})`, sqlNeg, M.mc_neg(a).coeffs.join(","));
  const [[sqlConj]] = await q(`SELECT array_to_string((mc_conj(${mcRow(a)})).coeffs, ',')`);
  record(`mc_conj(${JSON.stringify(a)})`, sqlConj, M.mc_conj(a).coeffs.join(","));
}

// ---- integer compositions (gap-cut bijection) ----
for (let n = 0; n <= 12; n++) {
  const total = n >= 1 ? 1 << (n - 1) : 1;
  for (let mask = 0; mask < total; mask++) {
    const [[sql]] = await q(`SELECT array_to_string((composition_from_mask(${n},${mask}::bigint)).parts, ',')`);
    record(`composition_from_mask(${n},${mask})`, sql, M.composition_from_mask(n, mask).join(","));
    // and the inverse round-trips back to the same mask (no separate SQL rank fn to twin against — see module header)
    record(`composition_rank(inverse of mask ${mask}, n=${n})`, mask, M.composition_rank(M.composition_from_mask(n, mask)));
  }
}

await pg.close();

console.log(`checked ${checked} cases across ${Object.keys(M).length} exports`);
if (mismatches.length) {
  console.error(`\n✗ ${mismatches.length} mismatch(es):`);
  for (const m of mismatches.slice(0, 50)) console.error(`  ${m}`);
  process.exit(1);
}
console.log("✓ all TS primitives agree with their SQL twins");
