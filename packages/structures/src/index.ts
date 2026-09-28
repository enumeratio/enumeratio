import type { ComputeEngine } from "@cortex-js/compute-engine";
import { declareGenericHeads } from "./generic.ts";
import { conformNumbers } from "./numbers.ts";
import { ensureProtocols } from "./protocols.ts";

export { compare, type Conformance, conform, type Member, member } from "./conform.ts";
export { ancestry, ensureProtocols, PROTOCOLS, type Protocol, type ProtocolName } from "./protocols.ts";

/** The protocols, compute-engine's types' conformances, and the generic heads over them. */
export function declareStructures(ce: ComputeEngine): void {
  ensureProtocols(ce);
  conformNumbers(ce);
  declareGenericHeads(ce);
}
