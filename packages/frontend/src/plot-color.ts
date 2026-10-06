// How a plot reads its color options: three attributes shared by every element that
// draws data in color, resolved against palettes.ts. Only DATA colors come from here;
// axes, text and the background follow the page theme.

import {
  DEFAULT_GRADIENT,
  DISCRETE_SCHEMES,
  discreteColors,
  GRADIENTS,
  type Gradient,
  type Palette,
  resolvePalette,
  sampleGradient,
} from "./palettes.ts";

export interface ColorOptions {
  /** A gradient name for continuous values (default `viridis`; `phase` for an angle). */
  gradient?: string | undefined;
  /** A discrete scheme name for categories (default `tableau10`). */
  discrete?: string | undefined;
  /** Run the gradient from its last stop to its first. */
  reverse?: boolean | undefined;
}

export const DEFAULT_DISCRETE = "tableau10";

/** The gradient a name picks, ignoring case; `fallback` for an empty or unknown name. */
export function gradientName(name: string | undefined, fallback: string = DEFAULT_GRADIENT): string {
  const wanted = name?.trim().toLowerCase();
  return GRADIENTS.find((g) => g.name === wanted)?.name ?? fallback;
}

/** The discrete scheme a name picks, ignoring case; the default for an empty or unknown name. */
export function discreteName(name: string | undefined): string {
  const wanted = name?.trim().toLowerCase();
  return DISCRETE_SCHEMES.find((s) => s.name === wanted)?.name ?? DEFAULT_DISCRETE;
}

/**
 * The palette a plot draws with. The ground is `paper`, whose mid-lightness band suits
 * Glasbey colors on a light or a dark page alike; `fallback` is the gradient for a plot
 * whose values are an angle (`phase`) rather than a magnitude.
 */
export function plotPalette(options: ColorOptions = {}, fallback: string = DEFAULT_GRADIENT): Palette {
  return resolvePalette({
    ground: "paper",
    gradient: gradientName(options.gradient, fallback),
    discrete: discreteName(options.discrete),
    reverse: options.reverse,
  });
}

/** The gradient a plot draws continuous values with. */
export const gradientOf = (options: ColorOptions = {}, fallback: string = DEFAULT_GRADIENT): Gradient =>
  plotPalette(options, fallback).gradient;

/** A color on the plot's gradient, `t` in [0, 1]; a non-finite `t` is the first stop. */
export const rampColor = (palette: Palette, t: number): string => sampleGradient(palette.gradient, t);

/** The first `n` category colors (at least one, so a lone series still has its color). */
export const categoryColors = (palette: Palette, n: number): string[] => discreteColors(palette, Math.max(1, n));
