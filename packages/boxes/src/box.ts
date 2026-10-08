// Boxes: the presentation tree between an expression and its rendering. Plain JSON in
// Wolfram's FullForm shape -- a leaf is a string (a token), a node is `[head, ...args]`,
// a Wolfram list is an array and options are a trailing object. See https://github.com/enumeratio/enumeratio/wiki/Boxes.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";

export type OptionValue = string | number | boolean | null | readonly OptionValue[];
export type Options = Readonly<Record<string, OptionValue>>;

export type Box = string | BoxNode;

export type BoxNode =
  | readonly ["RowBox", readonly Box[]]
  | readonly ["TextBox", string, Options?]
  | readonly ["SuperscriptBox", Box, Box, Options?]
  | readonly ["SubscriptBox", Box, Box, Options?]
  | readonly ["SubsuperscriptBox", Box, Box, Box, Options?]
  | readonly ["OverscriptBox", Box, Box, Options?]
  | readonly ["UnderscriptBox", Box, Box, Options?]
  | readonly ["UnderoverscriptBox", Box, Box, Box, Options?]
  | readonly ["FractionBox", Box, Box, Options?]
  | readonly ["SqrtBox", Box, Options?]
  | readonly ["RadicalBox", Box, Box, Options?]
  | readonly ["GridBox", readonly (readonly Box[])[], Options?]
  | readonly ["StyleBox", Box, Options]
  | readonly ["FrameBox", Box, Options?]
  | readonly ["PanelBox", Box, Options?]
  | readonly ["PaneBox", Box, Options?]
  | readonly ["TagBox", Box, string, Options?]
  | readonly ["InterpretationBox", Box, MathJsonExpression, Options?]
  | readonly ["ErrorBox", Box]
  // Graphics (https://github.com/enumeratio/enumeratio/wiki/Speculative-Box-Primitives). A primitive's
  // geometry is its options, in the frame's coordinates; a mark is `TagBox`ed with its address,
  // a link with its members.
  | readonly ["GraphicsBox", Box, Options?]
  | readonly ["GraphicsComplexBox", Box, Options?]
  | readonly ["DiskBox", Options?]
  | readonly ["LineBox", Options?]
  | readonly ["PolygonBox", Options?]
  | readonly ["PolyhedronBox", Options?]
  | readonly ["InsetBox", Box, Options?]
  // Prose (https://github.com/enumeratio/enumeratio/wiki/Speculative-Prose-Pipeline). Inside `TextData` a leaf is text, not a token.
  | readonly ["TextCell", Box, string, Options?]
  | readonly ["TextData", readonly Box[]]
  | readonly ["ButtonBox", Box, Options?]
  // `form` is how the box reads: `TeXForm` holds TeX as written (its leaves are TeX, never
  // parsed); `TraditionalForm`/`StandardForm` hold formula boxes.
  | readonly ["FormBox", Box, string]
  // Holes, filled by the environment: a name, or an expression's Epsil.
  | readonly ["TemplateSlot", string, Options?]
  | readonly ["TemplateExpression", string, Options?];

export type BoxHead = BoxNode[0];

/** How many positional arguments each head takes; anything after them is its options. */
export const ARITY: Readonly<Record<BoxHead, number>> = {
  RowBox: 1,
  TextBox: 1,
  SuperscriptBox: 2,
  SubscriptBox: 2,
  SubsuperscriptBox: 3,
  OverscriptBox: 2,
  UnderscriptBox: 2,
  UnderoverscriptBox: 3,
  FractionBox: 2,
  SqrtBox: 1,
  RadicalBox: 2,
  GridBox: 1,
  StyleBox: 1,
  FrameBox: 1,
  PanelBox: 1,
  PaneBox: 1,
  TagBox: 2,
  InterpretationBox: 2,
  ErrorBox: 1,
  GraphicsBox: 1,
  GraphicsComplexBox: 1,
  DiskBox: 0,
  LineBox: 0,
  PolygonBox: 0,
  PolyhedronBox: 0,
  InsetBox: 1,
  TextCell: 2,
  TextData: 1,
  ButtonBox: 1,
  FormBox: 2,
  TemplateSlot: 1,
  TemplateExpression: 1,
};

export const BOX_HEADS = Object.keys(ARITY) as readonly BoxHead[];

/** A node rather than a leaf. */
export const isNode = (box: Box | undefined): box is BoxNode => box !== undefined && typeof box !== "string";

export const isBoxHead = (head: unknown): head is BoxHead => typeof head === "string" && Object.hasOwn(ARITY, head);

/** A sequence of boxes (a prose document's cells) rather than one box. */
export const isBoxSequence = (value: Box | readonly Box[]): value is readonly Box[] =>
  Array.isArray(value) && !isBoxHead(value[0]);

/** A node's options, or `{}`. */
export const optionsOfBox = (box: BoxNode): Options => {
  const last = box[ARITY[box[0]] + 1];
  return last !== undefined && typeof last === "object" && !Array.isArray(last) ? (last as Options) : {};
};

const withOptions = <T extends readonly unknown[]>(args: T, options?: Options): T | readonly [...T, Options] =>
  options === undefined || Object.keys(options).length === 0 ? args : [...args, options];

// Builders. Each drops an empty options object, so a built box and a parsed one compare equal.
export const row = (items: readonly Box[]): Box => ["RowBox", items];
export const text = (s: string, options?: Options): Box => ["TextBox", ...withOptions([s] as const, options)] as Box;
export const superscript = (base: Box, sup: Box): Box => ["SuperscriptBox", base, sup];
export const subscript = (base: Box, sub: Box): Box => ["SubscriptBox", base, sub];
export const subsuperscript = (base: Box, sub: Box, sup: Box): Box => ["SubsuperscriptBox", base, sub, sup];
export const overscript = (base: Box, over: Box): Box => ["OverscriptBox", base, over];
export const underscript = (base: Box, under: Box): Box => ["UnderscriptBox", base, under];
export const underoverscript = (base: Box, under: Box, over: Box): Box => ["UnderoverscriptBox", base, under, over];
export const fraction = (num: Box, den: Box, options?: Options): Box =>
  ["FractionBox", ...withOptions([num, den] as const, options)] as Box;
export const sqrt = (radicand: Box): Box => ["SqrtBox", radicand];
export const radical = (radicand: Box, index: Box): Box => ["RadicalBox", radicand, index];
export const grid = (rows: readonly (readonly Box[])[], options?: Options): Box =>
  ["GridBox", ...withOptions([rows] as const, options)] as Box;
export const style = (box: Box, options: Options): Box => ["StyleBox", box, options];
export const frame = (box: Box, options?: Options): Box => ["FrameBox", ...withOptions([box] as const, options)] as Box;
export const panel = (box: Box, options?: Options): Box => ["PanelBox", ...withOptions([box] as const, options)] as Box;
export const pane = (box: Box, options?: Options): Box => ["PaneBox", ...withOptions([box] as const, options)] as Box;
export const tag = (box: Box, name: string): Box => ["TagBox", box, name];
export const interpretation = (box: Box, expr: MathJsonExpression): Box => ["InterpretationBox", box, expr];
export const error = (box: Box): Box => ["ErrorBox", box];
export const graphics = (content: Box, options?: Options): Box =>
  ["GraphicsBox", ...withOptions([content] as const, options)] as Box;
export const graphicsComplex = (content: Box, options?: Options): Box =>
  ["GraphicsComplexBox", ...withOptions([content] as const, options)] as Box;
export const disk = (options?: Options): Box => ["DiskBox", ...withOptions([] as const, options)] as Box;
export const line = (options?: Options): Box => ["LineBox", ...withOptions([] as const, options)] as Box;
export const polygon = (options?: Options): Box => ["PolygonBox", ...withOptions([] as const, options)] as Box;
export const polyhedron = (options?: Options): Box => ["PolyhedronBox", ...withOptions([] as const, options)] as Box;
export const inset = (content: Box, options?: Options): Box =>
  ["InsetBox", ...withOptions([content] as const, options)] as Box;
export const textCell = (content: Box, cellStyle: string, options?: Options): Box =>
  ["TextCell", ...withOptions([content, cellStyle] as const, options)] as Box;
export const textData = (items: readonly Box[]): Box => ["TextData", items];
export const button = (label: Box, options?: Options): Box =>
  ["ButtonBox", ...withOptions([label] as const, options)] as Box;
export const form = (box: Box, name: string): Box => ["FormBox", box, name];
export const slot = (name: string, options?: Options): Box =>
  ["TemplateSlot", ...withOptions([name] as const, options)] as Box;
export const templateExpression = (source: string, options?: Options): Box =>
  ["TemplateExpression", ...withOptions([source] as const, options)] as Box;

export type TokenClass = "identifier" | "number" | "operator";

const NUMBER = /^(\d+\.?\d*|\.\d+)$/;
/** Symbols that read as a name, not an operator, though Unicode files them as math symbols. */
const IDENTIFIER_SYMBOLS = new Set(["∞", "∅", "°"]);

/**
 * A leaf's class, read off its text -- the one rule every serialiser and reader shares,
 * so a leaf survives the round trip. Digits are a number; a letter (or one of a few
 * letter-like symbols) starts an identifier; anything else is an operator. The empty
 * string is an identifier: an empty `<mi>`, a placeholder.
 */
export function tokenClass(token: string): TokenClass {
  if (token === "") return "identifier";
  if (NUMBER.test(token)) return "number";
  const first = String.fromCodePoint(token.codePointAt(0)!);
  if (/\p{L}/u.test(first) || IDENTIFIER_SYMBOLS.has(first)) return "identifier";
  return "operator";
}

/** A structurally valid box: the right heads, arities and leaf types. */
export function isBox(value: unknown): value is Box {
  if (typeof value === "string") return true;
  if (!Array.isArray(value) || !isBoxHead(value[0])) return false;
  const head = value[0];
  const arity = ARITY[head];
  if (value.length < arity + 1 || value.length > arity + 2) return false;
  if (head === "StyleBox" && value.length !== 3) return false;
  if (value.length === arity + 2) {
    const options = value[arity + 1];
    if (typeof options !== "object" || options === null || Array.isArray(options)) return false;
  }
  const args = value.slice(1, arity + 1) as unknown[];
  switch (head) {
    case "RowBox":
    case "TextData":
      return Array.isArray(args[0]) && args[0].every(isBox);
    case "GridBox":
      return Array.isArray(args[0]) && args[0].every((r: unknown) => Array.isArray(r) && r.every(isBox));
    case "TextBox":
    case "TemplateSlot":
    case "TemplateExpression":
      return typeof args[0] === "string";
    case "TagBox":
    case "TextCell":
    case "FormBox":
      return isBox(args[0]) && typeof args[1] === "string";
    case "InterpretationBox":
      return isBox(args[0]) && args[1] !== undefined;
    default:
      return args.every(isBox);
  }
}
