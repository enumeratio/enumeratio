import { readFileSync, writeFileSync } from "node:fs";
import { loadReferenceData, PACKAGES } from "../src/node.ts";
import { ADOPTED } from "./wolfram-cache.ts";
import { mentions } from "./wolfram-examples.ts";
import { rewriteExamples } from "./triage-records.ts";

const adopted = JSON.parse(readFileSync(ADOPTED, "utf8")) as Record<string, string[]>;
const released: { head: string; id: string; role?: string; expr: unknown }[] = [];
for (const loaded of loadReferenceData(PACKAGES).heads) {
  const ids = new Set(adopted[loaded.head] ?? []);
  if (ids.size === 0) continue;
  await rewriteExamples(loaded, (example) => {
    if (!ids.has(example.id) || !mentions(example.expr, "ExponentialE")) return "keep";
    released.push({ head: loaded.head, id: example.id, role: example.role, expr: example.expr });
    return undefined;
  });
}
writeFileSync(process.argv[2]!, JSON.stringify(released, null, 1));
console.log(released.length, [...new Set(released.map((r) => r.head))].join(" "));
