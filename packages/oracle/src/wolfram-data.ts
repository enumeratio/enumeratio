// Wolfram's curated data about its own functions, fetched from a kernel: the documentation's
// examples (WolframLanguageData), the function identities (MathematicalFunctionData), those
// identities instantiated at sample points, and the formula collection (FormulaData). Each
// source is one entity type and a list of properties; the kernel prints one JSON line per
// entity, and expressions come back as held FullForm, never evaluated, so an example's input is
// what the documentation typed.

import { runBounded } from "./bounded.ts";

export type WolframDataSource = "language" | "function" | "relation" | "formula";

/** One documented example group: its inputs as held FullForm (`HoldComplete[…]`), in order,
 * and the caption text beside it — Wolfram's prose, kept as a hint, never copied into a record. */
export interface DocumentationGroup {
  readonly inputs: readonly string[];
  readonly text: readonly string[];
}

/** WolframLanguageData: a symbol's documentation examples, by section (`BasicExamples`, `Scope`, …). */
export interface LanguageRecord {
  readonly name: string;
  readonly sections: Readonly<Record<string, readonly DocumentationGroup[]>>;
}

/** One instance of an identity: its left side held, its right side as the kernel evaluates it. */
export interface IdentityInstance {
  readonly lhs: string;
  readonly rhs: string;
}

/** MathematicalFunctionData: each property's raw values (InputForm), and the particular values
 * instantiated at small integer parameters where their conditions hold. */
export interface FunctionRecord {
  readonly name: string;
  readonly properties: Readonly<Record<string, readonly string[]>>;
  readonly particularValues: readonly IdentityInstance[];
}

/** One instance of a free-variable identity (a functional equation, a symmetry, a named
 * identity): the property it came from and its place there; `label` names a named identity. */
export interface RelationInstance extends IdentityInstance {
  readonly property: string;
  readonly index: number;
  readonly label?: string;
}

/** MathematicalFunctionData's free-variable identities, each instantiated at sample points. */
export interface RelationRecord {
  readonly name: string;
  readonly relations: readonly RelationInstance[];
}

/** FormulaData: one formula, raw. Every one is a physical or applied formula over
 * `QuantityVariable`s; none states an identity about a function. */
export interface FormulaRecord {
  readonly name: string;
  readonly formula: string;
}

export type WolframDataRecord = LanguageRecord | FunctionRecord | RelationRecord | FormulaRecord;

/** The MathematicalFunctionData properties kept raw; `ParticularValues` is also instantiated. */
export const FUNCTION_PROPERTIES = [
  "ParticularValues",
  "Zeros",
  "Residues",
  "ReflectionSymmetries",
  "FunctionalEquations",
  "LowOrderDerivatives",
  "SeriesRepresentations",
  "IntegralRepresentations",
  "NamedIdentities",
] as const;

// Entity lookups go over the network on a cold kernel; a batch is small enough that one slow
// fetch doesn't cost the rest, and each run is capped like every other kernel run. A function's
// identities take longest (every one instantiated), so they go a few at a time.
const BATCH: Record<WolframDataSource, number> = { language: 20, function: 4, relation: 4, formula: 50 };
const TIMEOUT_MS = 600_000;
/** Per function, and per right side it evaluates: past these the record goes without. */
const FUNCTION_SECONDS = 90;
const RHS_SECONDS = 2;

const list = (names: readonly string[]): string => `{${names.map((n) => JSON.stringify(n)).join(", ")}}`;

// Shared helpers: `fullform` of a held expression on one line, `emit` of one JSON record.
// An expression prints its named characters as `\\[FormalN]`, plain ASCII. A record goes out
// as base64 of its UTF-8 JSON: the kernel's own output encoding mangles Wolfram's private-use
// characters (\\[Conjugate]) in captions.
const PRELUDE = `
fullform[h_] := ToString[FullForm[h], PageWidth -> Infinity, CharacterEncoding -> "PrintableASCII"];
inputform[e_] := ToString[e, InputForm, PageWidth -> Infinity, CharacterEncoding -> "PrintableASCII"];
emit[name_, a_Association] := Print["<<", name, ">>", BaseEncode[StringToByteArray[ExportString[a, "RawJSON", "Compact" -> True], "UTF-8"]]];
`;

/** Wolfram source printing each symbol's documentation examples as a `LanguageRecord`. */
export function languageCode(names: readonly string[]): string {
  return `${PRELUDE}
held[RawBoxes[Cell[BoxData[b_], ___]]] := Quiet@Check[fullform[MakeExpression[b, StandardForm]], "$Failed"];
held[_] := "$Failed";
part[s_String] := s;
part[(StyleBox | ButtonBox)[s_, ___]] := part[s];
part[Cell[BoxData[b_], ___]] := Quiet@Check[ToString[ToExpression[b, StandardForm, HoldForm], InputForm], ""];
part[Cell[TextData[t_], ___]] := StringJoin[part /@ Flatten[{t}]];
part[_] := "";
text[RawBoxes[Cell[s_String, ___]]] := s;
text[RawBoxes[Cell[TextData[t_], ___]]] := StringJoin[part /@ Flatten[{t}]];
text[_] := "";
groups[ins_List, txt_] := MapIndexed[<|"inputs" -> (held /@ #1), "text" -> (text /@ If[ListQ[txt] && Length[txt] >= #2[[1]], txt[[#2[[1]]]], {}])|> &, ins];
Do[
  With[{e = Entity["WolframLanguageSymbol", n]},
    Module[{ins = Quiet[EntityValue[e, "DocumentationExampleInputs"]], txt = Quiet[EntityValue[e, "DocumentationExampleText"]]},
      If[ListQ[ins],
        emit[n, <|"name" -> n, "sections" -> Association[KeyValueMap[Function[{k, v}, k -> groups[v, Lookup[If[ListQ[txt], Association[txt], <||>], k, {}]]], Association[ins]]]|>],
        emit[n, <|"name" -> n, "missing" -> True|>]]]],
  {n, ${list(names)}}]`;
}

/** Wolfram source printing each function's identities as a `FunctionRecord`. A parametrised
 * particular value is instantiated at the first two integer tuples from 0..4 its condition
 * admits (one with no condition is an identity in a free variable, and is left out); its left side stays held, its right side is what Wolfram evaluates it to, in radicals where it can be (the data
 * states `Sin[Pi/12]` as a `Root` object, which we don't read). */
export function functionCode(names: readonly string[]): string {
  const props = `{${FUNCTION_PROPERTIES.map((p) => JSON.stringify(p)).join(", ")}}`;
  return `${PRELUDE}
strip[x_] := x //. Inactive[h_] :> h;
(* The instantiated arguments, worked out: Zeta[-1, 1], not Zeta[Times[-1, 1], 1]. *)
arithmetic[x_] := x /. Inactive[h : (Plus | Times | Power | Subtract | Divide | Minus | Rational)] :> h;
instance[f_Function, t_List] := Module[{b = Quiet[f @@ t], cond = True},
  b = b /. Inactive[ConditionalExpression][x_, c_] :> (cond = c; x);
  b = b /. ConditionalExpression[x_, c_] :> (cond = c; x);
  If[!TrueQ[Quiet[Activate[cond]]], Return[Nothing]];
  Replace[b, {
    Inactive[Equal][l_, r_] :> <|"lhs" -> fullform[strip[HoldComplete @@ {arithmetic[l]}]], "rhs" -> fullform[HoldComplete @@ {Quiet[TimeConstrained[ToRadicals[Activate[r]], ${RHS_SECONDS}, $Aborted]]}]|>,
    _ -> Nothing}]];
(* A parameter without a condition is a free variable -- an identity, not a particular value. *)
instances[f_Function] /; Length[First[f]] > 0 && FreeQ[f, ConditionalExpression] := {};
instances[f_Function] := Module[{k = Length[First[f]], found = {}},
  Do[If[Length[found] < 2, found = Join[found, {instance[f, t]}]], {t, If[k == 0, {{}}, Tuples[Range[0, 4], k]]}];
  found];
instances[_] := {};
Do[
  With[{e = Entity["MathematicalFunction", n]},
    Module[{vals = Quiet[EntityValue[e, ${props}]]},
      If[ListQ[vals],
        emit[n, <|"name" -> n,
          "properties" -> AssociationThread[${props}, Map[If[ListQ[#], inputform /@ #, {}] &, vals]],
          "particularValues" -> If[ListQ[vals[[1]]], TimeConstrained[Flatten[instances /@ vals[[1]]], ${FUNCTION_SECONDS}, {}], {}]|>],
        emit[n, <|"name" -> n, "missing" -> True|>]]]],
  {n, ${list(names)}}]`;
}

/** The MathematicalFunctionData properties holding free-variable identities. */
export const RELATION_PROPERTIES = ["FunctionalEquations", "ReflectionSymmetries", "NamedIdentities"] as const;
/** Sample values for a relation's variables, tried in order: non-integers first, so an
 * instance says more than a particular value does. */
const RELATION_POINTS = "{1/2, 2, 1/3, 3, 3/2, 1 + I, 5/2, -1/2, 1, 4}";
/** Per relation: the tuples tried, the instances kept, and the seconds spent. */
const RELATION_TRIES = 30;
const RELATION_INSTANCES = 2;
const RELATION_SECONDS = 20;

/** Wolfram source printing each function's free-variable identities as a `RelationRecord`.
 * A relation is instantiated at tuples of `RELATION_POINTS` its condition admits, and an
 * instance is kept only when Wolfram's right side is a closed form (no sum, integral or limit
 * left), its left side is more than the function at plain numbers (a particular value), and
 * the two sides agree to 20 digits there: a branch cut or a pole drops the point, not the
 * relation. One whose parameter is called (\[FormalF][z]) characterises a function and
 * is left out; \[Proportional] and other non-equations too. A bound variable (\[FormalK] in a
 * product) prints as its plain letter. */
export function relationCode(names: readonly string[]): string {
  const props = `{${RELATION_PROPERTIES.map((p) => JSON.stringify(p)).join(", ")}}`;
  return `${PRELUDE}
strip[x_] := x //. Inactive[h_] :> h;
arithmetic[x_] := x /. Inactive[h : (Plus | Times | Power | Subtract | Divide | Minus | Rational)] :> h;
plain[s_String] := StringReplace[s, "\\\\[Formal" ~~ c : LetterCharacter ~~ "]" :> ToLowerCase[c]];
points = ${RELATION_POINTS};
unevaluated = Integrate | Sum | Product | Limit | Inactive | SeriesData | Hold | $Aborted | Derivative | D;
holds[l_, r_] := TimeConstrained[Quiet@With[{d = N[strip[l] - r, 30], s = N[r, 30]},
  NumericQ[d] && NumericQ[s] && Abs[d] <= 10^-20 Max[1, Abs[s]]], 4, False];
(* The function at plain numbers is a particular value, whichever identity it came from. *)
particular[l_] := MatchQ[strip[HoldComplete @@ {l}], HoldComplete[_[(_Integer | _Rational | _Complex) ...]]];
relation[f_Function, t_List] := Module[{b = Quiet[f @@ t], cond = True},
  b = b /. Inactive[ConditionalExpression][x_, c_] :> (cond = c; x);
  b = b /. ConditionalExpression[x_, c_] :> (cond = c; x);
  If[!TrueQ[Quiet[Activate[cond]]], Return[Nothing]];
  Replace[b, {
    Inactive[Equal][l_, r_] :> With[{lhs = arithmetic[l], rhs = Quiet[TimeConstrained[ToRadicals[Activate[r]], ${RHS_SECONDS}, $Aborted]]},
      If[FreeQ[rhs, unevaluated] && !particular[lhs] && holds[lhs, rhs],
        <|"lhs" -> plain[fullform[strip[HoldComplete @@ {lhs}]]], "rhs" -> plain[fullform[HoldComplete @@ {rhs}]]|>, Nothing]],
    _ -> Nothing}]];
relations[f_Function] /; !FreeQ[Last[f], (Alternatives @@ First[f])[___]] := {};
(* The first tuples of points, in Tuples' order, without building them all: a relation can
   have a dozen parameters (HypergeometricPFQ). *)
relations[f_Function] := Module[{found = {}, k = Length[First[f]], n = Length[points]},
  TimeConstrained[
    Do[If[Length[found] < ${RELATION_INSTANCES}, found = Join[found, {relation[f, points[[1 + IntegerDigits[j, n, k]]]]}]],
      {j, 0, Min[${RELATION_TRIES}, n^k] - 1}],
    ${RELATION_SECONDS}];
  found];
relations[_] := {};
tagged[p_, i_, label_String -> f_Function] := Append[#, "label" -> label] & /@ tagged[p, i, f];
tagged[p_, i_, f_] := Join[#, <|"property" -> p, "index" -> i|>] & /@ relations[f];
Do[
  With[{vals = Quiet[EntityValue[Entity["MathematicalFunction", n], ${props}]]},
    If[ListQ[vals],
      emit[n, <|"name" -> n, "relations" -> Flatten[MapThread[Function[{p, v}, If[ListQ[v], MapIndexed[tagged[p, First[#2], #1] &, v], {}]], {${props}, vals}]]|>],
      emit[n, <|"name" -> n, "missing" -> True|>]]],
  {n, ${list(names)}}]`;
}

/** Wolfram source printing each formula as a `FormulaRecord`. */
export function formulaCode(names: readonly string[]): string {
  return `${PRELUDE}
Do[emit[n, <|"name" -> n, "formula" -> ToString[Quiet[FormulaData[n]], InputForm, PageWidth -> Infinity]|>], {n, ${list(names)}}]`;
}

/** Wolfram source printing every entity name a source knows, one `<<name>>` line each. */
export function namesCode(source: WolframDataSource): string {
  const all = {
    language: `CanonicalName /@ EntityList["WolframLanguageSymbol"]`,
    function: `CanonicalName /@ EntityList["MathematicalFunction"]`,
    relation: `CanonicalName /@ EntityList["MathematicalFunction"]`,
    formula: `Select[FormulaData[], StringQ]`,
  }[source];
  return `Scan[Print["<<", #, ">>"] &, ${all}]`;
}

const CODE: Record<WolframDataSource, (names: readonly string[]) => string> = {
  language: languageCode,
  function: functionCode,
  relation: relationCode,
  formula: formulaCode,
};

/** Each `<<name>>base64` line of a kernel's output, decoded; `missing` entities are dropped. */
export function collectRecords(output: string): WolframDataRecord[] {
  const records: WolframDataRecord[] = [];
  for (const line of output.split("\n")) {
    const match = /^<<([^>]*)>>([A-Za-z0-9+/=]+)\s*$/.exec(line);
    if (!match) continue;
    const record = JSON.parse(Buffer.from(match[2]!, "base64").toString("utf8")) as WolframDataRecord & {
      missing?: boolean;
    };
    if (!record.missing) records.push(record);
  }
  return records;
}

async function kernel(code: string): Promise<string> {
  const run = await runBounded("wolframscript", ["-code", code], { timeoutMs: TIMEOUT_MS });
  if (run.killed) throw new Error(`wolframscript killed (${run.killed}) at ${Math.round(run.peakMb)} MB`);
  return run.stdout;
}

/** Every entity name `source` knows. */
export async function wolframDataNames(source: WolframDataSource): Promise<string[]> {
  const out = await kernel(namesCode(source));
  return [...out.matchAll(/^<<(.*)>>\s*$/gm)].map((m) => m[1]!);
}

/** `source`'s records for `names`, a batch per kernel; `onBatch` sees each batch as it lands. */
export async function fetchWolframData(
  source: WolframDataSource,
  names: readonly string[],
  onBatch: (records: WolframDataRecord[]) => void | Promise<void> = () => {},
): Promise<WolframDataRecord[]> {
  const all: WolframDataRecord[] = [];
  for (let i = 0; i < names.length; i += BATCH[source]) {
    const records = collectRecords(await kernel(CODE[source](names.slice(i, i + BATCH[source]))));
    await onBatch(records);
    all.push(...records);
  }
  return all;
}
