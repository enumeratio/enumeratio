// A head's function view for its reference page, from the manifest's typed signature and the
// record's `plot:` hint. Build time (Node): the page carries the small result, not the manifest.

import { functionViewOf, returnTypeOf, type FunctionView } from "@enumeratio/frontend/function-view";
import { parseParameters, SYMBOLS, winningOverload } from "@enumeratio/manifest";

export function functionViewFor(head: string): FunctionView | undefined {
  const info = Object.hasOwn(SYMBOLS, head) ? SYMBOLS[head] : undefined;
  const type = info === undefined ? undefined : winningOverload(info.overloads)?.type;
  const parameters = info === undefined || type === undefined ? undefined : parseParameters(type, info.params);
  if (info === undefined || type === undefined || parameters === undefined) return undefined;
  const returns = returnTypeOf(type);
  return functionViewOf(
    {
      head,
      parameters: parameters.map(({ name, type, optional, variadic }) => ({
        ...(name === undefined ? {} : { name }),
        type,
        optional,
        variadic,
      })),
      ...(returns === undefined ? {} : { returns }),
    },
    info,
  );
}
