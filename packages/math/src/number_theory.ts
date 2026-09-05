// Number-theory primitives. Names/semantics mirror packages/data/sqlsrc/utilities.sql exactly (that file's
// header: "defined ONCE and early so any collection can use them") — this module is its pure-TS twin.

/** SQL twin: gcd_int(a int, b int) — Euclid's algorithm, always non-negative. */
export function gcd_int(a: number, b: number): number {
  a = Math.trunc(a);
  b = Math.trunc(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return Math.abs(a);
}

/** No SQL twin (utilities.sql has no lcm) — plain lcm(a,b) = |a*b| / gcd(a,b), 0 if either input is 0. */
export function lcm_int(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd_int(a, b);
}

/** SQL twin: pow_int(b int, e int) — exact integer power via repeated multiplication (no float ^ scaling). */
export function pow_int(b: number, e: number): number {
  let p = 1;
  for (let i = 1; i <= e; i++) p *= b;
  return p;
}

/** SQL twin: double_factorial_odd(n int) — (2n-1)!! = 1·3·5·…·(2n-1). */
export function double_factorial_odd(n: number): number {
  let p = 1;
  for (let i = 1; i <= n; i++) p *= 2 * i - 1;
  return p;
}
