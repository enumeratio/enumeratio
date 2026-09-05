<script setup lang="ts">
// A CLI-in-the-browser island: a PrimeVue Terminal wired to the SAME `enumeratio …` grammar the node CLI runs,
// against the explorer's in-browser (worker-backed) pglite. The command surface is NOT reimplemented — every line
// goes through @enumeratio/cli's environment-agnostic `runCli`, with the client backend injected (exactly as node's
// src/cli.ts does) and a line-sink that collects output back into the terminal.
//
// Db is ambient: whoever mounts this island has already installed a Db factory via `provideDb(…)` — CollectionView uses the
// worker-backed one, the docs theme a main-thread one. Either way this reads through the client like the sibling panes,
// so it never touches pglite directly and drops standalone into a docs page.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Terminal from 'primevue/terminal'
import TerminalService from 'primevue/terminalservice'
import { collections, construct, describe, summary, mapGraph, primePrinters, terminalSelect } from '@enumeratio/client'
import { runCli, CliError, type Client, type Writer } from '@enumeratio/cli/dispatch'

const client: Client = { collections, construct, describe, summary, mapGraph, terminalSelect }

// Remounting the Terminal is the only way to clear its command log (PrimeVue keeps it internally).
const termKey = ref(0)

// The browser has no closing pipe, so an infinite collection would stream forever — cap the output and tell the
// user how to narrow it. `enumeratio permutations` (all of them) still works; `enumeratio naturals` gets truncated.
const MAX_LINES = 5000

/** Quote-aware split into argv (no shell escapes — just single/double quotes for values with spaces). */
function tokenize(line: string): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3])
  return out
}

class Truncated extends Error {}

async function handleCommand(text: string): Promise<void> {
  const trimmed = text.trim()
  if (trimmed === 'clear' || trimmed === 'cls') {
    termKey.value++
    return
  }
  // Let the user type the program name if they like — `enumeratio permutations size=4` and `permutations size=4`
  // are equivalent.
  let argv = tokenize(trimmed)
  if (argv[0] === 'enumeratio') argv = argv.slice(1)

  const out: string[] = []
  let lines = 0
  const write: Writer = (s) => {
    out.push(s)
    for (let i = 0; i < s.length; i++) if (s[i] === '\n') lines++
    if (lines > MAX_LINES) throw new Truncated()
  }

  try {
    await runCli(argv, { client, write })
    TerminalService.emit('response', out.join('').replace(/\n+$/, '') || '(no output)')
  } catch (e) {
    if (e instanceof Truncated) {
      TerminalService.emit(
        'response',
        out.join('').replace(/\n+$/, '') + `\n… truncated at ${MAX_LINES} lines — narrow with --range A:B or --count`,
      )
    } else if (e instanceof CliError) {
      TerminalService.emit('response', e.message)
    } else {
      TerminalService.emit('response', String(e instanceof Error ? e.message : e))
    }
  }
}

// environment 'terminal' (#246): prime its printer cache once the ambient db is up (the parent's provideDb has
// already run by mount time — this island never boots its own db)
onMounted(() => { TerminalService.on('command', handleCommand); void primePrinters('terminal').catch(() => {}) })
onBeforeUnmount(() => TerminalService.off('command', handleCommand))

// Imperative entry for example chips: drive the REAL input the way a user would (native value setter + input/Enter
// events), so PrimeVue both ECHOES the command line into its log and fires the 'command' event we handle. Emitting on
// TerminalService directly would run the command but never show it (the log only fills on the input's Enter keydown).
const root = ref<HTMLElement | null>(null)
function run(cmd: string): void {
  const input = root.value?.querySelector('input') as HTMLInputElement | null
  if (!input) return
  input.focus()
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setValue?.call(input, cmd) // native setter so Vue's v-model (vModelText) picks the change up on the input event
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
}
defineExpose({ run })
</script>

<template>
  <div class="cliterm" ref="root">
    <Terminal
      :key="termKey"
      class="term"
      prompt="enumeratio "
      welcomeMessage="in-browser enumeratio — type a command (e.g. `table`, `permutations size=4`), `help` for the grammar, `clear` to reset."
    />
  </div>
</template>

<style scoped>
.cliterm { --term-h: 22rem; }
/* Terminal renders responses as plain text; force monospace + preserved whitespace so the CLI's aligned tables,
   TSV, and triangles line up, and give it a fixed, scrollable height. */
.term {
  height: var(--term-h);
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.82rem;
  line-height: 1.35;
  border-radius: 6px;
}
.term :deep(.p-terminal-command-response),
.term :deep(.p-terminal-welcome-message) {
  white-space: pre;
}
</style>
