// The worker behind `verify-fungrim.ts`: check a slice of Fungrim's compiled identities
// numerically and print one JSON line per rule.
//
// This runs in its own process because a single `.N()` can take minutes on a theta function
// or a hypergeometric series and cannot be interrupted from inside. The parent gives the
// process a deadline, reads the lines that made it out, and restarts after the rule that
// did not -- so one unevaluable identity costs one restart, not the run.
//
//   vp node packages/reference/scripts/check-fungrim-rule.ts <from> [engine]

import { ComputeEngine } from "@cortex-js/compute-engine";
import { FUNGRIM_CORE } from "@cortex-js/compute-engine/identities";
import { declareAnalytic } from "@enumeratio/analytic/src";
import { checkRule, type FungrimRule } from "./fungrim.ts";

const from = Number(process.argv[2] ?? 0);
const ce = new ComputeEngine();
declareAnalytic(ce);

const rules = FUNGRIM_CORE.rules as unknown as readonly FungrimRule[];
for (let i = from; i < rules.length; i++) {
  const outcome = checkRule(ce, rules[i]!);
  process.stdout.write(`${JSON.stringify({ i, ...outcome })}\n`);
}
