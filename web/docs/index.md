<script setup>
import { data } from "../.vitepress/data/repo-docs.data.ts";

const heading = {
  interface: "Interface",
  arithmetic: "Arithmetic",
  combinatorics: "Combinatorics",
  algebras: "Algebras",
  groups: "Groups, words and knots",
  analysis: "Analysis",
  evaluation: "Evaluation",
  foundation: "Foundation",
  tooling: "Tooling",
};
</script>

# Docs

How to use enumeratio and notatio, package by package. Each package's docs live in the
package itself (its README, and a `docs/` folder for longer pages), and read the same here
and on GitHub.

- [**Guides**](/guide/) — the walkthroughs of the mathematics, in reading order. Each one
  is a page of the package it introduces.
- [**Symbol reference**](/reference/symbol/) — every head, with examples that are also its
  tests. The [reference overview](/reference/) lists the rest: collections, statistics,
  maps, domains, formats and components.
- [**Explorations**](/explore/) — fewer words, more dials: one function per page, every
  constant on a slider.
- [**Worksheet**](/worksheet/) and [**notebook**](/notebook/) — the two kinds of sheet.
  [**Command line**](/docs/cli/): the same evaluation in a terminal, also live in the
  browser as a [REPL](/docs/cli/repl) and a [command line](/docs/cli/command-line).
- [**Playground**](/playground/) — every notatio component on its own page.

How the packages fit together, and which side of the enumeratio/notatio line each sits on,
is on the wiki's [Packages](https://github.com/enumeratio/enumeratio/wiki/Packages) page.

<template v-for="group in data.groups" :key="group.name">
  <h2 :id="group.name">{{ heading[group.name] ?? group.name }}</h2>
  <dl>
    <template v-for="pkg in group.packages" :key="pkg.slug">
      <dt><a :href="`/docs/${pkg.slug}/`"><code>{{ pkg.name }}</code></a></dt>
      <dd>
        {{ pkg.description }}
        <template v-if="pkg.pages.length">
          <br />
          <template v-for="(page, i) in pkg.pages" :key="page.link">
            <template v-if="i">, </template><a :href="page.link">{{ page.title }}</a>
          </template>
        </template>
      </dd>
    </template>
  </dl>
</template>
