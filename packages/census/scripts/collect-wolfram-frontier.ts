// Read Wolfram's own documentation examples for every symbol we map to, and record what
// they use that we cannot answer.
//
// The premise is that Wolfram's examples are a better feature backlog than our imagination:
// they are what the people who built the function thought was worth showing, they cover the
// call forms nobody thinks to ask about (`Subsets[Range[20], All, {69381}]` — the n-th
// subset without materialising the rest), and they are numerous enough to rank.
//
// Two things come out, and they are different questions:
//
//   CALL FORMS   what `Subsets` is shown doing, so we can see which arities and option
//                shapes our own `Subsets` does not take.
//   HEAD GAPS    every head those examples call, ranked by how often, minus what our engine
//                already answers under any spelling — `ArcTan` does not appear because it
//                is our `Arctan`. What is left is what we genuinely cannot do.
//
// Needs a kernel, so it is a script and not a test. Rerun with:
//
//   vp node packages/reference/scripts/collect-wolfram-frontier.ts

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { HEADS, isSystemName, STRUCTURAL, SYMBOLS } from "@enumeratio/wolfram/src";
import { bindings, fullEngine } from "../src/engine.ts";
import { runKernel } from "@enumeratio/oracle/bounded";

/** The Wolfram symbols we claim to map to — the sweep set, derived rather than listed so it
 *  grows with the head map instead of drifting from it. */
const targets = [...new Set([...Object.values(HEADS), ...Object.values(SYMBOLS)])]
  .filter((name) => /^[A-Z][A-Za-z0-9]*$/.test(name))
  .sort();

const work = mkdtempSync(join(tmpdir(), "wolfram-frontier-"));
const out = join(work, "examples.json");
// Wolfram lists are braces; a JSON array would read as function application and take the
// whole script down with it.
const wolframList = (items: readonly string[]): string =>
  `{${items.map((item) => JSON.stringify(item)).join(", ")}}`;

const script = `
syms = ${wolframList(targets)};
cellText[RawBoxes[Cell[BoxData[b_], ___]]] := Quiet@Check[
   StringReplace[ToString[ToExpression[b, StandardForm, Hold], InputForm],
     {StartOfString ~~ "Hold[" -> "", "]" ~~ EndOfString -> "", "\\n" -> " "}], "?"];
cellText[_] := "?";
grab[s_] := Module[{d},
   d = Quiet@Check[WolframLanguageData[s, "DocumentationExampleInputs"], $Failed];
   If[! ListQ[d], Return[<||>]];
   Association @@ Table[
     ToString[First[r]] -> DeleteCases[cellText /@ Flatten[Last[r]], "?"], {r, d}]];
Export[${JSON.stringify(out)}, Association @@ (# -> grab[#] & /@ syms), "JSON"];
`;
// `-file`, not `-code`: a script this long hits argument handling that silently drops the
// tail, and the only symptom is a missing output file.
const wl = join(work, "collect.wl");
writeFileSync(wl, script);
await runKernel("wolframscript", ["-file", wl], { timeoutMs: 1_800_000 });

type Examples = Record<string, Record<string, string[]>>;
const examples = JSON.parse(readFileSync(out, "utf8")) as Examples;

// Entity-backed heads (`GraphData`, `KnotData`) carry hundreds of examples that are all the
// same call with a different entity name, which would swamp the ranking with one head.
const ENTITY = /Data$/;

const uses = new Map<string, number>();
for (const [symbol, categories] of Object.entries(examples)) {
  if (ENTITY.test(symbol)) continue;
  for (const sources of Object.values(categories)) {
    for (const source of sources) {
      for (const [, head] of source.matchAll(/\b([A-Z][A-Za-z0-9]*)\s*\[/g)) {
        uses.set(head, (uses.get(head) ?? 0) + 1);
      }
    }
  }
}

/** What our engine answers, under our own spelling — bare compute-engine plus every
 *  library we ship. */
const answered = (): Set<string> =>
  new Set([...bindings(new ComputeEngine()), ...bindings(fullEngine())]);

const ours = answered();
/** Wolfram head → our head, for the heads we have under another name — a straight
 *  rename (`HEADS`) or a different call shape of one of our heads (`STRUCTURAL`,
 *  e.g. `Total` is our `Sum` given a plain list). */
const underAnotherName = new Map([
  ...Object.entries(HEADS)
    .filter(([ce, wl]) => ce !== wl && ours.has(ce))
    .map(([ce, wl]): [string, string] => [wl, ce]),
  ...Object.entries(STRUCTURAL)
    .filter(([, ce]) => ours.has(ce))
    .map(([wl, ce]): [string, string] => [wl, ce]),
]);

// Presentation and notebook heads say nothing about mathematical capability.
const PRESENTATION = new Set([
  "RowBox",
  "FormBox",
  "TemplateBox",
  "RawBoxes",
  "Cell",
  "BoxData",
  "SubscriptBox",
  "Hold",
  "Short",
  "Quiet",
  "Style",
  "Grid",
  "Row",
  "Column",
  "Framed",
  "Labeled",
  "Legended",
  "Placed",
  "Deploy",
  "Panel",
  "Dynamic",
  "Manipulate",
  "MatrixForm",
  "TableForm",
  "Text",
  "Show",
]);

interface FrontierEntry {
  readonly head: string;
  /** How many documentation examples call it. */
  readonly uses: number;
}

/** Below this, an entry is one example's incidental choice rather than a signal. */
const MIN_USES = 3;

const frontier: FrontierEntry[] = [...uses]
  .filter(([, n]) => n >= MIN_USES)
  .filter(([head]) => !PRESENTATION.has(head) && !ENTITY.test(head))
  // `System`` only. The rest is example-local scratch (`M`, `Cy`) mixed with resource
  // functions — `ResourceFunction["ZeckendorfRepresentation"]` and friends, which are a real
  // and relevant universe but a separate one from the language we map against.
  .filter(([head]) => isSystemName(head))
  // Answered under our own spelling — `ArcTan` is `Arctan`, `EulerPhi` is `Totient`, and the
  // head map already carries the row. Neither a gap nor a mapping to add.
  .filter(([head]) => !ours.has(head) && !underAnotherName.has(head))
  .map(([head, n]) => ({ head, uses: n }))
  .sort((a, b) => b.uses - a.uses || a.head.localeCompare(b.head));

/** Per-symbol call forms, for the symbols we do map — the "what does theirs take that ours
 *  does not" list. Basic and Scope only: the later categories are applications, which
 *  exercise other heads rather than this one's signature.
 *
 *  Trimmed hard. The question is which ARGUMENT SHAPES the symbol accepts, and a long
 *  example is always a demonstration of something else wrapped around the call — so drop
 *  those, and keep a handful per symbol rather than the whole page. */
const FORM_LIMIT = 10;
const FORM_LENGTH = 90;

const forms: Record<string, string[]> = {};
for (const [symbol, categories] of Object.entries(examples)) {
  if (ENTITY.test(symbol)) continue;
  const shown = [...(categories.BasicExamples ?? []), ...(categories.Scope ?? [])]
    .map((source) => source.replace(/\s+/g, " ").trim())
    .filter((source) => new RegExp(`^${symbol}\\s*\\[`).test(source))
    .filter((source) => source.length <= FORM_LENGTH);
  const distinct = [...new Set(shown)].slice(0, FORM_LIMIT);
  if (distinct.length > 0) forms[symbol] = distinct;
}

const swept = Object.keys(examples).length;
const exampleCount = Object.values(examples)
  .flatMap((categories) => Object.values(categories))
  .reduce((total, list) => total + list.length, 0);

const source = `// GENERATED by scripts/collect-wolfram-frontier.ts — do not edit by hand.
//
// What Wolfram's own documentation examples use, for the ${swept} symbols our head map
// claims — ${exampleCount} examples in all. Regenerate with a kernel on PATH:
//
//   vp node packages/reference/scripts/collect-wolfram-frontier.ts
//
// \`FRONTIER\` is the heads those examples call that our engine has no answer for, ranked by
// how often Wolfram reaches for them. A head we have under another name is excluded, so
// every entry here is a real gap rather than a spelling difference.
//
// \`CALL_FORMS\` is the other direction: what a symbol we DO map is shown doing, so the
// arities and argument shapes ours does not accept are visible next to it.

/** One head Wolfram's examples use that we do not answer. */
export interface FrontierEntry {
  readonly head: string;
  /** How many documentation examples call it. */
  readonly uses: number;
}

export const FRONTIER: readonly FrontierEntry[] = ${JSON.stringify(frontier, null, 2)};

/** Wolfram symbol → the call forms its Basic and Scope examples show. */
export const CALL_FORMS: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(forms, null, 2)};
`;

writeFileSync(new URL("../src/wolfram-frontier-data.ts", import.meta.url), source);
process.stdout.write(
  `wolfram-frontier-data.ts — ${swept} symbols, ${exampleCount} examples; ` +
    `${frontier.length} heads unanswered\n`,
);
