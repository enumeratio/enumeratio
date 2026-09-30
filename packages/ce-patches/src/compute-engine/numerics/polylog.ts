// Polylogarithm Liₛ(z) -- pure numeric kernel, no compute-engine imports. Widening the
// native PolyLog(s, z) to a non-integer or complex order s lives in
// library/special-functions.ts, which calls polyLog below.
import { type Cx, mul } from "./complex-arithmetic.ts";
import { lerchPhi } from "./lerch-phi.ts";

// Liₛ(z) = Σ_{n≥1} zⁿ/nˢ, as the Lerch transcendent at a = 1: Liₛ(z) = z·Φ(z, s, 1).
// compute-engine has a native PolyLog(s, z), but it evaluates only at integer order s;
// the widening in library/special-functions.ts fills in non-integer and complex orders
// from this series, which covers |z| < 1 strictly. Past the open disk, that widening goes
// through the same continuation LerchPhi uses (lerch-phi-continuation.ts).

/** Liₛ(z) = z·Φ(z, s, 1) for complex s, z. NaN outside |z| ≤ 1 (no continuation). */
export const polyLog = (s: Cx, z: Cx): Cx => mul(z, lerchPhi(z, s, { re: 1, im: 0 }));

/** Real-valued Liₛ(z) for real s, z — the real-scalar shape the compiled
 * (JS/GPU) plotting pipeline consumes. */
export const polyLogReal = (s: number, z: number): number => polyLog({ re: s, im: 0 }, { re: z, im: 0 }).re;
