# Combinatorial statistics

Every combinatorial statistic in `@enumeratio/statistics` — a head applied to a
carrier (`Descents` on a `Permutation`, `LargestPart` on an `IntegerPartition`).
Each is a definition over the object, evaluable on any row of the matching
[collection](/reference/collections/). One head can be a different statistic on a
different carrier, so it appears once per carrier. The FindStat ids are established by
value — the definition evaluated on every object up to a size and matched by FindStat's
finder — or recorded in the enumeratio catalog, and the tooltip says which.

<script setup>
import { statisticsRows } from "../../.vitepress/data/catalogs.ts";
</script>

<ClientOnly>
  <ReferenceCatalog :rows="statisticsRows" badge-label="carrier" />
</ClientOnly>
