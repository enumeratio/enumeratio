// Pin our own forms in examples.tsv by rule, keeping any pin already there, then refresh every
// pin as collect-forms does. Rerun it to restore the pins after taking another branch's side
// of an examples.tsv conflict:
//
//   node packages/frontend/scripts/pin-forms.ts
//
// The rules, over examples not in triage:
//   R1  every `back` and `backOut`: an `in` or `out` that doesn't read back as the example or
//       its result (always; forms.test.ts requires them).
//   R2  per package, the first example (page order) of its first head by name whose result
//       differs from its input: every form's `in` and `out`.
//   R3  the result is the canonical form of the input, unevaluated (raw `expected` equals
//       canonical `expr`, which differs from raw `expr`): `fullform.in` and `fullform.out`.
//   R4  a captioned example whose `expr` holds ExponentialE: `epsil.in` and `fullform.in`,
//       Euler's e apart from a variable.
// R2 and R3 skip examples naming ExponentialE, ImaginaryUnit, `e` or `i`.

import { orderImplementations, OWN_FORMS } from "@enumeratio/entry";
import { updateHead } from "@enumeratio/entry/node";
import { SYSTEMS } from "@enumeratio/oracle";
import { loadReferenceData, PACKAGES } from "@enumeratio/reference/node";
import { declaredEngine } from "../../reference/scripts/engines.ts";
import { headForms, recordWithForms } from "./forms.ts";

const ce = declaredEngine();
const { heads, issues } = loadReferenceData(PACKAGES);
if (issues.length > 0) throw new Error(JSON.stringify(issues, null, 2));

const mentions = (json: unknown, names: readonly string[]): boolean =>
  typeof json === "string" ? names.includes(json) : Array.isArray(json) && json.some((c) => mentions(c, names));
const CONSTANTS = ["ExponentialE", "ImaginaryUnit", "e", "i"];
const raw = (json: unknown): string => JSON.stringify(ce.box(json as never, { form: "raw" }).json);
const canonical = (json: unknown): string | undefined => {
  try {
    return JSON.stringify(ce.box(json as never).json);
  } catch {
    return undefined;
  }
};

const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const firstHead = new Map<string, string>();
for (const h of [...heads].toSorted((a, b) => byName(a.head, b.head)))
  if (!firstHead.has(h.package) && h.entry.examples.some((e) => e.role !== "triage")) firstHead.set(h.package, h.head);

let written = 0;
for (const h of heads) {
  const forms = headForms(h.entry.examples);
  const record: Record<string, Record<string, Record<string, unknown>>> = JSON.parse(
    JSON.stringify(h.implementations ?? {}),
  );
  // A placeholder marks the field pinned; recordWithForms fills in what the printers make.
  const pin = (id: string, form: string, fields: readonly string[]) => {
    for (const field of fields)
      if ((forms[id]?.[form] as unknown as Record<string, unknown> | undefined)?.[field] !== undefined)
        ((record[id] ??= {})[form] ??= {})[field] ??= "";
  };
  let representative = firstHead.get(h.package) !== h.head;
  for (const e of h.entry.examples) {
    if (e.role === "triage") continue;
    const constants = mentions(e.expr, CONSTANTS) || mentions(e.expected, CONSTANTS);
    const [input, result] = [raw(e.expr), raw(e.expected)];
    if (!representative && !constants && input !== result) {
      for (const form of OWN_FORMS) pin(e.id, form, ["in", "out"]);
      representative = true;
    }
    if (!constants && input !== result && canonical(e.expr) === result) pin(e.id, "fullform", ["in", "out"]);
    if (e.caption !== undefined && mentions(e.expr, ["ExponentialE"])) {
      pin(e.id, "epsil", ["in"]);
      pin(e.id, "fullform", ["in"]);
    }
  }
  const next = orderImplementations(
    recordWithForms(h.entry.examples, record as never, forms),
    h.entry.examples.map((e) => e.id),
    SYSTEMS.map((s) => s.name),
  );
  const current = orderImplementations(
    h.implementations ?? {},
    h.entry.examples.map((e) => e.id),
    SYSTEMS.map((s) => s.name),
  );
  if (JSON.stringify(next) === JSON.stringify(current)) continue;
  await updateHead(h.dir, h.head, { implementations: Object.keys(next).length === 0 ? undefined : next });
  written++;
}
console.log(`${written} of ${heads.length} records rewritten`);
