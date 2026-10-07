// Color for plots, in three independent parts:
//
//   a GROUND    the background, text, grid and highlight a plot draws on;
//   a GRADIENT  for continuous values: explicit stops, blended in OKLab (or sRGB, for the
//               classic hue wheel), as a CSS gradient is defined;
//   a DISCRETE  scheme for categories: a fixed list, or Glasbey colors generated to stay far
//               from the gradient and the ground, so a category never reads as a value.
//
// A palette names one of each; any part can be swapped on its own. Canvas can't resolve CSS
// variables, so every color here is a literal.

import { schemeDark2, schemeObservable10, schemeSet1, schemeSet2, schemeTableau10 } from "d3-scale-chromatic";

export interface GradientStop {
  /** Position in [0, 1]. */
  readonly at: number;
  readonly color: string;
}

export interface Gradient {
  readonly name: string;
  readonly label: string;
  readonly stops: readonly GradientStop[];
  /** The space stops blend in: OKLab (perceptually even), or sRGB (the hue wheel's own path). */
  readonly space: "oklab" | "srgb";
  /** The last stop is the first, so the gradient can wrap without a seam. */
  readonly cyclic: boolean;
}

export interface Ground {
  readonly name: string;
  readonly dark: boolean;
  readonly background: string;
  /** Text and labels. */
  readonly foreground: string;
  /** Grid lines, low contrast against the background. */
  readonly grid: string;
  /** De-emphasized marks. */
  readonly muted: string;
  /** Selection and hover. */
  readonly highlight: string;
}

export interface DiscreteScheme {
  readonly name: string;
  readonly label: string;
  /** A fixed list, or `glasbey`: generated to stay far from the gradient and the ground. */
  readonly colors: readonly string[] | "glasbey";
}

/** A named combination; any of its parts can be overridden where it is used. */
export interface PaletteSpec {
  readonly name: string;
  readonly label: string;
  readonly ground: string;
  readonly gradient: string;
  readonly discrete: string;
}

/** A palette with its parts looked up: what a renderer draws with. */
export interface Palette extends Ground {
  readonly label: string;
  readonly gradient: Gradient;
  readonly reversed: boolean;
  readonly discrete: DiscreteScheme;
}

// ── Color math ──────────────────────────────────────────────────────────────────────────

type Rgb = readonly [number, number, number];
type Lab = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const clamp01 = (t: number): number => (t > 0 ? (t < 1 ? t : 1) : 0);

export function rgbToHex([r, g, b]: Rgb): string {
  const byte = (v: number) =>
    Math.round(clamp01(v) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB to OKLab (Ottosson 2020). */
export function rgbToOklab([r, g, b]: Rgb): Lab {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToRgb([L, a, b]: Lab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(Math.max(0, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    fromLinear(Math.max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    fromLinear(Math.max(0, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ];
}

/** Perceptual distance: Euclidean in OKLab. */
export const deltaE = (x: Lab, y: Lab): number => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);

// ── Gradients ────────────────────────────────────────────────────────────────────────────

const even = (colors: readonly string[]): GradientStop[] =>
  colors.map((color, i) => ({ at: i / (colors.length - 1), color }));

const gradient = (name: string, label: string, colors: readonly string[], extra: Partial<Gradient> = {}): Gradient => ({
  name,
  label,
  stops: even(colors),
  space: "oklab",
  cyclic: false,
  ...extra,
});

// The perceptual ramps' stops are d3-scale-chromatic's (matplotlib's viridis family, Turbo,
// Cubehelix, Sinebow) sampled evenly; between stops the blend is OKLab's.
export const GRADIENTS: readonly Gradient[] = [
  gradient("viridis", "Viridis", [
    "#440154",
    "#472d7b",
    "#3b528b",
    "#2c728e",
    "#21918c",
    "#28ae80",
    "#5ec962",
    "#addc30",
    "#fde725",
  ]),
  gradient("magma", "Magma", [
    "#000004",
    "#1d1147",
    "#51127c",
    "#832681",
    "#b73779",
    "#e75263",
    "#fc8961",
    "#fec488",
    "#fcfdbf",
  ]),
  gradient("inferno", "Inferno", [
    "#000004",
    "#210c4a",
    "#57106e",
    "#8a226a",
    "#bc3754",
    "#e45a31",
    "#f98e09",
    "#f9cb35",
    "#fcffa4",
  ]),
  gradient("plasma", "Plasma", [
    "#0d0887",
    "#4c02a1",
    "#7e03a8",
    "#aa2395",
    "#cc4778",
    "#e66c5c",
    "#f89540",
    "#fdc527",
    "#f0f921",
  ]),
  gradient("cividis", "Cividis", [
    "#002051",
    "#11366c",
    "#3c4d6e",
    "#62646f",
    "#7f7c75",
    "#9a9478",
    "#bbaf71",
    "#e2cb5c",
    "#fdea45",
  ]),
  gradient("turbo", "Turbo", [
    "#23171b",
    "#4b4ccb",
    "#3987f9",
    "#26bce1",
    "#2ee5ae",
    "#57fb7a",
    "#95fb51",
    "#d3e436",
    "#feb927",
    "#ff821d",
    "#e54813",
    "#af1a06",
    "#900c00",
  ]),
  gradient("warm", "Warm", ["#6e40aa", "#b23cb2", "#ee4395", "#ff5e63", "#ff8c38", "#d9c231", "#aff05b"]),
  gradient("cool", "Cool", ["#6e40aa", "#5465d6", "#2f96e0", "#1ac7c2", "#28ea8d", "#60f760", "#aff05b"]),
  gradient("cubehelix", "Cubehelix", [
    "#000000",
    "#1b1d3b",
    "#16534c",
    "#437731",
    "#a07949",
    "#d483a7",
    "#c7b3ed",
    "#cae7f0",
    "#ffffff",
  ]),
  gradient("dusk", "Dusk", ["#2d1b69", "#6a3d9a", "#b5479a", "#f08a5d", "#ffd166"]),
  gradient("ink", "Ink", ["#d9e4ec", "#7fa7c4", "#2f6690", "#1d3557", "#0b1426"]),
  // The classic domain-coloring wheel: hue is the argument, red at 0. Blended in sRGB, where
  // red to yellow is exactly the HSV hue path; fully saturated, as phase portraits draw it.
  gradient("phase", "Phase wheel", ["#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ff0000"], {
    space: "srgb",
    cyclic: true,
  }),
  gradient(
    "sinebow",
    "Sinebow",
    [
      "#ff4040",
      "#ee8011",
      "#bfbf00",
      "#7fee11",
      "#40ff40",
      "#11ee80",
      "#00bfbf",
      "#117fee",
      "#4040ff",
      "#7f11ee",
      "#bf00bf",
      "#ee117f",
      "#ff4040",
    ],
    {
      cyclic: true,
    },
  ),
];

/** The default for continuous values, and for a phase (an angle). */
export const DEFAULT_GRADIENT = "viridis";
export const DEFAULT_PHASE_GRADIENT = "phase";

/** A scheme's name as an expression writes it, PascalCase as Wolfram's are: `Dusk`, `Viridis`. */
export const schemeName = (g: Gradient): string => g.name.charAt(0).toUpperCase() + g.name.slice(1);

/** The gradient a name spells, as written in an expression (`Dusk`) or internally (`dusk`). */
export const gradientNamed = (name: string | undefined): Gradient =>
  GRADIENTS.find((g) => g.name === name || schemeName(g) === name) ??
  GRADIENTS.find((g) => g.name === DEFAULT_GRADIENT)!;

export const reverseGradient = (g: Gradient): Gradient => ({
  ...g,
  stops: g.stops.map((s) => ({ at: 1 - s.at, color: s.color })).toReversed(),
});

const LUT_SIZE = 256;
const luts = new WeakMap<Gradient, string[]>();

/** The gradient at t ∈ [0, 1] (clamped; a cyclic gradient wraps), from a 256-entry table. */
export function sampleGradient(g: Gradient, t: number): string {
  let lut = luts.get(g);
  if (lut === undefined) {
    lut = Array.from({ length: LUT_SIZE }, (_, k) => blend(g, k / (LUT_SIZE - 1)));
    luts.set(g, lut);
  }
  const u = g.cyclic ? t - Math.floor(t) : clamp01(t);
  return lut[Math.round(u * (LUT_SIZE - 1))]!;
}

function blend(g: Gradient, t: number): string {
  const stops = g.stops;
  let k = 1;
  while (k < stops.length - 1 && stops[k]!.at < t) k++;
  const [a, b] = [stops[k - 1]!, stops[k]!];
  const f = b.at === a.at ? 0 : clamp01((t - a.at) / (b.at - a.at));
  const mix = (p: Rgb | Lab, q: Rgb | Lab) => [0, 1, 2].map((i) => p[i]! + (q[i]! - p[i]!) * f) as unknown as Rgb;
  const [x, y] = [hexToRgb(a.color), hexToRgb(b.color)];
  return rgbToHex(g.space === "srgb" ? mix(x, y) : oklabToRgb(mix(rgbToOklab(x), rgbToOklab(y))));
}

/** The gradient as CSS, for a legend swatch. */
export const gradientCss = (g: Gradient, direction = "90deg"): string =>
  `linear-gradient(${direction}, ${Array.from({ length: 9 }, (_, k) => sampleGradient(g, k / 8)).join(", ")})`;

/**
 * Where a value falls on the gradient, given the band — the distance in value between the
 * gradient's two ends:
 *
 *   reflect  0 at 0, 2B, 4B…; 1 at B, 3B…, sweeping up then back, so there is no seam;
 *   wrap     0 at 0, B, 2B…, jumping back at each — for a cyclic gradient, where 0 is 1;
 *   clamp    one sweep from 0 to B, then held at 1.
 */
export type BandMode = "reflect" | "wrap" | "clamp";

export const BAND_MODES: readonly BandMode[] = ["reflect", "wrap", "clamp"];

export function bandPosition(value: number, band: number, mode: BandMode): number {
  const t = value / band;
  if (mode === "clamp") return clamp01(t);
  if (mode === "wrap") return t - Math.floor(t);
  const u = t / 2 - Math.floor(t / 2);
  return 1 - Math.abs(2 * u - 1);
}

// ── Grounds ──────────────────────────────────────────────────────────────────────────────

export const GROUNDS: readonly Ground[] = [
  {
    name: "night",
    dark: true,
    background: "#0b0b12",
    foreground: "#e6e6ee",
    grid: "#2a2a38",
    muted: "#5a5a6a",
    highlight: "#ffffff",
  },
  {
    name: "dusk",
    dark: true,
    background: "#1a1033",
    foreground: "#e9e1f7",
    grid: "#2f2352",
    muted: "#6a5a8e",
    highlight: "#ffffff",
  },
  {
    name: "slate",
    dark: true,
    background: "#2a2a38",
    foreground: "#ececf3",
    grid: "#3c3c4e",
    muted: "#6c6c80",
    highlight: "#ffffff",
  },
  {
    name: "paper",
    dark: false,
    background: "#fbf8f1",
    foreground: "#2b2622",
    grid: "#e2dccd",
    muted: "#a59d8c",
    highlight: "#000000",
  },
  {
    name: "black",
    dark: true,
    background: "#000000",
    foreground: "#ffffff",
    grid: "#333333",
    muted: "#777777",
    highlight: "#ffff00",
  },
];

// ── Discrete schemes ─────────────────────────────────────────────────────────────────────

export const DISCRETE_SCHEMES: readonly DiscreteScheme[] = [
  { name: "glasbey", label: "Distinct from the gradient", colors: "glasbey" },
  { name: "tableau10", label: "Tableau 10", colors: schemeTableau10 },
  { name: "observable10", label: "Observable 10", colors: schemeObservable10 },
  { name: "set1", label: "Set 1", colors: schemeSet1 },
  { name: "set2", label: "Set 2", colors: schemeSet2 },
  { name: "dark2", label: "Dark 2", colors: schemeDark2 },
];

export const discreteNamed = (name: string | undefined): DiscreteScheme =>
  DISCRETE_SCHEMES.find((s) => s.name === name) ?? DISCRETE_SCHEMES[0]!;

/** Candidate colors for Glasbey's search: a 16-step sRGB cube, in OKLab. */
let candidates: { hex: string; lab: Lab }[] | undefined;
function candidateColors(): { hex: string; lab: Lab }[] {
  if (candidates) return candidates;
  const out: { hex: string; lab: Lab }[] = [];
  for (let r = 0; r < 16; r++) {
    for (let g = 0; g < 16; g++) {
      for (let b = 0; b < 16; b++) {
        const rgb: Rgb = [r / 15, g / 15, b / 15];
        out.push({ hex: rgbToHex(rgb), lab: rgbToOklab(rgb) });
      }
    }
  }
  return (candidates = out);
}

/** Lightness band a category's color keeps to, to read against the ground. */
const LIGHTNESS = { dark: [0.62, 0.95], light: [0.35, 0.72] } as const;
/** Least OKLab chroma: grays are left to the ground's own muted marks. */
const MIN_CHROMA = 0.07;

/**
 * Glasbey's method (Glasbey, van der Heijden, Toh & Gray 2007): each color in turn is the
 * candidate farthest — least distance to anything already taken, maximized — from the colors
 * so far, starting from the ones it must avoid. Deterministic: ties keep the earlier candidate.
 */
export function glasbey(n: number, avoid: readonly string[], dark: boolean): string[] {
  const [lo, hi] = dark ? LIGHTNESS.dark : LIGHTNESS.light;
  const pool = candidateColors().filter(
    ({ lab }) => lab[0] >= lo && lab[0] <= hi && Math.hypot(lab[1], lab[2]) >= MIN_CHROMA,
  );
  const avoided = avoid.map((c) => rgbToOklab(hexToRgb(c)));
  const nearest = pool.map(({ lab }) => Math.min(...avoided.map((a) => deltaE(lab, a))));
  const chosen: string[] = [];
  for (let k = 0; k < n && pool.length > 0; k++) {
    let best = 0;
    for (let i = 1; i < pool.length; i++) if (nearest[i]! > nearest[best]!) best = i;
    const pick = pool[best]!;
    chosen.push(pick.hex);
    for (let i = 0; i < pool.length; i++) nearest[i] = Math.min(nearest[i]!, deltaE(pool[i]!.lab, pick.lab));
  }
  return chosen;
}

const glasbeyCache = new Map<string, string[]>();

/** `n` colors for categories on this palette. */
export function discreteColors(palette: Palette, n: number): string[] {
  const count = Math.max(0, Math.floor(n));
  const scheme = palette.discrete.colors;
  if (scheme !== "glasbey") return Array.from({ length: count }, (_, i) => scheme[i % scheme.length]!);
  const key = `${palette.gradient.name}:${palette.reversed}:${palette.background}:${count}`;
  let colors = glasbeyCache.get(key);
  if (colors === undefined) {
    const avoid = [
      palette.background,
      palette.foreground,
      palette.muted,
      ...Array.from({ length: 24 }, (_, k) => sampleGradient(palette.gradient, k / 23)),
    ];
    colors = glasbey(count, avoid, palette.dark);
    glasbeyCache.set(key, colors);
  }
  return colors;
}

// ── Palettes ─────────────────────────────────────────────────────────────────────────────

export const PALETTES: readonly PaletteSpec[] = [
  { name: "dusk", label: "Dusk", ground: "dusk", gradient: "dusk", discrete: "glasbey" },
  { name: "viridis", label: "Viridis", ground: "night", gradient: "viridis", discrete: "glasbey" },
  { name: "magma", label: "Magma", ground: "night", gradient: "magma", discrete: "glasbey" },
  { name: "inferno", label: "Inferno", ground: "night", gradient: "inferno", discrete: "glasbey" },
  { name: "plasma", label: "Plasma", ground: "night", gradient: "plasma", discrete: "glasbey" },
  { name: "cividis", label: "Cividis", ground: "night", gradient: "cividis", discrete: "glasbey" },
  { name: "turbo", label: "Turbo", ground: "night", gradient: "turbo", discrete: "glasbey" },
  { name: "cubehelix", label: "Cubehelix", ground: "slate", gradient: "cubehelix", discrete: "glasbey" },
  { name: "warm", label: "Warm", ground: "paper", gradient: "warm", discrete: "glasbey" },
  { name: "cool", label: "Cool", ground: "paper", gradient: "cool", discrete: "glasbey" },
  { name: "paper", label: "Paper", ground: "paper", gradient: "ink", discrete: "dark2" },
  { name: "phase", label: "Phase wheel", ground: "night", gradient: "phase", discrete: "glasbey" },
  { name: "contrast", label: "High contrast", ground: "black", gradient: "turbo", discrete: "set1" },
];

export const DEFAULT_PALETTE = "dusk";

export interface PaletteChoice {
  readonly palette?: string | undefined;
  /** Override the palette's gradient, ground or discrete scheme by name. */
  readonly gradient?: string | undefined;
  readonly ground?: string | undefined;
  readonly discrete?: string | undefined;
  readonly reverse?: boolean | undefined;
}

const resolved = new Map<string, Palette>();

/** A palette with any overrides applied; unknown names fall back to the defaults. */
export function resolvePalette(choice: PaletteChoice = {}): Palette {
  const key = JSON.stringify([choice.palette, choice.gradient, choice.ground, choice.discrete, !!choice.reverse]);
  const cached = resolved.get(key);
  if (cached) return cached;
  const spec = PALETTES.find((p) => p.name === choice.palette) ?? PALETTES.find((p) => p.name === DEFAULT_PALETTE)!;
  const ground = GROUNDS.find((g) => g.name === (choice.ground || spec.ground)) ?? GROUNDS[0]!;
  const base = gradientNamed(choice.gradient || spec.gradient);
  const palette: Palette = {
    ...ground,
    name: spec.name,
    label: spec.label,
    gradient: choice.reverse ? reverseGradient(base) : base,
    reversed: !!choice.reverse,
    discrete: discreteNamed(choice.discrete || spec.discrete),
  };
  resolved.set(key, palette);
  return palette;
}

/** The named palette as specified, no overrides. */
export const paletteNamed = (name: string | undefined): Palette => resolvePalette({ palette: name });
