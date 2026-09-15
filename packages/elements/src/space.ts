import type { BoxedExpression } from "@cortex-js/compute-engine";

// The shared view a workworksheet's panes are drawn into.
//
// The model is deliberately one thing rather than per-renderer settings. A 2-D graphic
// is a camera at a standard distance looking straight at a point, so `center` plus
// `extent` is a camera, and `azimuth`/`elevation` are the angles it happens to be
// sitting at (zero and zero, looking down the axis, for anything flat). Nothing here
// renders through three.js today -- each pane still goes to the renderer that suits it
// -- but the state is the shared one, so "drop into 3-space and rotate" later is a
// change of view rather than a second way of describing where things are.
//
// Every field is settable from the worksheet as a *cell*, in a namespace of its own: a
// setting is written `\mathsf{extent}`, which compute-engine reads as the distinct
// symbol `extent_sansserif` and so can never collide with an ordinary `extent` the
// author is using for mathematics. Wolfram reserves a context for the same purpose.

/** The suffix compute-engine gives a `\mathsf{…}` symbol. */
const SETTING_SUFFIX = "_sansserif";

/** `extent_sansserif` -> `extent`; undefined for an ordinary symbol. */
export function settingName(symbol: string): string | undefined {
  return symbol.endsWith(SETTING_SUFFIX) ? symbol.slice(0, -SETTING_SUFFIX.length) : undefined;
}

/** Is this cell binding a setting rather than a value? */
export const isSetting = (name: string | undefined): boolean =>
  name !== undefined && settingName(name) !== undefined;

export interface SpaceView {
  /** Where the camera looks, in the plane. */
  center: [number, number];
  /** How much of the plane it takes in -- the camera's distance. */
  extent: number;
  /** Orientation, in degrees. Flat panes sit at the straight-on default. */
  azimuth: number;
  elevation: number;
  /** Pane height in CSS pixels. */
  height: number;
}

/**
 * The view a projection gets when nothing says otherwise. These are the `Auto` values:
 * not arbitrary constants but the framing each kind of picture is usually about — the
 * unit disk and its surroundings for a portrait, a couple of periods for a curve.
 */
export const AUTO_VIEW: Record<string, SpaceView> = {
  portrait: { center: [0, 0], extent: 2.4, azimuth: 0, elevation: 0, height: 320 },
  curve: { center: [0, 0], extent: 2 * Math.PI, azimuth: 0, elevation: 0, height: 260 },
  surface: { center: [0, 0], extent: 3, azimuth: 45, elevation: 30, height: 320 },
  image: { center: [0, 0], extent: 2, azimuth: 0, elevation: 0, height: 320 },
  curve3d: { center: [0, 0], extent: 2, azimuth: 45, elevation: 25, height: 340 },
};

/** A number from a boxed setting, or undefined if it is not one. */
function numberOf(value: BoxedExpression | undefined): number | undefined {
  if (!value) return undefined;
  return Number.isFinite(value.re) && value.im === 0 ? value.re : undefined;
}

/** A real from a MathJSON leaf, however it is spelled. */
function jsonNumber(node: unknown): number | undefined {
  if (typeof node === "number") return node;
  if (Array.isArray(node) && node.length === 3 && node[0] === "Rational") {
    const p = jsonNumber(node[1]);
    const q = jsonNumber(node[2]);
    return p !== undefined && q !== undefined && q !== 0 ? p / q : undefined;
  }
  if (typeof node === "object" && node !== null) {
    const num = (node as { num?: unknown }).num;
    if (typeof num === "string") {
      const v = Number(num.replace(/_/g, ""));
      return Number.isFinite(v) ? v : undefined;
    }
  }
  return undefined;
}

/**
 * A 2-vector from `(a, b)` or `[a, b]`, or a bare number meaning both axes. Read off
 * the MathJSON rather than the boxed operands, which are not part of the public type.
 */
function pairOf(value: BoxedExpression | undefined): [number, number] | undefined {
  if (!value) return undefined;
  const single = numberOf(value);
  if (single !== undefined) return [single, single];
  const json = value.json as unknown;
  if (!Array.isArray(json) || json.length !== 3) return undefined;
  if (!PAIR_HEADS.has(String(json[0]))) return undefined;
  const a = jsonNumber(json[1]);
  const b = jsonNumber(json[2]);
  return a !== undefined && b !== undefined ? [a, b] : undefined;
}

/** How a two-component setting may be written. */
const PAIR_HEADS = new Set(["Tuple", "List", "Pair", "Delimiter", "Sequence"]);

/** Is this setting explicitly `Auto` — i.e. "work it out"? */
const isAuto = (value: BoxedExpression | undefined): boolean => {
  const json = value?.json as unknown;
  return json === "Auto" || json === "Automatic";
};

/**
 * Resolve a projection's view: start from its `Auto` defaults and apply whatever the
 * worksheet's setting cells say. A setting written as `Auto` keeps the default, which is
 * how an author asks for the automatic value back without deleting the cell.
 *
 * A domain is accepted as a range — `xdomain := (-3, 3)` — and converted to the
 * centre-and-extent the camera actually holds, since that is the same statement made
 * two ways and authors think in ranges.
 */
export function resolveView(
  kind: string,
  settings: ReadonlyMap<string, BoxedExpression>,
): SpaceView {
  const base = AUTO_VIEW[kind] ?? AUTO_VIEW.portrait;
  const view: SpaceView = { ...base, center: [...base.center] as [number, number] };
  const read = (name: string) => {
    const v = settings.get(name);
    return isAuto(v) ? undefined : v;
  };

  const centre = pairOf(read("center"));
  if (centre) view.center = centre;

  const extent = numberOf(read("extent"));
  if (extent !== undefined && extent > 0) view.extent = extent;

  // A range restates centre and extent. Where both axes are given, the wider one wins
  // so a square pane still shows all of what was asked for -- but an axis left unsaid
  // must not compete, or its default would silently widen the axis that was specified.
  const xdomain = pairOf(read("xdomain"));
  const ydomain = pairOf(read("ydomain"));
  if (xdomain) view.center[0] = (xdomain[0] + xdomain[1]) / 2;
  if (ydomain) view.center[1] = (ydomain[0] + ydomain[1]) / 2;
  const spans = [xdomain, ydomain]
    .filter((d): d is [number, number] => d !== undefined)
    .map((d) => Math.abs(d[1] - d[0]))
    .filter((span) => span > 0);
  if (spans.length > 0) view.extent = Math.max(...spans);

  const azimuth = numberOf(read("azimuth"));
  if (azimuth !== undefined) view.azimuth = azimuth;
  const elevation = numberOf(read("elevation"));
  if (elevation !== undefined) view.elevation = elevation;
  const height = numberOf(read("height"));
  if (height !== undefined && height > 0) view.height = height;

  return view;
}

/** The `x-domain`/`y-domain` a plot element wants, back out of the camera. */
export function domainsOf(view: SpaceView): { x: [number, number]; y: [number, number] } {
  const half = view.extent / 2;
  return {
    x: [view.center[0] - half, view.center[0] + half],
    y: [view.center[1] - half, view.center[1] + half],
  };
}

/**
 * How many dimensions a projection's picture fills. This is what orders the stack: a
 * lower-dimensional thing sits *above* a higher-dimensional one, because a point hidden
 * under a plane is a point you cannot see, while a plane under a point loses almost
 * nothing. Points over curves over planes, as a default perspective.
 */
export const PROJECTION_DIMENSION: Record<string, number> = {
  point: 0,
  curve: 1,
  surface: 2,
  portrait: 2,
  image: 2,
  curve3d: 1,
};

/**
 * Does this projection paint the whole field opaquely? Two domain colourings cannot
 * usefully overlap -- the upper one simply hides the lower -- so only the topmost
 * needs drawing at all.
 */
export const isOpaqueField = (kind: string): boolean => kind === "portrait" || kind === "image";

export interface Layer<T> {
  item: T;
  /** Larger is nearer the viewer. */
  z: number;
}

/**
 * Order drawables into stacking layers and drop the ones nothing would show.
 *
 * Cell order breaks ties, earlier cells on top, as in Desmos -- the row you wrote first
 * is the one you are most likely to be looking at. Everything an opaque field would
 * hide is discarded rather than drawn and covered.
 */
export function stackLayers<T>(items: readonly T[], kindOf: (item: T) => string): Layer<T>[] {
  const ordered = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const byDimension =
        PROJECTION_DIMENSION[kindOf(b.item)] - PROJECTION_DIMENSION[kindOf(a.item)];
      // Higher dimension first, so it ends up underneath.
      return byDimension !== 0 ? byDimension : b.index - a.index;
    });

  // Walking from the bottom up, an opaque field hides everything already placed.
  const visible: { item: T; index: number }[] = [];
  for (const entry of ordered) {
    if (isOpaqueField(kindOf(entry.item))) visible.length = 0;
    visible.push(entry);
  }
  return visible.map((entry, z) => ({ item: entry.item, z }));
}
