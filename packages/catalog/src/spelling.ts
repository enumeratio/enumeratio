// enumeratio ids are snake_case; notatio heads are PascalCase. One transform, used by the
// extractor and by anything resolving an enumeratio id at runtime.

/** `weak_compositions_into_k_parts` -> `WeakCompositionsIntoKParts` */
export const pascal = (id: string): string =>
  id
    .split("_")
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join("");
