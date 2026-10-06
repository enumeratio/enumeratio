// Configurations worth a name: our own notable systems, each with where it comes from, and the
// favorites viewers sent TheGrayCuber's imaginary-bases page, credited as submitted.

import favorites from "./favorites.json" with { type: "json" };

export interface RadixExample {
  readonly id: string;
  /** A short name for a menu. */
  readonly label: string;
  /** The settings, as a settings sentence (`formatSettings`). */
  readonly code: string;
  readonly maxLength: number;
  /** One sentence on what to look at. */
  readonly note: string;
  /** Who described it, or who submitted it. */
  readonly source: string;
}

export const NOTABLE: readonly RadixExample[] = [
  {
    id: "twindragon",
    label: "The twindragon",
    code: "base -1+i with digits 0, and 1 color by 12th",
    maxLength: 12,
    note: "Every Gaussian integer has exactly one expansion in base −1 + i with digits 0 and 1; the numbers of at most L places tile a twindragon, two Heighway dragons back to back.",
    source:
      "Knuth, The Art of Computer Programming vol. 2 §4.1; Davis & Knuth, “Number representations and dragon curves” (1970)",
  },
  {
    id: "quater-imaginary",
    label: "Knuth’s quater-imaginary",
    code: "base 2i with digits 0, 1, 2, and 3 color by 1st",
    maxLength: 7,
    note: "Digits 0–3 are not one per residue class mod 2i (2 ≡ 0), so the integer expansions only reach even imaginary parts; Knuth's system writes the rest with a radix point.",
    source: "Knuth, “An imaginary number system” (1960)",
  },
  {
    id: "katai-szabo",
    label: "Base −2 + i",
    code: "base -2+i with digits 0, 1, 2, 3, and 4 color by lead",
    maxLength: 6,
    note: "Kátai and Szabó showed −n + i with digits 0 … n² represents every Gaussian integer uniquely; n = 2 tiles with a five-fold fractal.",
    source: "Kátai & Szabó, “Canonical number systems for complex integers” (1975)",
  },
  {
    id: "gosper-island",
    label: "Gosper island",
    code: "base 3+ω with digits 0, 1, ω, -1-ω, -1, -ω, and 1+ω color by lead",
    maxLength: 5,
    note: "Base (5 + √−3)/2 with 0 and the six units as digits: seven copies of the whole make the whole, each scaled by 1/√7 and turned by arctan(√3/5).",
    source: "Gosper’s flowsnake (1973); Mandelbrot, The Fractal Geometry of Nature (1982)",
  },
  {
    id: "eisenstein-three",
    label: "Base −1 + ω",
    code: "base -1+ω with digits 0, 1, and 1+ω color by lead",
    maxLength: 9,
    note: "The Eisenstein integers in base −1 + ω, of norm 3, with digits 0, 1 and 1 + ω (a unit): a three-fold tile.",
    source: "TheGrayCuber’s imaginary-bases introduction",
  },
  {
    id: "square",
    label: "A square, by base 2",
    code: "base 2 with digits 0, 1, i, and 1+i color by 1st",
    maxLength: 7,
    note: "Base 2 with digits 0, 1, i, 1 + i writes the real and imaginary parts in binary side by side: the tile is a square.",
    source: "",
  },
];

export const FAVORITES: readonly RadixExample[] = (favorites as { code: string; by: string }[]).map(
  ({ code, by }, k) => ({
    id: `favorite-${k + 1}`,
    label: `Favorite ${k + 1}${by ? ` (${by})` : ""}`,
    code,
    maxLength: 0,
    note: "",
    source: by
      ? `submitted by ${by} to TheGrayCuber’s imaginary-bases page`
      : "from TheGrayCuber’s imaginary-bases page",
  }),
);

export const EXAMPLES: readonly RadixExample[] = [...NOTABLE, ...FAVORITES];

export const exampleNamed = (id: string | undefined): RadixExample | undefined => EXAMPLES.find((e) => e.id === id);
