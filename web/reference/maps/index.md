# Combinatorial maps

Every combinatorial map in `@enumeratio/domains` — a structure-respecting function
from one carrier to another (a bijection, a forgetful map, a statistic-preserving
correspondence). The badge is `from → to`. Frontier maps (dimmed) are named and
have a known signature but no definition yet.

<script setup>
import { mapsRows } from "../../.vitepress/data/catalogs.ts";
</script>

<ClientOnly>
  <ReferenceCatalog :rows="mapsRows" badge-label="from → to" />
</ClientOnly>
