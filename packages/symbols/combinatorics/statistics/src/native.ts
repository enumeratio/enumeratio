// Catalog statistics that are ALREADY compute-engine heads.
//
// A third category the reduction analysis forced into existence. enumeratio's partition
// statistic `Length` is not a statistic we need to define — it is compute-engine's `Length`
// applied to the list of parts, the same function under the same name. Defining it again
// produced a self-referential definition, which the tower analysis reported as a cycle.
//
// That is the best possible outcome for a name: it does not need us at all.

export interface NativeStatistic {
  readonly head: string;
  readonly on: string;
  readonly why: string;
}

export const NATIVE_TO_ENGINE: readonly NativeStatistic[] = [
  {
    head: "Length",
    on: "IntegerPartitions",
    why: "The number of parts is compute-engine's Length of the parts list — the same function, not a redefinition.",
  },
];
