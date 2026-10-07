// FindStat writes each object as text (`[2,1]`, `{{1,3},{2}}`); the carrier value we read it
// as, for the carriers whose text has been checked against our own.

import type { MathJSON } from "@enumeratio/entry";

const list = (text: string): MathJSON => ["List", ...(JSON.parse(text) as number[])];

const READERS: Readonly<Record<string, (text: string) => MathJSON>> = {
  Permutation: (text) => ["Permutation", list(text)],
  IntegerPartition: (text) => ["IntegerPartition", list(text)],
  DyckPath: (text) => ["DyckPath", list(text)],
  SetPartition: (text) => [
    "SetPartition",
    ["List", ...(JSON.parse(text.replace(/\{/g, "[").replace(/\}/g, "]")) as number[][]).map((b) => ["List", ...b])],
  ],
};

/** The carrier value FindStat's `text` names, or `undefined` for a carrier we don't read. */
export const readObject = (carrier: string, text: string): MathJSON | undefined => READERS[carrier]?.(text);
