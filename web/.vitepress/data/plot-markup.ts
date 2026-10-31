// A plot panel's Epsil (`ComplexPlot(Gamma(z), {z, ...})`) as the element that draws it. A
// `<dynamic-box>` only reads an expression out as mathematics; the picture is the head's own
// component (`graphics-box`, `notatio-complex-plot`), the one a `Manipulate` body gets.

/** The markup drawing `value`, with its `_slot` wildcards left for a `<notatio-manipulate>` to fill; undefined when it is no picture. */
export async function plotMarkup(value: string): Promise<string | undefined> {
  // Browser-side and lazy: the front end brings the engine with it.
  const [{ plainJson, markupOf, renderingOf }, { parseExpression }] = await Promise.all([
    import("@enumeratio/frontend"),
    import("@enumeratio/formats/expression"),
  ]);
  const { json, errors } = parseExpression(value);
  if (errors.length > 0) return undefined;
  const rendering = renderingOf(plainJson(json as never) as never, true);
  return rendering === undefined || rendering.tag === "dynamic-box" ? undefined : markupOf(rendering);
}
