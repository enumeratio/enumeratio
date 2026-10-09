// What a control's arguments become as attributes -- `Slider(k, (0, 5))` as `name="k" min="0"
// max="5"` -- and a control box as its element. A control's first argument names the variable it
// binds -- `Slider(k, (0, 5))` -- or carries its starting value too, `Slider((k, 2), (0, 5))`, the
// way a Manipulate parameter does. The rest are the control's own: a range tuple, a list of
// entries, a pair of corners.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import {
  type Box,
  CONTROL_INTENT,
  type ControlBoxHead,
  controlOperands,
  isControlBoxHead,
  type OptionValue,
  optionsOfBox,
} from "@enumeratio/boxes";
import { boxTag } from "./box-tags.ts";
import { epsil, headOf, numOf, opsOf, optionAttribute, strOf, symOf, tupleOf } from "./mathjson.ts";

type Json = MathJsonExpression;

/**
 * A number as an attribute: cleaned of the binary noise the Epsil parser leaves on a
 * decimal (`0.3` arrives as 0.30000000000000004), which a control would otherwise
 * carry into its readout. Anything else is Epsil.
 */
export const clean = (node: Json): string => {
  const v = numOf(node);
  return v === undefined ? epsil(node) : String(Number(v.toPrecision(12)));
};

/** `k` or `(k, init)`: the variable and, if given, where it starts. */
export function variable(node: Json | undefined): { name?: string; init?: Json } {
  const parts = tupleOf(node);
  if (parts !== undefined) return { name: symOf(parts[0]), init: parts[1] };
  return { name: symOf(node) };
}

/** `(min, max)` / `(min, max, step)` as attributes. */
function rangeAttributes(node: Json | undefined): Record<string, string> {
  const parts = tupleOf(node);
  const out: Record<string, string> = {};
  if (parts === undefined) return out;
  if (parts[0] !== undefined) out.min = clean(parts[0]);
  if (parts[1] !== undefined) out.max = clean(parts[1]);
  if (parts[2] !== undefined) out.step = clean(parts[2]);
  return out;
}

/** An entry of a choice list: `Labeled(value, "label")` shows one thing and binds another. */
function entryOf(node: Json): string {
  if (headOf(node) === "Labeled") {
    const [value, label] = opsOf(node);
    const text = label === undefined ? undefined : (strOf(label) ?? epsil(label));
    return value === undefined ? "" : text === undefined ? epsil(value) : `${epsil(value)} -> ${text}`;
  }
  // A string binds as the string it is, and shows as its words.
  const text = strOf(node);
  return text === undefined ? epsil(node) : `${epsil(node)} -> ${text}`;
}

/** A list of entries as the `|`-separated `values` attribute. */
const entries = (node: Json | undefined): string | undefined => tupleOf(node)?.map(entryOf).join("|");

type Attributes = (ops: readonly Json[]) => Record<string, string>;

/** A control over a range: name, start, and `(min, max, step)`. */
export const rangedAttributes: Attributes = (ops) => {
  const out: Record<string, string> = {};
  const { name, init } = variable(ops[0]);
  if (name) out.name = name;
  if (init !== undefined) out.value = clean(init);
  Object.assign(out, rangeAttributes(ops[1]));
  return out;
};

/** A control over a list of entries: name, start, and the entries. */
export const listedAttributes: Attributes = (ops) => {
  const out: Record<string, string> = {};
  const { name, init } = variable(ops[0]);
  if (name) out.name = name;
  if (init !== undefined) {
    // A starting selection is one entry, or a list of them for a multiple choice.
    const many = tupleOf(init);
    out.value =
      many === undefined ? entryOf(init).split(" -> ")[0]! : many.map((v) => entryOf(v).split(" -> ")[0]).join("|");
  }
  const values = entries(ops[1]);
  if (values !== undefined) out.values = values;
  return out;
};

/** A control over a point: name, start `(x, y)`, and the corners `((x0, y0), (x1, y1))`. */
export const planarAttributes: Attributes = (ops) => {
  const out: Record<string, string> = {};
  const { name, init } = variable(ops[0]);
  if (name) out.name = name;
  const point = tupleOf(init);
  if (point !== undefined && point.length === 2) out.value = point.map(clean).join(",");
  const corners = tupleOf(ops[1]);
  const lo = tupleOf(corners?.[0]);
  const hi = tupleOf(corners?.[1]);
  if (lo !== undefined && lo.length === 2) out.min = lo.map(clean).join(",");
  if (hi !== undefined && hi.length === 2) out.max = hi.map(clean).join(",");
  const step = ops[2] === undefined ? undefined : (tupleOf(ops[2]) ?? [ops[2]]);
  if (step !== undefined) out.step = step.map(clean).join(",");
  return out;
};

/** A control that binds a value with no range to speak of: a checkbox, a color, a field. */
export const simpleAttributes: Attributes = (ops) => {
  const out: Record<string, string> = {};
  const { name, init } = variable(ops[0]);
  if (name) out.name = name;
  if (init !== undefined) out.value = strOf(init) ?? epsil(init);
  return out;
};

/** An interval slider: the start is an interval, `(r, (1, 3))`, which the component takes as `1,3`. */
export const intervalAttributes: Attributes = (ops) => {
  const out = rangedAttributes(ops);
  const pair = tupleOf(variable(ops[0]).init);
  if (pair !== undefined && pair.length === 2) out.value = pair.map(clean).join(",");
  return out;
};

/** A locator: name and start `(x, y)`; it has no corners of its own, it takes the plot's. */
export const locatorAttributes: Attributes = (ops) => {
  const out: Record<string, string> = {};
  const { name, init } = variable(ops[0]);
  if (name) out.name = name;
  const point = tupleOf(init);
  if (point !== undefined && point.length === 2) out.value = point.map(clean).join(",");
  return out;
};

/** Each control box's arguments as attributes, by what it is for. */
const ATTRIBUTES: Readonly<Record<ControlBoxHead, Attributes>> = {
  SliderBox: rangedAttributes,
  AnimatorBox: rangedAttributes,
  KnobBox: rangedAttributes,
  StepperBox: rangedAttributes,
  IntervalSliderBox: intervalAttributes,
  ListPickerBox: listedAttributes,
  LocatorBox: locatorAttributes,
  ColorSetterBox: simpleAttributes,
  SetterBarBox: listedAttributes,
  RadioButtonBarBox: listedAttributes,
  TogglerBarBox: listedAttributes,
  Slider2DBox: planarAttributes,
  SetterBox: listedAttributes,
  TogglerBox: listedAttributes,
  PopupMenuBox: listedAttributes,
  CheckboxBox: simpleAttributes,
  InputFieldBox: simpleAttributes,
};

/** An option's value as attribute text: a flag as `true` (and none when off), a name bare, a list as Epsil would write it. */
function optionText(value: OptionValue): string | undefined {
  if (value === true) return "true";
  if (value === false || value === null) return undefined;
  if (Array.isArray(value)) return `[${value.map((v) => optionText(v) ?? "").join(", ")}]`;
  return String(value);
}

/** A control box as its element: the tag, and the attributes its binding, domain and options become. */
export function controlElement(box: Extract<Box, readonly [ControlBoxHead, ...unknown[]]>): {
  tag: string;
  attributes: Record<string, string>;
} {
  const head = box[0];
  const attributes = ATTRIBUTES[head](controlOperands(box[1], box[2]));
  for (const [name, value] of Object.entries(optionsOfBox(box))) {
    // `VerticalSlider` is a `SliderBox` standing up.
    if (name === "Appearance" && value === "Vertical") {
      attributes.axis = "y";
      continue;
    }
    const text = optionText(value);
    if (text !== undefined) attributes[optionAttribute(name)] = text;
  }
  return { tag: boxTag(head), attributes };
}

/** What a control box binds, as a declaration the keyboard driver and `reduce` read. */
export interface BoxControl {
  readonly head: ControlBoxHead;
  readonly intent: (typeof CONTROL_INTENT)[ControlBoxHead];
  /** The variable's name. */
  readonly name: string;
  /** Where it starts, if the author said. */
  readonly init?: Json;
  /** The domain as written: a range tuple, a list of entries, a pair of corners. */
  readonly domain?: Json;
  /** The `Static` option, if given. */
  readonly reading?: OptionValue;
  /** The box's own options, as written. */
  readonly options: Readonly<Record<string, OptionValue>>;
}

/** The controls in a box tree, in reading order. */
export function boxControls(box: Box, into: BoxControl[] = []): BoxControl[] {
  if (typeof box === "string") return into;
  if (isControlBoxHead(box[0])) {
    const control = box as Extract<Box, readonly [ControlBoxHead, ...unknown[]]>;
    const [binding, ...rest] = controlOperands(control[1], control[2]);
    const { name, init } = variable(binding);
    const reading = optionsOfBox(control).Static;
    if (name !== undefined) {
      into.push({
        head: control[0],
        intent: CONTROL_INTENT[control[0]],
        name,
        ...(init === undefined ? {} : { init }),
        ...(rest[0] === undefined ? {} : { domain: rest[0] }),
        ...(reading === undefined ? {} : { reading }),
        options: optionsOfBox(control),
      });
    }
    return into;
  }
  switch (box[0]) {
    case "RowBox":
      for (const item of box[1]) boxControls(item, into);
      break;
    case "GridBox":
      for (const item of box[1].flat()) boxControls(item, into);
      break;
    case "TagBox":
    case "PanelBox":
    case "FrameBox":
    case "PaneBox":
    case "StyleBox":
    case "InterpretationBox":
    case "DynamicModuleBox":
      boxControls(box[1], into);
      break;
  }
  return into;
}
