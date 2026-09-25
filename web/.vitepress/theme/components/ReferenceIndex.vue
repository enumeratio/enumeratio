<script setup lang="ts">
import { crosswalkFor, SOURCES } from "@enumeratio/reference";
import { entriesByDomain } from "../../data/reference.ts";

// Documented heads are the reference; the generated stubs (carrier domains, and every
// symbol the bare engine binds) are listed after them, compactly, and kept out of the
// frontier tally -- a stub has no reference definition because nobody has written one.
const every = entriesByDomain();
const groups = every
  .map((group) => ({ ...group, entries: group.entries.filter((entry) => !entry.stub) }))
  .filter((group) => group.entries.length);
const stubGroups = every
  .map((group) => ({ ...group, entries: group.entries.filter((entry) => entry.stub) }))
  .filter((group) => group.entries.length);

// Where each head stands on the reduction (design/namespaces.md §6.1): it has a reference
// definition, it sits on the primitive frontier for a stated reason, or neither -- which is
// the population the frontier lint will eventually refuse.
type Standing = "defined" | "primitive" | "undeclared";
const standing = (entry: { implementations?: readonly { origin: string }[]; primitive?: string }): Standing =>
  entry.implementations?.some((impl) => impl.origin === "reference")
    ? "defined"
    : entry.primitive
      ? "primitive"
      : "undeclared";

const tally = (entries: readonly Parameters<typeof standing>[0][]): Record<Standing, number> => {
  const counts: Record<Standing, number> = { defined: 0, primitive: 0, undeclared: 0 };
  for (const entry of entries) counts[standing(entry)] += 1;
  return counts;
};
const total = tally(groups.flatMap((group) => group.entries));

// How far the crosswalk reaches: pointers per system over every page, documented and
// generated alike, and how many of each stand on a computation rather than a name.
const reach = (() => {
  const perSystem = new Map<string, { pointers: number; verified: number; broken: number }>();
  let heads = 0;
  let covered = 0;
  for (const group of every) {
    for (const entry of group.entries) {
      heads += 1;
      const references = crosswalkFor(entry.name, entry);
      if (references.length) covered += 1;
      for (const reference of references) {
        const row = perSystem.get(reference.system) ?? { pointers: 0, verified: 0, broken: 0 };
        row.pointers += 1;
        if (reference.verified?.count) row.verified += 1;
        if (reference.verified?.disagree) row.broken += 1;
        perSystem.set(reference.system, row);
      }
    }
  }
  const systems = [...perSystem]
    .map(([system, row]) => ({
      system,
      label: SOURCES[system as keyof typeof SOURCES].label,
      ...row,
    }))
    .sort((a, b) => b.pointers - a.pointers);
  return { heads, covered, systems, pointers: systems.reduce((n, s) => n + s.pointers, 0) };
})();
const all = groups.reduce((n, group) => n + group.entries.length, 0);
</script>

<template>
  <div class="reference-index">
    <p class="ref-frontier">
      {{ all }} heads — <span class="ref-standing is-defined">{{ total.defined }} defined</span> by a reference
      expression, <span class="ref-standing is-primitive">{{ total.primitive }} primitive</span> on the declared
      frontier, and {{ total.undeclared }} not yet placed either way.
    </p>
    <p class="ref-frontier">
      Elsewhere: {{ reach.pointers }} pointers from {{ reach.covered }} of {{ reach.heads }} pages into
      {{ reach.systems.length }} systems —
      <template v-for="(s, i) in reach.systems" :key="s.system"
        ><span class="ref-reach"
          >{{ s.label }} {{ s.pointers
          }}<span v-if="s.verified" class="ref-reach-verified" title="verified by computation"
            >&nbsp;✓{{ s.verified }}</span
          ></span
        ><template v-if="i < reach.systems.length - 1">, </template></template
      >.
    </p>
    <section v-for="group in groups" :key="group.domain">
      <h2>
        {{ group.domain }}
        <span class="ref-domain-tally">
          <template v-if="tally(group.entries).defined">
            <span class="ref-standing is-defined">{{ tally(group.entries).defined }} ≝</span>
          </template>
          <template v-if="tally(group.entries).primitive">
            <span class="ref-standing is-primitive">{{ tally(group.entries).primitive }} primitive</span>
          </template>
        </span>
      </h2>
      <ul>
        <li v-for="entry in group.entries" :key="entry.name">
          <a :href="`/reference/symbol/${entry.name}`"
            ><code>{{ entry.name }}</code></a
          >
          <span v-if="standing(entry) === 'defined'" class="ref-standing is-defined" title="Has a reference definition"
            >≝</span
          >
          <span
            v-else-if="standing(entry) === 'primitive'"
            class="ref-standing is-primitive"
            :title="`On the primitive frontier: ${entry.primitive}`"
            >{{ entry.primitive }}</span
          >
          -- {{ entry.summary }}
        </li>
      </ul>
    </section>
    <section v-for="group in stubGroups" :key="group.domain" class="ref-stubs">
      <h2>{{ group.domain }}</h2>
      <p class="ref-frontier">
        {{ group.entries.length }} generated pages -- each with the symbol's own description and its crosswalk, and no
        examples yet.
      </p>
      <ul class="ref-stub-list">
        <li v-for="entry in group.entries" :key="entry.name">
          <a :href="`/reference/symbol/${entry.name}`" :title="entry.summary"
            ><code>{{ entry.name }}</code></a
          >
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.ref-frontier {
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}
.ref-domain-tally {
  margin-left: 0.5rem;
  font-weight: 400;
  font-size: 0.75rem;
}
.ref-standing {
  display: inline-block;
  margin: 0 0.15rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  font-family: var(--vp-font-family-mono);
  font-size: 0.72rem;
  line-height: 1.5;
  white-space: nowrap;
}
.ref-standing.is-defined {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.ref-standing.is-primitive {
  background: rgba(217, 147, 26, 0.14);
  color: #b7791f;
}
.ref-reach {
  white-space: nowrap;
}
.ref-reach-verified {
  color: var(--vp-c-green-1, #3a9c5a);
  font-size: 0.85em;
}
.ref-reach-broken {
  color: var(--vp-c-warning-1, #d9931a);
  font-size: 0.85em;
  font-weight: 700;
}
.ref-stub-list {
  columns: 4 10rem;
  list-style: none;
  padding: 0;
  font-size: 0.85rem;
}
.ref-stub-list li {
  margin: 0;
  break-inside: avoid;
}
</style>
