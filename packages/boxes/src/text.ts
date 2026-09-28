// Boxes as one line of text -- for a pipe, a log, an accessible label. Two-dimensional
// text (a fraction over its bar, a sum with its limits stacked) is a later serialiser;
// this one linearises: scripts become `^` and `_`, a fraction `a/b`, parenthesised
// wherever the linear form would misread.

import { type Box, type BoxNode, isNode, optionsOfBox } from "./box.ts";

/** Operators that read better with a space either side. */
const SPACED = new Set("+ − = ≠ < ≤ > ≥ ≈ ≡ ∈ ∉ ⊂ ⊆ ⊃ ⊇ → ∧ ∨ ⇒ ⇔ ×".split(" "));

const OPEN = new Set(["(", "[", "{", "|", "‖", "⟨", "⌊", "⌈"]);

function token(s: string, first: boolean): string {
  if (s === "\u2061") return "";
  if (s === "\u2062") return " ";
  if (s === "−" && first) return "−";
  if (s === ",") return ", ";
  return SPACED.has(s) ? ` ${s} ` : s;
}

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

const unit = (box: Box): string => (isUnit(box) ? write(box) : `(${write(box)})`);

function write(box: Box): string {
  if (typeof box === "string") return token(box, true);
  return writeNode(box);
}

function writeNode(box: BoxNode): string {
  switch (box[0]) {
    case "RowBox": {
      const items = box[1];
      const [first, second, third] = items;
      if (isNode(second) && second[0] === "GridBox") {
        // `{` over (value, condition) rows: a piecewise definition, one case after another.
        if (items.length === 2 && first === "{") {
          return `{${second[1].map((r) => r.map(write).join(" ")).join("; ")}}`;
        }
        // A fenced matrix: the nested lists already fence it.
        if (items.length === 3 && typeof first === "string" && OPEN.has(first) && typeof third === "string") {
          return write(second);
        }
      }
      // Two juxtaposed boxes (`x^2` then `dx`) need a space where MathML needs nothing.
      return items
        .map((b, i) => {
          if (typeof b === "string") return token(b, i === 0);
          return (i > 0 && typeof items[i - 1] !== "string" ? " " : "") + write(b);
        })
        .join("");
    }
    case "TextBox":
      return optionsOfBox(box).ShowStringCharacters === true ? `"${box[1]}"` : box[1];
    case "SuperscriptBox":
      return `${unit(box[1])}^${unit(box[2])}`;
    case "SubscriptBox":
      return `${unit(box[1])}_${unit(box[2])}`;
    case "SubsuperscriptBox":
      return `${unit(box[1])}_${unit(box[2])}^${unit(box[3])}`;
    case "OverscriptBox":
      // A repeating decimal's overline: combine it onto each digit.
      if (box[2] === "‾" && typeof box[1] === "string") return box[1].replace(/./gu, (c) => `${c}\u0305`);
      return `${unit(box[1])}^${unit(box[2])}`;
    case "UnderscriptBox":
      return `${unit(box[1])}_${unit(box[2])} `;
    case "UnderoverscriptBox":
      return `${unit(box[1])}_${unit(box[2])}^${unit(box[3])} `;
    case "FractionBox":
      if (optionsOfBox(box).FractionLine === false) return `${write(box[1])}; ${write(box[2])}`;
      return `${unit(box[1])}/${unit(box[2])}`;
    case "SqrtBox":
      return `√${unit(box[1])}`;
    case "RadicalBox":
      return `${unit(box[1])}^(1/${write(box[2])})`;
    case "GridBox":
      return `{${box[1].map((r) => `{${r.map(write).join(", ")}}`).join(", ")}}`;
    case "StyleBox":
    case "FrameBox":
    case "TagBox":
    case "InterpretationBox":
    case "ErrorBox":
      return write(box[1]);
    default:
      throw new Error("unreachable: BoxNode's tags are exhaustive above");
  }
}

/** Boxes as one line of text. */
export const toText = (box: Box): string => write(box).replace(/ {2,}/g, " ").trim();
