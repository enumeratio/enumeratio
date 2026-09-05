<script setup lang="ts">
// Shared per-column printer-config popover (format · link · header · min-width, + optional hide/remove actions).
// ONE config surface reached from two places (Query-Model: a column IS a SELECT projection): the Properties pane's
// ⋮ button and the elements-table column header (issue #62). Presentational: holds the target uid, reads the live
// rows/defs by prop so it stays reactive after a patch, and emits granular mutations the parent applies to its list.
import { ref, computed, nextTick } from 'vue'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Popover from 'primevue/popover'
import Button from 'primevue/button'
import type { PropRow, PropDef } from './propRows'

// `actions` adds the hide/remove row (for the table header, where there's no eye/✕ column alongside).
const props = defineProps<{ rows: PropRow[]; defs: PropDef[]; actions?: boolean }>()
const emit = defineEmits<{ patch: [number, Partial<PropRow>]; remove: [number]; visible: [number, boolean] }>()

// the printers a column may be drawn with — the options come from the def, which asked the environment's grants (§9)
const FMT_GLYPH: Record<string, string> = { plain: '1', grouped: '1,', katex: 'TeX', link: '↗', svg: '◇', bars: '▁▃▅' }
const FMT_TITLE: Record<string, string> = {
  plain: 'plain', grouped: 'grouped (thousands separators)', katex: 'KaTeX', link: 'a link to the image in its codomain',
  svg: 'the inline figure', bars: 'a bar row, the array on hover',
}

const pop = ref()
const uid = ref<number | null>(null)
const row = computed(() => props.rows.find((r) => r.uid === uid.value) ?? null)
const def = computed(() => (row.value ? props.defs.find((d) => d.id === row.value!.propId) ?? null : null))
const hasLink = computed(() => def.value?.formats.includes('link') || !!def.value?.findstatId)

function open(ev: Event, id: number) { uid.value = id; pop.value.toggle(ev) }
function hide() { pop.value.hide() }
defineExpose({ open, hide })

// close first, then mutate on the next tick — a synchronous list change re-renders and cancels the hide transition.
const closeThenHide = (id: number) => { hide(); nextTick(() => emit('visible', id, false)) }
const closeThenRemove = (id: number) => { hide(); nextTick(() => emit('remove', id)) }

const setFormat = (f: string) => f && row.value && emit('patch', row.value.uid, { format: f })
const setName = (v: string) => row.value && emit('patch', row.value.uid, { name: v || undefined })
const setWidth = (v: number | null) => row.value && emit('patch', row.value.uid, { width: v && v > 0 ? v : undefined })
const setShowLink = (v: boolean) => row.value && emit('patch', row.value.uid, { showLink: v })
</script>

<template>
  <Popover ref="pop">
    <div v-if="row" class="colcfg-pop">
      <div v-if="(def?.formats.length ?? 0) > 1" class="colcfg-field">
        <span class="colcfg-lbl">format</span>
        <SelectButton :modelValue="row.format ?? def!.formats[0]" @update:modelValue="setFormat"
                      :options="def!.formats" :allowEmpty="false" size="small">
          <template #option="{ option }"><span v-tooltip.top="FMT_TITLE[option] ?? option">{{ FMT_GLYPH[option] ?? option }}</span></template>
        </SelectButton>
      </div>
      <div v-if="hasLink" class="colcfg-field">
        <span class="colcfg-lbl">link</span>
        <SelectButton :modelValue="row.showLink !== false ? 'on' : 'off'"
                      @update:modelValue="(v) => v && setShowLink(v === 'on')"
                      :options="['on', 'off']" :allowEmpty="false" size="small" v-tooltip.top="'link the value to the related element'" />
      </div>
      <label class="colcfg-field"><span class="colcfg-lbl">header</span>
        <InputText :modelValue="row.name ?? ''" @update:modelValue="(v) => setName(v ?? '')"
                   :placeholder="def?.label ?? ''" size="small" :style="{ flex: 1, minWidth: 0 }" />
      </label>
      <label class="colcfg-field"><span class="colcfg-lbl">min-width</span>
        <InputNumber :modelValue="row.width ?? null" @update:modelValue="setWidth"
                     placeholder="auto" :min="40" :max="800" :step="10" size="small" :inputStyle="{ width: '4.5rem' }" />
        <span class="colcfg-unit">px</span>
      </label>
      <div v-if="actions" class="colcfg-actions">
        <Button icon="pi pi-eye-slash" label="hide" size="small" variant="text" severity="secondary"
                @click="closeThenHide(row!.uid)" v-tooltip.top="'hide this column'" />
        <Button icon="pi pi-times" label="remove" size="small" variant="text" severity="secondary"
                @click="closeThenRemove(row!.uid)" v-tooltip.top="'remove this property'" />
      </div>
    </div>
  </Popover>
</template>

<style scoped>
.colcfg-pop { display: flex; flex-direction: column; gap: 0.5rem; min-width: 12rem; }
.colcfg-field { display: flex; align-items: center; gap: 0.5rem; }
.colcfg-lbl { font-size: 0.72rem; font-weight: 600; opacity: 0.6; width: 4rem; flex: none; }
.colcfg-unit { font-size: 0.72rem; opacity: 0.55; }
.colcfg-actions { display: flex; gap: 0.4rem; justify-content: flex-end; border-top: 1px solid var(--p-content-border-color); padding-top: 0.45rem; margin-top: 0.1rem; }
</style>
