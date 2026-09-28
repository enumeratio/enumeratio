---
title: Packages
---

<script setup>
import { data } from "../.vitepress/data/repo-docs.data.ts";
</script>

# Packages

The workspace packages, each with a short page. How they fit together, and which side of
the enumeratio/notatio line each sits on, is in [the package map](/design/packages).

<dl>
  <template v-for="pkg in data.packages" :key="pkg.slug">
    <dt><a :href="`/packages/${pkg.slug}`"><code>{{ pkg.name }}</code></a></dt>
    <dd>{{ pkg.description }}</dd>
  </template>
</dl>
