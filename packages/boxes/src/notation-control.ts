// The interface heads as `makeBoxes` rules, as in Wolfram: `Slider` is a `SliderBox` over
// `Dynamic(x)` of its variable, `Dynamic` a `DynamicBox`, `DynamicModule` a `DynamicModuleBox`.
// A control's domain (its range or corners) rides as written, its entries as a `value -> label`
// rule list; a host reads it back (`controlOperands`). The bars lower to rows of single-entry
// boxes (`control-group.ts`), which a host groups by binding.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import {
  type Box,
  binding,
  type ControlBoxHead,
  control,
  dynamic,
  dynamicModule,
  argCount,
  isControlBoxHead,
  OPTIONAL_DOMAIN_HEADS,
  type Options,
  type OptionValue,
  SHOWN_CONTROL_HEADS,
  text,
} from "./box.ts";
import {
  type BarKind,
  bindingVariable,
  displayText,
  entriesOf,
  entriesOfRules,
  entryOfLabeled,
  lowerBar,
  plainText,
  entryRule,
} from "./control-group.ts";
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

/** The domain a head boxes: where nothing follows the variable, `Automatic`, or none at all on a head Wolfram leaves it off. */
const boxedDomainOf = (head: ControlBoxHead, rest: readonly Json[]): Json | undefined =>
  rest.length === 0 && (OPTIONAL_DOMAIN_HEADS as readonly string[]).includes(head) ? undefined : domainOf(rest);

/** The heads whose entries are a `value -> label` rule list. */
const RULE_LIST_HEADS: ReadonlySet<string> = new Set(["PopupMenuBox", "ListPickerBox", "TogglerBox"]);

/** A control's domain as Wolfram boxes it: entries written out become a rule list; anything else rides as written. */
function boxedDomain(head: ControlBoxHead, domain: Json | undefined): Json | undefined {
  if (domain === undefined) return undefined;
  const entries = RULE_LIST_HEADS.has(head) ? entriesOf(domain) : undefined;
  return entries === undefined ? domain : (["List", ...entries.map(entryRule)] as unknown as Json);
}

/** The variable's name as a toggler shows it: `x` of `(x, start)`. */
const nameOf = (variable: Json): Json => (headOf(variable) === "Tuple" ? opsOf(variable)[0]! : variable);

/** The domain a control was written with, read back from its box: entries, not rules, and the setter's value with its label. */
function writtenDomain(box: Extract<Box, readonly [ControlBoxHead, ...unknown[]]>): Json {
  const domain = (argCount(box) > 1 ? box[2] : undefined) as Json | undefined;
  if (domain === undefined) return "Automatic";
  if (RULE_LIST_HEADS.has(box[0])) return entriesOfRules(domain) ?? domain;
  if (box[0] === "SetterBox") {
    const values = entriesOf(domain);
    const label = plainText(box[3] as Box);
    if (values?.length === 1 && label !== undefined)
      return ["List", entryOfLabeled(values[0]!, label)] as unknown as Json;
  }
  return domain;
}

/** The operands a control was written with, read back from its box: its variable, then what its domain holds. */
export function controlOperands(box: Box): Json[] {
  if (typeof box === "string" || !isControlBoxHead(box[0])) return [];
  const node = box as Extract<Box, readonly [ControlBoxHead, ...unknown[]]>;
  const variable = bindingVariable(node[1] as Json);
  // A binding that names no variable leaves nothing to bind: the domain is not its operands.
  if (variable === undefined) return [];
  const domain = writtenDomain(node);
  const rest = headOf(domain) === "Sequence" ? opsOf(domain) : domain === "Automatic" ? [] : [domain];
  return [variable, ...rest];
}

const controlRule =
  (head: ControlBoxHead, fixed: Options = {}, domain?: Json): NotationRule =>
  (args) => {
    const { ops, options } = split(args);
    if (ops.length === 0) return undefined;
    // A toggler also shows its variable's value.
    const shown = (SHOWN_CONTROL_HEADS as readonly string[]).includes(head)
      ? dynamic(["ToBoxes", nameOf(ops[0]!), "StandardForm"] as unknown as Json)
      : undefined;
    return control(
      head,
      binding(ops[0]!),
      boxedDomain(head, domain ?? boxedDomainOf(head, ops.slice(1))),
      { ...fixed, ...options },
      shown,
    );
  };

/**
 * A bar as Wolfram boxes it: a row of single-entry boxes, one per entry. Entries that are not
 * written out as a list cannot be split, so a setter or radio bar keeps them as one box's domain
 * (which a reader takes as the whole list), and a toggler bar is left unboxed.
 */
const barRule =
  (kind: BarKind): NotationRule =>
  (args, write) => {
    const { ops, options } = split(args);
    // An environment may write a label as a hole; text is what a reader gets the entry's label back from.
    const shown = (label: Json): Box => {
      const box = write.box(label);
      const words = displayText(label);
      if (plainText(box) !== undefined || words === undefined) return box;
      return typeof label === "object" ? text(words, { ShowStringCharacters: true }) : words;
    };
    if (ops.length === 0) return undefined;
    const entries = ops.length === 2 ? entriesOf(ops[1]!) : undefined;
    if (entries !== undefined && entries.length > 0) {
      return lowerBar(kind, ops[0]!, entries, options, shown);
    }
    if (kind === "TogglerBar") return undefined;
    const entry = domainOf(ops.slice(1));
    const rest = ["List", entry] as unknown as Json;
    return kind === "SetterBar"
      ? control("SetterBox", binding(ops[0]!), rest, options, shown(entry))
      : control("RadioButtonBox", binding(ops[0]!), rest, options);
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
  SetterBar: barRule("SetterBar"),
  RadioButtonBar: barRule("RadioButtonBar"),
  TogglerBar: barRule("TogglerBar"),
  Knob: controlRule("KnobBox"),
  IntervalSlider: controlRule("IntervalSliderBox"),
  ListPicker: controlRule("ListPickerBox"),
  Locator: controlRule("LocatorBox"),
  // Wolfram boxes a `ColorSlider` as a `ColorSetterBox` showing the spectrum.
  ColorSlider: controlRule("ColorSetterBox", {}, "SwatchSpectrum"),
  Toggler: controlRule("TogglerBox"),
  Animator: controlRule("AnimatorBox"),
  Dynamic,
  DynamicModule,
};

/** The heads `CONTROL_NOTATION` writes as boxes. */
export const CONTROL_NOTATION_HEADS: ReadonlySet<string> = new Set(Object.keys(CONTROL_NOTATION));

/** What a control box is for, which a host without the web's widgets reads to draw its own. */
export type ControlIntent = "continuous" | "interval" | "color" | "planar" | "choice" | "toggle" | "text" | "playback";

/** Each control box's intent: a number along a track, an interval within a range, a point in a square, a color, one or several of the entries, an either/or, free text, or a value that moves by itself. */
export const CONTROL_INTENT: Readonly<Record<ControlBoxHead, ControlIntent>> = {
  SliderBox: "continuous",
  Slider2DBox: "planar",
  CheckboxBox: "toggle",
  TogglerBox: "toggle",
  PopupMenuBox: "choice",
  SetterBox: "choice",
  InputFieldBox: "text",
  AnimatorBox: "playback",
  KnobBox: "continuous",
  StepperBox: "continuous",
  IntervalSliderBox: "interval",
  ListPickerBox: "choice",
  LocatorBox: "planar",
  ColorSetterBox: "color",
  RadioButtonBox: "choice",
};
