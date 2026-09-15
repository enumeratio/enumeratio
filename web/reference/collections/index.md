# Collections

Every collection head in `@enumeratio/collections` — the enumerable families
(`Subsets`, `SymmetricGroup`, `IntegerPartitions`, …) and the set operations over
them. Each is a lazy indexed family: `Count` is closed-form and `At` unranks. The
badge is the head's signature. Enumerable families carry their own
[symbol page](/reference/symbol/) with a live table; see the
[collection table](/playground/collection-table) to page any of them. The OEIS
numbers are established by count — the family's own kernel for the first sizes, matched
against the sequence's terms — and a ✓ says so.

<script setup>
import { collectionsRows } from "../../.vitepress/data/catalogs.ts";
</script>

<ClientOnly>
  <ReferenceCatalog :rows="collectionsRows" badge-label="signature" />
</ClientOnly>
