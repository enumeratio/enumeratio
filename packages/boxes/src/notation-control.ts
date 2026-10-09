// The interface heads as `makeBoxes` rules, as in Wolfram: `Slider` is a `SliderBox` over a
// `DynamicBox` of its variable, `Dynamic` a `DynamicBox`, `DynamicModule` a `DynamicModuleBox`.
// A control's domain (its range, entries or corners) rides as written; a host reads it back.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import {
  type Box,
  type ControlBoxHead,
  control,
  dynamic,
  dynamicModule,
  type Options,
  type OptionValue,
} from "./box.ts";
import { headOf, opsOf, optionOf } from "./notation-layout.ts";
import type { Notation, NotationRule } from "./notation.ts";

type Json = MathJsonExpression;

/** A rule's name when it is written `Name -> value`: a `KeyValuePair`, or a tuple keyed by a capitalized symbol. */
function ruleOf(node: Json): [string, Json] | undefined {
  const head = headOf(node);
  const [key, value, ...rest] = opsOf(node);
  if ((head !== "KeyValuePair" && head !== "Rule" && head !== "Tuple") || value === undefined || rest.length > 0) {
    return undefined;
  }
  // A string key (`("Apple", "Pear")`, two entries) is data, never an option's name.
  const name = typeof key === "string" ? (key.startsWith("'") ? undefined : key) : (key as { sym?: string })?.sym;
  return name !== undefined && /^[A-Z]/.test(name) ? [name, value] : undefined;
}

/** The positional arguments and the trailing rules as options (the leftmost setting of a name wins). */
function split(args: readonly Json[]): { ops: Json[]; options: Options } {
  let end = args.length;
  while (end > 0 && ruleOf(args[end - 1]!) !== undefined) end--;
  const options: Record<string, OptionValue> = {};
  for (const arg of args.slice(end)) {
    const [name, value] = ruleOf(arg)!;
    const set = optionOf(value);
    if (!(name in options) && set !== undefined) options[name] = set;
  }
  return { ops: args.slice(0, end) as Json[], options };
}

/** What follows the variable: nothing is `Automatic`, one thing is itself, several are a `Sequence`. */
const domainOf = (rest: readonly Json[]): Json =>
  rest.length === 0 ? "Automatic" : rest.length === 1 ? rest[0]! : (["Sequence", ...rest] as Json);

/** The operands a control was written with: its variable, then what its domain holds. */
export function controlOperands(binding: Box, domain: Json): Json[] {
  const variable = Array.isArray(binding) && binding[0] === "DynamicBox" ? (binding[1] as Json) : undefined;
  const rest = headOf(domain) === "Sequence" ? opsOf(domain) : domain === "Automatic" ? [] : [domain];
  return variable === undefined ? rest : [variable, ...rest];
}

const controlRule =
  (head: ControlBoxHead, fixed: Options = {}): NotationRule =>
  (args) => {
    const { ops, options } = split(args);
    return ops.length === 0
      ? undefined
      : control(head, dynamic(ops[0]!), domainOf(ops.slice(1)), { ...fixed, ...options });
  };

const Dynamic: NotationRule = (args) => {
  const { ops } = split(args);
  return ops.length === 1 ? dynamic(ops[0]!) : undefined;
};

const DynamicModule: NotationRule = (args, write) => {
  const { ops, options } = split(args);
  return ops.length === 1 ? dynamicModule(write.box(ops[0]!), options) : undefined;
};

/** The interface heads' rules: add them to what `makeBoxes` writes with. */
export const CONTROL_NOTATION: Notation = {
  Slider: controlRule("SliderBox"),
  VerticalSlider: controlRule("SliderBox", { Appearance: "Vertical" }),
  Slider2D: controlRule("Slider2DBox"),
  Checkbox: controlRule("CheckboxBox"),
  PopupMenu: controlRule("PopupMenuBox"),
  InputField: controlRule("InputFieldBox"),
  SetterBar: controlRule("SetterBox"),
  Toggler: controlRule("TogglerBox"),
  Animator: controlRule("AnimatorBox"),
  Dynamic,
  DynamicModule,
};

/** The heads `CONTROL_NOTATION` writes as boxes. */
export const CONTROL_NOTATION_HEADS: ReadonlySet<string> = new Set(Object.keys(CONTROL_NOTATION));

/** What a control box is for, which a host without the web's widgets reads to draw its own. */
export type ControlIntent = "continuous" | "planar" | "choice" | "toggle" | "text" | "playback";

/** Each control box's intent: a number along a track, a point in a square, one of several entries, an either/or, free text, or a value that moves by itself. */
export const CONTROL_INTENT: Readonly<Record<ControlBoxHead, ControlIntent>> = {
  SliderBox: "continuous",
  Slider2DBox: "planar",
  CheckboxBox: "toggle",
  TogglerBox: "toggle",
  PopupMenuBox: "choice",
  SetterBox: "choice",
  InputFieldBox: "text",
  AnimatorBox: "playback",
};
