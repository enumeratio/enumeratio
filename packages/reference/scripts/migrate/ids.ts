// The id `add-ids.ts` gives an example before deduping: its caption's, or, with no
// caption, its InputForm's, with the operators spelled out so `-1` and `1` differ.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { captionId, slugId } from "@enumeratio/entry";
import { toInputForm } from "../../../formats/src/inputform.ts";

const inputFormId = (expr: unknown): string => {
  let text: string;
  try {
    text = toInputForm(expr as MathJsonExpression);
  } catch {
    text = JSON.stringify(expr);
  }
  return slugId(
    text
      .replace(/(^|[([{,=\s])-(?=\S)/g, "$1 neg ")
      .replace(/(\d)\.(\d)/g, "$1p$2")
      .replace(/\s*-\s*/g, " minus ")
      .replace(/\s*\+\s*/g, " plus ")
      .replace(/\s*\/\s*/g, " over ")
      .replace(/\s*\^\s*/g, " pow ")
      .replace(/\s*\*\s*/g, " times ")
      .replace(/\s*==?\s*/g, " eq ")
      .replace(/\s*%\s*/g, " mod ")
      .replace(/!/g, " factorial ")
      .replace(/\s*<\s*/g, " lt ")
      .replace(/\s*>\s*/g, " gt ")
      .replace(/\[/g, " list "),
  );
};

export const baseId = (example: { caption?: string; expr: unknown }): string =>
  (example.caption !== undefined && captionId(example.caption)) ||
  inputFormId(example.expr) ||
  "example";
