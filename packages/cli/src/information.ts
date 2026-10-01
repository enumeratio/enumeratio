// `?Name` and `??Name` at the prompt: what `About(Name)` says, as text (Wolfram's `?`/`??`).
// `?` is the name, kind, summary, signature and page; `??` adds every overload, parameters
// with their defaults, attributes, the documenting packages, FindStat ids, examples and, for a
// library symbol, its pin. A name with `*` lists the heads it matches.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { aboutRecord } from "@enumeratio/evaluation";
import { loadSummaries, matching } from "@enumeratio/manifest";
import { bold, cyan, dim } from "./ansi.ts";

const text = (v: unknown): string => (typeof v === "string" ? v : JSON.stringify(v));
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(text) : v === undefined ? [] : [text(v)]);
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Every head's summary, imported once in the background: `?Name` answers synchronously. */
export const summariesLoaded: Promise<void> = loadSummaries();

/** The text for a `?` line: `?Name`, `??Name` or `?Glob*`. */
export function information(ce: ComputeEngine, line: string, color = true): string {
  const long = line.startsWith("??");
  const name = line.slice(long ? 2 : 1).trim();
  if (!name) throw new Error("usage: ?Name, ??Name or ?Pattern*");
  if (name.includes("*")) {
    const found = matching(name);
    return found.length === 0 ? dim(`  no head matches ${name}`, color) : `  ${found.join("  ")}`;
  }
  const about = aboutRecord(ce, name);
  if (about.kind === "symbol" && about.type === "unknown") return dim(`  ${name}: nothing is known about it`, color);
  const lines = [`  ${bold(name, color)}  ${dim(text(about.kind), color)}`];
  if (about.description !== undefined) lines.push(`  ${text(about.description)}`);
  const signature = about.signature ?? about.type;
  if (signature !== undefined) lines.push(`  ${cyan(text(signature), color)}`);
  if (long) lines.push(...details(about, color));
  if (about.url !== undefined) lines.push(dim(`  ${text(about.url)}`, color));
  return lines.join("\n");
}

function details(about: Record<string, unknown>, color: boolean): string[] {
  const out: string[] = [];
  const row = (label: string, value: string): void => {
    out.push(`  ${dim(label.padEnd(11), color)}${value}`);
  };
  const overloads = Array.isArray(about.overloads) ? about.overloads.map(record) : [];
  if (overloads.length > 0) {
    out.push(dim("  overloads", color));
    for (const o of overloads) {
      const filters = [
        o.overrides === undefined ? "" : `replaces ${text(o.overrides)}`,
        o.on === undefined ? "" : `on ${list(o.on).join(", ")}`,
        o.symbols === undefined ? "" : `on symbols ${list(o.symbols).join(", ")}`,
        o.types === undefined ? "" : `on types ${list(o.types).join(", ")}`,
      ].filter(Boolean);
      out.push(
        `    ${text(o.package).padEnd(16)}${text(o.type ?? "")}${filters.length ? dim(`  (${filters.join("; ")})`, color) : ""}`,
      );
    }
  }
  const defaults = record(about.defaults);
  const params = list(about.params);
  if (params.length > 0)
    row("params", params.map((p) => (p in defaults ? `${p} = ${text(defaults[p])}` : p)).join(", "));
  if (list(about.attributes).length > 0) row("attributes", list(about.attributes).join(", "));
  if (list(about.documented).length > 0) row("documented", list(about.documented).join(", "));
  const findstat = Array.isArray(about.findstat) ? about.findstat.map(record) : [];
  if (findstat.length > 0)
    row(
      "findstat",
      findstat.map((f) => (f.on === undefined ? text(f.id) : `${text(f.id)} on ${text(f.on)}`)).join(", "),
    );
  if (about.examples !== undefined) row("examples", list(about.examples).join("   "));
  if (about.keywords !== undefined) row("keywords", list(about.keywords).join(", "));
  if (about.triggers !== undefined) row("written", list(about.triggers).join(", "));
  for (const key of ["namespace", "pin", "head", "package"] as const)
    if (about[key] !== undefined) row(key, text(about[key]));
  const requires = record(about.requires);
  for (const [used, pin] of Object.entries(requires)) row("requires", `${used} ${dim(text(pin), color)}`);
  return out;
}
