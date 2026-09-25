# Terminal

`<notatio-terminal>` — the real `@enumeratio/cli` evaluation core in a browser terminal.
Two modes: the interactive session (the default), which keeps `In[n]`/`Out[n]`, and
`mode="cli"`, a fixed `$ notatio ` prompt that runs one invocation at a time. What either
one accepts is the CLI's business, documented with it: the [REPL](/docs/cli/repl), the
[command line](/docs/cli/command-line), and the [CLI reference](/docs/cli/).

<Story
  title="The session">
<notatio-terminal></notatio-terminal>
</Story>

<Story
  title="One invocation at a time">
<notatio-terminal mode="cli"></notatio-terminal>
</Story>
