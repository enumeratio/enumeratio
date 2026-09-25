// Pin the p-adic core against Sage's Zp/Qp — expansions, valuations, square roots and
// arithmetic at a fixed precision — and write tests/adic.golden.json. `vp test` reads the
// committed file and needs no oracle; this script does. Sage only does PRIME p, so the
// composite-base cases in the test file are pinned by their algebraic invariants instead.
//
// Requires `sage` on PATH. Run from the package:
//   node scripts/collect-adic-golden.ts

import { writeFileSync } from "node:fs";
import * as adic from "../src/adic.ts";
import { runKernel } from "@enumeratio/oracle/bounded";

const PREC = 12;

/** Rationals to expand in each prime, with their Sage spelling. */
const RATIONALS = ["-1", "1/3", "-1/3", "2/7", "1/25", "7/25", "-4/9", "100", "0", "3/50"];
const PRIMES = [2, 3, 5, 7, 11];
const SQRTS: [number, number][] = [
  [2, 17],
  [2, -7],
  [3, 7],
  [5, 6],
  [7, 2],
  [7, 9],
  [11, 3],
  [13, 10],
];

interface Golden {
  readonly expansions: { p: number; x: string; digits: number[]; valuation: number }[];
  readonly sqrts: { p: number; x: number; root: string }[];
  readonly products: { p: number; x: string; y: string; value: string }[];
}

// One Sage session: digits from the valuation upward (`expansion()` on the unit part
// gives exactly that), the valuation, a square root's integer representative,
// and a product's representative — all modulo p^PREC.
const code = `
import json
out = {"expansions": [], "sqrts": [], "products": []}
for p in ${JSON.stringify(PRIMES)}:
    K = Qp(p, ${PREC})
    for x in ${JSON.stringify(RATIONALS)}:
        v = K(QQ(x))
        if v == 0:
            out["expansions"].append({"p": int(p), "x": x, "digits": [0]*int(${PREC}), "valuation": None})
            continue
        digits = [int(d) for d in list(v.unit_part().expansion())[:${PREC}]]
        out["expansions"].append({"p": int(p), "x": x, "digits": digits, "valuation": int(v.valuation())})
    for x, y in [("1/3", "-4/9"), ("2/7", "7/25"), ("100", "1/25"), ("-1", "-1")]:
        z = K(QQ(x)) * K(QQ(y))
        out["products"].append({"p": int(p), "x": x, "y": y, "value": str(z.lift())})
for p, x in ${JSON.stringify(SQRTS)}:
    R = Zp(p, ${PREC}, type="capped-abs")
    try:
        r = R(x).sqrt()
        out["sqrts"].append({"p": int(p), "x": int(x), "root": str(r.lift())})
    except ValueError:
        out["sqrts"].append({"p": int(p), "x": int(x), "root": None})
print(json.dumps(out, default=int))
`;

const output = await runKernel("sage", ["-c", code]);
const golden = JSON.parse(output.trim().split("\n").at(-1) ?? "{}") as Golden;

const disagree: string[] = [];
const parseRational = (s: string): [bigint, bigint] => {
  const [n, d = "1"] = s.split("/");
  return [BigInt(n!), BigInt(d)];
};

for (const c of golden.expansions) {
  const x = adic.exact(BigInt(c.p), ...parseRational(c.x));
  if (x === undefined) {
    disagree.push(`exact(${c.p}, ${c.x}) undefined`);
    continue;
  }
  const ours = adic.expansion(x, PREC);
  if (c.valuation !== null && ours.start !== c.valuation) {
    disagree.push(`valuation ${c.p}-adic ${c.x}: ours=${ours.start} sage=${c.valuation}`);
  }
  if (JSON.stringify(ours.digits) !== JSON.stringify(c.digits)) {
    disagree.push(`digits ${c.p}-adic ${c.x}: ours=${ours.digits.join("")} sage=${c.digits.join("")}`);
  }
}

for (const c of golden.sqrts) {
  const root = adic.sqrt(adic.exact(BigInt(c.p), BigInt(c.x), 1n)!, PREC);
  const ours = root === undefined ? null : root.num.toString();
  // Sage picks one of the two square roots; either is right.
  const negated = root === undefined ? null : adic.negate(root)?.num.toString();
  if (ours !== c.root && negated !== c.root) {
    disagree.push(`sqrt(${c.x}) in Z_${c.p}: ours=${ours} sage=${c.root}`);
  }
}

writeFileSync(new URL("../tests/adic.golden.json", import.meta.url), JSON.stringify(golden, null, 2) + "\n");

const total = golden.expansions.length + golden.sqrts.length;
console.log(`cases ${total}  |  agree ${total - disagree.length}  disagree ${disagree.length}`);
if (disagree.length) {
  console.log("\n--- DISAGREEMENTS ---");
  for (const d of disagree) console.log("  " + d);
  process.exitCode = 1;
}
