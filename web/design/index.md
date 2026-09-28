---
title: Design
---

<script setup>
import { data } from "../.vitepress/data/repo-docs.data.ts";
</script>

# Design

How enumeratio and notatio are put together, and why: the design docs, as they stand in the
repository's `design/` folder. Some are settled, some are still drafts; each says which.

<ul>
  <li v-for="doc in data.design" :key="doc.slug"><a :href="`/design/${doc.slug}`">{{ doc.title }}</a></li>
</ul>
