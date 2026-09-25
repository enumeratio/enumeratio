# REPL

A real terminal running the actual [`@enumeratio/cli`](/docs/cli/) eval core in your
browser — not a recording. Pick an example from the dropdown, or type your own.
Results are exact; `:help` lists every command.

- **Input**: Epsil by default (`Binomial(10, 3)`, `1/2 + 1/3`, `Sqrt(144)`); wrap
  LaTeX in `$…$`; `:latex` / `:wolfram` / `:mathjson` / `:epsil` force a syntax for
  one line.
- **Output**: `:form <name>` switches how results print (`:forms` to list).
- **Graphics**: `:plot <expr>` and `:glyph <kind> <list>` draw below the terminal.
- **Environments**: `:env print` / `:env pipe` reduce every result for somewhere that
  cannot drive a control — a slider pins or samples into small multiples; `:env auto`
  hands it back. At a real terminal the controls are live instead: see
  [Environments](/playground/environments#at-a-terminal).
- **History**: `Out(n)` is the n-th result (`%n` for short, `%`/`%%` for the last two),
  `In(n)` re-evaluates the n-th input, `InString(n)` is the line as typed.
- **Keys**: ↑/↓ history, ←/→ edit, Ctrl+C cancels a line, Ctrl+L clears.

<notatio-terminal></notatio-terminal>

See the [CLI reference](/docs/cli/) for the full command list and the
[live command line](/docs/cli/command-line) for scriptable `notatio` invocations.
