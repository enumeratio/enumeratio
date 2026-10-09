// Boxes as one line of text -- for a pipe, a log, an accessible label. Two-dimensional
// text (a fraction over its bar, a sum with its limits stacked) is a later serialiser;
// this one linearises: scripts become `^` and `_`, a fraction `a/b`, parenthesised
// wherever the linear form would misread. `toText` writes glyphs, `toAscii` spells them as
// AsciiMath does (linear.ts).

import { type Box, type BoxNode, isNode, optionsOfBox } from "../box.ts";
import { barOf } from "../control-group.ts";
import { type Alphabet, joinSpelled, scriptChars, spell } from "./linear.ts";
import { texToAlphabet } from "./tex-text.ts";

/** Operators that read better with a space either side. */
const SPACED = new Set("+ − = ≠ < ≤ > ≥ ≈ ≡ ∈ ∉ ⊂ ⊆ ⊃ ⊇ → ∧ ∨ ⇒ ⇔ ×".split(" "));

const OPEN = new Set(["(", "[", "{", "|", "‖", "⟨", "⌊", "⌈"]);

/** Already one unit in linear text: a token, or a fenced row. */
function isUnit(box: Box): boolean {
  if (typeof box === "string") return true;
  if (box[0] === "SqrtBox" || box[0] === "TextBox") return true;
  if (box[0] === "RowBox") {
    const items = box[1];
    return items.length === 1 ? isUnit(items[0]) : typeof items[0] === "string" && OPEN.has(items[0]);
  }
  if (box[0] === "TagBox" || box[0] === "InterpretationBox" || box[0] === "StyleBox" || box[0] === "FrameBox") {
    return isUnit(box[1]);
  }
  return false;
}

/** A TeX box's source, a hole escaped so it reads back as written. */
const texOf = (box: Box): string => {
  if (typeof box === "string") return box;
  if (box[0] === "RowBox") return box[1].map(texOf).join("");
  return box[0] === "TemplateSlot" || box[0] === "TemplateExpression" ? `\\$\\{${box[1]}\\}` : "";
};

class Writer {
  readonly alphabet: Alphabet;
  constructor(alphabet: Alphabet) {
    this.alphabet = alphabet;
  }

  /** `first`: a leading minus is a sign, not a spaced operator. */
  token(s: string, first = true): string {
    if (s === "\u2061") return "";
    if (s === "\u2062") return " ";
    if (s === ",") return ", ";
    const spelled = spell(s, this.alphabet);
    return SPACED.has(s) && !(s === "−" && first) ? ` ${spelled} ` : spelled;
  }

  unit(box: Box): string {
    return isUnit(box) ? this.write(box) : `(${this.write(box)})`;
  }

  /** `base` with a script: Unicode's script characters where it has them all. */
  scripted(base: Box, mark: "^" | "_", s: Box): string {
    return this.unit(base) + this.script(mark, s);
  }

  script(mark: "^" | "_", s: Box): string {
    const chars = this.alphabet === "unicode" ? scriptChars(this.write(s), mark) : undefined;
    return chars ?? `${mark}${this.unit(s)}`;
  }

  write(box: Box): string {
    return typeof box === "string" ? this.token(box) : this.node(box);
  }

  node(box: BoxNode): string {
    switch (box[0]) {
      case "RowBox": {
        const items = box[1];
        const [first, second, third] = items;
        if (isNode(second) && second[0] === "GridBox") {
          // `{` over (value, condition) rows: a piecewise definition, one case after another.
          if (items.length === 2 && first === "{") {
            return `{${second[1].map((r) => r.map((b) => this.write(b)).join(" ")).join("; ")}}`;
          }
          // A fenced matrix: the nested lists already fence it. AsciiMath writes its rows in
          // brackets or parentheses inside the fence: `[[1, 2], [3, 4]]`, `|(1, 2), (3, 4)|`.
          if (items.length === 3 && typeof first === "string" && OPEN.has(first) && typeof third === "string") {
            if (this.alphabet === "unicode") return this.write(second);
            const [open, close] = first === "[" ? ["[", "]"] : ["(", ")"];
            const rows = second[1].map((r) => `${open}${r.map((b) => this.write(b)).join(", ")}${close}`);
            return `${first}${rows.join(", ")}${third}`;
          }
        }
        // Two juxtaposed boxes (`x^2` then `dx`) need a space where MathML needs nothing.
        return items.reduce<string>((out, b, i) => {
          const piece = typeof b === "string" ? this.token(b, i === 0) : this.write(b);
          const gap = i > 0 && typeof b !== "string" && typeof items[i - 1] !== "string" ? " " : "";
          return joinSpelled(out + gap, piece, this.alphabet);
        }, "");
      }
      case "TextBox":
        return optionsOfBox(box).ShowStringCharacters === true ? `"${box[1]}"` : box[1];
      case "SuperscriptBox":
        return this.scripted(box[1], "^", box[2]);
      case "SubscriptBox":
        return this.scripted(box[1], "_", box[2]);
      case "SubsuperscriptBox":
        return this.scripted(box[1], "_", box[2]) + this.script("^", box[3]);
      case "OverscriptBox":
        // A repeating decimal's overline: combined onto each digit, or AsciiMath's `bar`.
        if (box[2] === "‾" && typeof box[1] === "string") {
          return this.alphabet === "unicode" ? box[1].replace(/./gu, (c) => `${c}̅`) : `bar(${box[1]})`;
        }
        return `${this.unit(box[1])}^${this.unit(box[2])}`;
      case "UnderscriptBox":
        return `${this.unit(box[1])}_${this.unit(box[2])} `;
      case "UnderoverscriptBox":
        return `${this.unit(box[1])}_${this.unit(box[2])}^${this.unit(box[3])} `;
      case "FractionBox":
        if (optionsOfBox(box).FractionLine === false) return `${this.write(box[1])}; ${this.write(box[2])}`;
        return `${this.unit(box[1])}/${this.unit(box[2])}`;
      case "SqrtBox":
        return this.alphabet === "unicode" ? `√${this.unit(box[1])}` : `sqrt(${this.write(box[1])})`;
      case "RadicalBox":
        return this.alphabet === "unicode"
          ? `${this.unit(box[1])}^(1/${this.write(box[2])})`
          : `root(${this.write(box[2])})(${this.write(box[1])})`;
      case "GridBox": {
        // A bar is one control, written as its kind.
        const bar = barOf(box);
        if (bar !== undefined) return `-${bar.kind}-`;
        return `{${box[1].map((r) => `{${r.map((b) => this.write(b)).join(", ")}}`).join(", ")}}`;
      }
      case "StyleBox":
      case "FrameBox":
      case "PanelBox":
      case "PaneBox":
      case "TagBox":
      case "InterpretationBox":
      case "ErrorBox":
      case "ButtonBox":
      case "TextCell":
        return this.write(box[1]);
      // Running text: its leaves are words, not tokens.
      case "TextData":
        return box[1].map((b) => (typeof b === "string" ? b : this.write(b))).join("");
      case "FormBox":
        return box[2] === "TeXForm" ? texToAlphabet(texOf(box[1]), this.alphabet) : this.write(box[1]);
      case "TemplateSlot":
      case "TemplateExpression":
        return `\${${box[1]}}`;
      case "GraphicsBox":
      case "GraphicsComplexBox":
      case "DiskBox":
      case "LineBox":
      case "PointBox":
      case "ArrowBox":
      case "RectangleBox":
      case "PolygonBox":
      case "PolyhedronBox":
      case "InsetBox":
        return "-Graphics-";
      case "TableViewBox":
        return "-TableView-";
      case "DynamicBox":
        return "-Dynamic-";
      case "DynamicModuleBox":
        return this.write(box[1]);
      case "SliderBox":
      case "Slider2DBox":
      case "CheckboxBox":
      case "PopupMenuBox":
      case "InputFieldBox":
      case "SetterBox":
      case "TogglerBox":
      case "AnimatorBox":
      case "KnobBox":
      case "StepperBox":
      case "IntervalSliderBox":
      case "ListPickerBox":
      case "LocatorBox":
      case "ColorSetterBox":
      case "RadioButtonBox":
        return `-${box[0].slice(0, -3)}-`;
      default:
        throw new Error("unreachable: BoxNode's tags are exhaustive above");
    }
  }
}

const linear = (box: Box, alphabet: Alphabet): string => new Writer(alphabet).write(box).replace(/ {2,}/g, " ").trim();

/** Boxes as one line of text (`x² ≤ π`). */
export const toText = (box: Box): string => linear(box, "unicode");

/** Boxes as one line of ASCII, spelled as AsciiMath spells it (`x^2 <= pi`). */
export const toAscii = (box: Box): string => linear(box, "ascii");
