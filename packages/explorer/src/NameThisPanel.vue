<script setup lang="ts">
// NAME THIS — the statement read back as the registry rows it would become, plus the named collections structurally
// near it. Purely a view over nameStatement(); the parent mounts it when the panel is open.
import { ref, watch } from 'vue'
import InputText from 'primevue/inputtext'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import Message from 'primevue/message'
import { nameStatement, type Naming, type Related, type RowQuery } from '@enumeratio/client'

const props = defineProps<{ query: RowQuery }>()

const nameInput = ref('')
const naming = ref<Naming | null>(null)
const namingError = ref<string | null>(null)
const namingLoading = ref(false)
let nameTimer: ReturnType<typeof setTimeout> | undefined
async function runName() {
  if (!props.query.from.trim()) { naming.value = null; namingError.value = null; return }
  namingLoading.value = true
  try { naming.value = await nameStatement(props.query, nameInput.value); namingError.value = null }
  catch (e) { namingError.value = (e as Error).message; naming.value = null }
  finally { namingLoading.value = false }
}
function scheduleName() { clearTimeout(nameTimer); nameTimer = setTimeout(() => void runName(), 400) }
watch(() => props.query, scheduleName, { deep: true })
watch(nameInput, scheduleName)
void runName()

// relate a collection to the current statement — link into the query view and the collection explorer
const REL_SYM: Record<Related['relation'], string> = {
  equals: '=', refines: '⊂', coarsens: '⊃', child: '↳', parent: '↰', triangle: '△', 'row-sums': 'Σ', construction: 'λ', sibling: '≀' }
function queryLink(coll: string) { return `/explore/query?from=${encodeURIComponent(coll)}` }
function collLink(coll: string) { return `/explore/collection/${coll}` }
</script>

<template>
  <section class="name">
    <div class="name-in">
      <InputGroup class="seg">
        <InputGroupAddon class="kw">NAME</InputGroupAddon>
        <InputText v-model="nameInput" placeholder="derangements · descent_permutations …" spellcheck="false" />
      </InputGroup>
      <span v-if="naming" class="arch" :class="naming.kind">{{ naming.kind }}</span>
    </div>
    <Message v-if="namingError" severity="error" :closable="false">{{ namingError }}</Message>
    <template v-if="naming">
      <p class="note">{{ naming.note }}</p>
      <pre v-if="naming.sql" class="sql">{{ naming.sql }}</pre>
      <div v-if="naming.related.length" class="related">
        <h2>Named collections near this statement</h2>
        <ul>
          <li v-for="r in naming.related" :key="r.collection + r.relation">
            <span class="rel" :title="r.relation">{{ REL_SYM[r.relation] }}</span>
            <a :href="queryLink(r.collection)" class="rc">{{ r.collection }}</a>
            <span class="via">{{ r.via }}</span>
            <a :href="collLink(r.collection)" class="ex" title="Open in the collection explorer">explorer ↗</a>
          </li>
        </ul>
      </div>
      <p v-else-if="!namingLoading" class="note subtle">No named collections found structurally near this statement.</p>
    </template>
  </section>
</template>

<style scoped>
.kw { font-family: var(--e-font-mono, ui-monospace, monospace); font-weight: 600; font-size: 0.8rem; letter-spacing: 0.02em; color: var(--e-color-brand-text, #92400e); }
.seg :deep(input) { font-family: var(--e-font-mono, ui-monospace, monospace); font-size: 0.86rem; }
.arch { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--e-color-text-subtle, #888); border: 1px solid var(--e-color-border, #ddd); border-radius: 999px; padding: 0.1rem 0.55rem; }
.sql { font: 0.8rem/1.45 var(--e-font-mono, ui-monospace, monospace); background: var(--e-color-bg-soft, #f6f4f0); border: 1px solid var(--e-color-border, #ddd); border-radius: 8px; padding: 0.75rem 1rem; overflow-x: auto; margin: 0 0 0.75rem; white-space: pre; }

.name { border: 1px solid var(--e-color-border, #ddd); border-radius: 10px; padding: 1rem 1.1rem; margin: 0 0 1rem; background: var(--e-color-bg-soft, #f6f4f0); }
.name-in { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
.name-in .seg { flex: 0 1 24rem; }
.name .note { margin: 0.25rem 0 0.6rem; color: var(--e-color-text-muted, #555); max-width: 74ch; }
.name .note.subtle { color: var(--e-color-text-subtle, #888); }
.name .sql { margin: 0 0 0.75rem; }
.related h2 { font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--e-color-text-subtle, #888); margin: 0.5rem 0 0.4rem; font-weight: 600; }
.related ul { list-style: none; margin: 0; padding: 0; }
.related li { display: flex; align-items: baseline; gap: 0.55rem; padding: 0.22rem 0; border-top: 1px solid var(--e-color-border, #eee); }
.related li:first-child { border-top: none; }
.rel { flex: none; width: 1.2rem; text-align: center; font-family: var(--e-font-mono, ui-monospace, monospace); color: var(--e-color-brand-text, #92400e); font-weight: 700; }
.rc { flex: none; font-family: var(--e-font-mono, ui-monospace, monospace); font-weight: 600; }
.via { flex: 1 1 auto; color: var(--e-color-text-muted, #666); font-size: 0.86rem; }
.ex { flex: none; font-size: 0.78rem; color: var(--e-color-text-subtle, #888); white-space: nowrap; }
</style>
