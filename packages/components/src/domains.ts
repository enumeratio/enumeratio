// Named domains the libraries supply, for declarations: `Variable(ComplexBases, "twindragon")`
// ranges over every notable complex base and favorite, labeled as their menu names them.

import { registerDomain } from "@enumeratio/frontend/core";

registerDomain("ComplexBases", async () => {
  const { EXAMPLE_CHOICES } = await import("@enumeratio/complex-numerals/lattice");
  return EXAMPLE_CHOICES.map(([id, label]) => [`'${id}'`, label] as const);
});
