# @enumeratio/explorer — agent notes

Vue 3 + PrimeVue app (built + mounted inside the docs site). Core architecture: a collection page **is a SQL
`SELECT`** — see [Query Model](https://github.com/enumeratio/enumeratio/wiki/Query-Model).

## PrimeVue — use the LLM docs

This app uses PrimeVue v4 (with a vendored rowgroup fork, PR #8579). Web training data is often stale for PrimeVue, so
when using or debugging a component, consult PrimeVue's own LLM-oriented docs rather than guessing:

- Index (what's available): https://primevue.dev/llms/llms.txt
- Everything, one file: https://primevue.dev/llms/llms-full.txt
- **Per-component markdown**: `https://primevue.dev/llms/components/<name>.md` — e.g.
  [`button.md`](https://primevue.dev/llms/components/button.md), `datatable.md`, `toggleswitch.md`, `floatlabel.md`,
  `select.md`. Fetch the one for the component you're touching.
- More: https://primevue.dev/llms/

Prefer these over memory. Components already relied on here: `DataTable`/`Column` (sort, rowgroup, virtual scroll),
`ToggleSwitch` (with a custom `#handle` slot), `FloatLabel` (`variant="on"`), `Select`/`MultiSelect`/`AutoComplete`,
`InputText`/`InputNumber`, `OrderList`, `Checkbox`, `Panel`, `Message`, `Button`.
