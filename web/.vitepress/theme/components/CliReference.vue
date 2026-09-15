<script setup lang="ts">
// The `notatio` command's surface, generated from @enumeratio/cli: its USAGE text
// verbatim, then the subcommands and flags the completion scripts advertise, and the
// form / syntax names `-f` and `-i` resolve against.
import { data as cli } from "../../data/cli.data.ts";
</script>

<template>
  <pre class="cli-usage"><code>{{ cli.usage.trimEnd() }}</code></pre>

  <h4>Subcommands</h4>
  <table class="cli-table">
    <thead>
      <tr>
        <th>Subcommand</th>
        <th>What it does</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="s in cli.subcommands" :key="s.spec">
        <td>
          <code>{{ s.spec }}</code>
        </td>
        <td>{{ s.description }}</td>
      </tr>
    </tbody>
  </table>

  <h4>Options</h4>
  <table class="cli-table">
    <thead>
      <tr>
        <th>Flag</th>
        <th>What it does</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="f in cli.flags" :key="f.spec">
        <td>
          <code>{{ f.spec }}</code>
        </td>
        <td>{{ f.description }}</td>
      </tr>
    </tbody>
  </table>

  <h4>Output forms</h4>
  <ul class="cli-list">
    <li v-for="f in cli.forms" :key="f.name">
      <code>{{ f.name }}</code> — {{ f.label }}
    </li>
  </ul>

  <h4>Input syntaxes</h4>
  <p class="cli-inline">
    <code v-for="s in cli.syntaxes" :key="s">{{ s }}</code>
  </p>

  <h4>Completion shells</h4>
  <p class="cli-inline">
    <code v-for="s in cli.shells" :key="s">{{ s }}</code>
  </p>
</template>

<style scoped>
.cli-usage {
  overflow-x: auto;
}
.cli-table {
  display: table;
  width: 100%;
  margin: 0.5rem 0 1.25rem;
}
.cli-table td:first-child {
  white-space: nowrap;
}
.cli-list {
  padding-left: 1.2rem;
}
.cli-inline code {
  margin-right: 0.4rem;
}
</style>
