# REPL

A real terminal running the actual [`@enumeratio/cli`](/cli/) eval core in your
browser — not a recording. Pick an example from the dropdown, or type your own.
Results are exact; `:help` lists every command.

- **Input**: Epsil by default (`Binomial(10, 3)`, `1/2 + 1/3`, `Sqrt(144)`); wrap
  LaTeX in `$…$`; `:latex` / `:wolfram` / `:mathjson` / `:epsil` force a syntax for
  one line.
- **Output**: `:form <name>` switches how results print (`:forms` to list).
- **Graphics**: `:plot <expr>` and `:glyph <kind> <list>` draw below the terminal.
- **Keys**: ↑/↓ history, ←/→ edit, Ctrl+C cancels a line, Ctrl+L clears.

<notatio-terminal></notatio-terminal>

See the [CLI reference](/cli/) for the full command list and the
[command-line playground](/playground/cli) for scriptable `notatio` invocations.
