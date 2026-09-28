# Carrier domains

Every carrier domain in `@enumeratio/domains` — the nominal types a combinatorial
object is stored and dispatched as (`Permutation`, `IntegerPartition`,
`AlternatingSignMatrix`, …). The badge is the underlying storage **shape** (what a
value actually is: `list<integer>`, `matrix<integer>`, …); the domain is the
_meaning_ laid over that shape, which is what [statistics](/reference/statistics/)
and [maps](/reference/maps/) dispatch on.

<script setup>
import { domainsRows } from "../../.vitepress/data/catalogs.ts";
</script>

<ClientOnly>
  <ReferenceCatalog :rows="domainsRows" badge-label="storage shape" />
</ClientOnly>
