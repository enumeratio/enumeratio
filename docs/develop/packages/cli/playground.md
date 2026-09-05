---
title: CLI Playground
---

<script setup>
import { ref } from 'vue'
import CliTerminal from '@enumeratio/explorer/cli-terminal'

// Curated, verified command lines (mirrors the examples on the CLI reference page). base_example is the SQL
// self-cert corpus, not CLI grammar, so it isn't a drop-in source here — folding it in is a follow-up.
const examples = [
  { cmd: 'table', label: 'every collection' },
  { cmd: 'permutations size=4', label: 'enumerate' },
  { cmd: 'permutations size=4 -g inversions', label: 'distribution' },
  { cmd: 'set_partitions size=1:5 --triangle blocks', label: 'Stirling triangle' },
  { cmd: 'permutations size=4 --at @2413', label: 'element card' },
  { cmd: 'maps permutations', label: 'map graph' },
]

const term = ref(null)
const run = (cmd) => term.value?.run(cmd)
</script>

# @enumeratio/cli — Playground

The same [`enumeratio`](/develop/packages/cli/) grammar the node CLI runs, live in your browser: every line goes through the
package's own dispatcher against the in-browser (PGlite) core — nothing is reimplemented here. Type a command, or click
an example to run it. `help` prints the grammar, `clear` resets the log.

<ClientOnly>
  <div class="cli-play">
    <div class="cli-chips">
      <button v-for="ex in examples" :key="ex.cmd" class="cli-chip" type="button" @click="run(ex.cmd)">
        <code>{{ ex.cmd }}</code>
        <span class="cli-chip-label">{{ ex.label }}</span>
      </button>
    </div>
    <CliTerminal ref="term" />
  </div>
</ClientOnly>

An unbounded collection (`enumeratio naturals`) would stream forever with no closing pipe, so browser output is capped
— narrow it with `--range A:B` or `--count`. For the full option set and piping semantics, see the
[CLI reference](/develop/packages/cli/).

<style>
.cli-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1rem 0 0.75rem; }
.cli-chip {
  display: inline-flex; align-items: baseline; gap: 0.4rem;
  background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); border-radius: 6px;
  padding: 0.25rem 0.55rem; cursor: pointer; font-size: 0.8rem; color: var(--vp-c-text-1);
  transition: border-color 0.15s, background 0.15s;
}
.cli-chip:hover { border-color: var(--vp-c-brand-1); background: var(--vp-c-bg-alt); }
.cli-chip code { background: none; padding: 0; font-size: 0.8rem; color: var(--vp-c-brand-1); }
.cli-chip-label { color: var(--vp-c-text-2); }
</style>
