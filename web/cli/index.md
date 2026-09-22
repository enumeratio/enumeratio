# CLI

`notatio` on the command line: a Wolfram-style REPL for compute-engine with the
enumeratio symbols declared. The same evaluation core runs three places:
an interactive terminal, a plain command line, and — thanks to a browser-safe core —
a **real terminal emulator in the browser**.

::: tip Try it live
The [**REPL playground**](/playground/repl) is a real terminal running this exact
CLI logic in your browser — pick an example from the dropdown or type your own.
The [**command-line playground**](/playground/cli) does the same for scriptable
`notatio` invocations.
:::

The prompt is numbered `In[n]:=` / `Out[n]=`, like a notebook transcript. Results
stay exact — `1/2 + 1/3` is `5 / 6`, not `0.833…`.

## Input syntaxes

The default is **Epsil** — compute-engine's own surface syntax, rendered back as
**notatio** (the restricted subset): `(` for function calls, `^` / `/` for powers and fractions,
capitalized heads (`Binomial`, `Sqrt`, `Sin`). LaTeX lives in `$…$` islands. A
syntax pragma forces a syntax for one line, and `:in <syntax>` changes the default.

| Syntax            | Example                         | Notes                      |
| ----------------- | ------------------------------- | -------------------------- |
| Epsil (default)   | `Binomial(10, 3)`               | rendered back as notatio   |
| LaTeX island      | `$\binom{10}{3}$`               | LaTeX inside an Epsil line |
| LaTeX (pragma)    | `:latex \binom{10}{3}`          | a whole LaTeX line         |
| Wolfram full form | `:wolfram Binomial[10, 3]`      | `Head[args]`               |
| MathJSON          | `:mathjson ["Binomial", 10, 3]` | the interchange form       |

All evaluate to the same thing — the combinatorial heads (`Binomial`, `Inversions`,
`Descents`, `MajorIndex`, …) come from `@enumeratio/collections`. Bare LaTeX (a line
starting with `\`) is **not** accepted in Epsil — use a `$…$` island or `:latex`.

## Output forms

`:form <name>` switches how results print; `:forms` lists them with the current
one marked. The default `notatio` form is the restricted-Epsil subset — the same
syntax you type. The same expression renders as TeX, Wolfram, or compilable source:

```text
In[1]:= x^2 + 1
Out[1]= x ^ 2 + 1
In[2]:= :form wolfram
In[2]:= x^2 + 1
Out[2]= Plus[Power[x, 2], 1]
In[3]:= :form numpy
In[3]:= x^2 + 1
Out[3]= x ** 2 + 1
In[4]:= :form js
In[4]:= x^2 + 1
Out[4]= (_.x * _.x) + 1
```

Forms: `notatio` (Epsil), `tex`, `mathjson`, `wolfram`, `epsil`, `numpy`, `glsl`,
`wgsl`, `js`. The code forms (`numpy`/`glsl`/`wgsl`/`js`) are real compute-engine
compilation targets — they only apply to numeric/function expressions.

## History and variables

Each line is numbered, and a committed line can be referenced from a later one, the way a
Wolfram notebook does:

- `Out(n)` is the **result** of line `n`, already evaluated; `%n` is its shorthand, `%` the
  last and `%%` the one before. A negative index counts back, so `Out(-1)` is `%`.
- `In(n)` is the **input** of line `n`, **re-evaluated** where you ask for it. Wolfram gives
  `In[n]` a delayed value, so `In[1]` of a random draw draws again; ours re-evaluates the
  parsed input the same way.
- `InString(n)` is that line as you typed it, as a string.

Bracket spelling is Wolfram's; in notatio (Epsil) `[…]` builds a list, so the calls are
written `Out(2)`, or `:wolfram Out[2]` for one line in Wolfram syntax.

```text
In[1]:= Binomial(10, 3)
Out[1]= 120
In[2]:= Out(1) + 1
Out[2]= 121
In[3]:= InString(1)
Out[3]= "Binomial(10, 3)"
In[4]:= In(1) / 2
Out[4]= 60
```

A line with controls in it is committed the same way: **Enter** ends the strip and what you
left on screen becomes `Out[n]`, so a later line reading `Out[n]` gets the state you stopped
at — the session is Wolfram-style, one committed cell at a time, not a sheet that keeps
re-running (that is [notatio-notebook](/playground/notebook)).

- `%` is the last result, `%%` the one before, `%n` the n-th `Out`.
- `let name = <expr>` binds a variable the engine remembers; later lines resolve
  it, and `:vars` lists the bindings.

```text
In[1]:= let n = 5
Out[1]= n = 5
In[2]:= Binomial(n, 2)
Out[2]= 10
In[3]:= % * 3
Out[3]= 30
```

## Graphics

`:plot <expr>` samples a one-variable expression over x ∈ [-5, 5].
`:glyph <kind> <list>` draws a combinatorial object (`permutation`, `partition`,
`composition`, `subset`, `dyck`). In the browser terminal the figure appears beside
it; the Node CLI writes an SVG to a temp file (and shows it inline on iTerm2 /
kitty). Try `:glyph partition [5,3,3,1]` or `:plot Sin(x)` in the
[REPL playground](/playground/repl).

## Environments

A result can carry controls — a `Slider`, a `Toggler`, a whole `Manipulate`. What
happens to them depends on where the result is going, and the CLI knows two answers.

**At a TTY** the controls are real: the REPL draws a strip of text sliders under the
input. Click or drag a slider with the **mouse** (the wheel steps it); with the keyboard,
←/→ move the focused one, Shift for the coarse gear, Tab changes focus, Space plays.
**Enter** commits the line — what you left on screen becomes `Out[n]`, referenceable from
later lines. A `Plot` under the strip is drawn on braille cells (or inline as an image on
iTerm2 / kitty), so it redraws as you scrub; the y-axis gutter is a fixed width, so the
curve never shifts sideways as a label changes.

**Anywhere else** — a pipe, a file, a page — there is nothing to move a slider with, so
the expression is _reduced_: the controls pin to their starting values and their
declarations become a caption, or, for `print`, the first one is sampled into a grid of
small multiples.

```bash
notatio "Manipulate(a^2 + b, (a, 0, 1), ((b, 2), 0, 3))"
# Labeled(2, "a = 0 (0 ≤ a ≤ 1); b = 2 (0 ≤ b ≤ 3)", Bottom)

notatio --env print "Manipulate(a * x, (a, 1, 3, 1))"
# Grid([[Labeled(x, "a = 1", Bottom), Labeled(2x, "a = 2", Bottom), …]])
```

`--env` names one explicitly (`web`, `print`, `tty`, `pipe`, `compact`); `--json` skips
the reduction and hands back the expression whole. In the REPL, `:env <name>` does the
same for every result until `:env auto`. The expression can ask for a reading itself with
a trailing rule — `Static -> "Pin"`, `Static -> "Sample"`, or `Static -> 3` for a sample
count. The same rewrite runs on the site, where printing a page turns its sliders into
grids: see [the Environments playground](/playground/environments) and
`design/rendering-environments.md`.

## Command line

Outside the browser, `notatio` is also a plain command: give it an expression and
it prints the result and exits — ideal for scripts and pipes. Try it in the
[command-line playground](/playground/cli).

```bash
notatio "Binomial(10, 3)"        # 120
notatio -f wolfram "x^2 + 1"     # Plus[Power[x, 2], 1]
notatio -f numpy "Sin(x) + 1"    # np.sin(x) + 1
echo "2 + 40" | notatio          # 42
notatio -i wolfram "Inversions[List[3,1,2]]"   # 2
```

A bad expression exits non-zero with the error on stderr. With no expression on a TTY,
`notatio` starts the interactive REPL instead.

### Subcommands

`eval` is the default and rarely needs writing. `convert` re-renders an expression in
another form **without evaluating** it — the way to see `x^2 + 1` as WL rather than what
it computes to. `forms` and `formats` list the output forms and the format registry.
`completion <shell>` prints a completion script to `eval`, and `serve --port N` stands up
the [compute host](#compute-host) below.

### Command reference

Generated from the CLI's own `USAGE`, completion tables and form registry, so it cannot
drift from the binary. Form and syntax names resolve on any **unambiguous prefix**, so
`-f wolf`, `-f math` and `-i w` all work — and Wolfram spellings (`TeXForm`, `InputForm`,
`FullForm`) resolve too.

<CliReference />

### Running it

The CLI is part of the notatio monorepo. In a checkout:

```bash
# interactive REPL
pnpm --filter @enumeratio/cli exec tsx src/main.ts

# evaluate one expression
pnpm --filter @enumeratio/cli exec tsx src/main.ts "Binomial(10, 3)"

# or build the bin and run it directly
pnpm --filter @enumeratio/cli build
node packages/cli/bin/notatio.mjs "2 + 2"
```

## Formats, import & export

Every output form is a registered **format** (`:formats` lists them, with the
MIME type and whether it imports, exports, or both). `:mime <type>` is Wolfram's
`MIMETypeToFormatList` — `:mime image/png` → `PNG`.

In the Node CLI, `:export <path>` writes the last result (or the last graphic, for
`.svg`/`.png`) with the format inferred from the extension, and `:import <path>`
reads a file back — WL / MathJSON / TeX become the next result, and the format is
content-sniffed when the extension is unknown.

```text
In[1]:= x^2 + 1
In[2]:= :export /tmp/expr.wl      # wrote /tmp/expr.wl (WL)  ->  Plus[Power[x, 2], 1]
In[3]:= :import /tmp/expr.wl      # Out[3]= x ^ 2 + 1
```

## Compute host

`notatio serve` stands up a small HTTP endpoint over the same eval core — a local
compute host for scripts, other tools, or a browser talking to your machine.

```bash
notatio serve                 # http://127.0.0.1:7373
notatio serve --port 8080
```

```bash
curl -s localhost:7373/eval -H 'content-type: application/json' \
  -d '{"input":"x^2 + 1","form":"wolfram"}'
# {"ok":true,"result":"Plus[Power[x, 2], 1]","forms":{"notatio":"x ^ 2 + 1", …}}
```

Endpoints: `POST /eval` `{ input, syntax?, form? }` (each request evaluates in a
fresh session and returns `notatio` / `tex` / `mathjson` / `wolfram` forms),
`GET /formats`, and `GET /mime?type=…`. It binds **localhost** with no auth — a
single-user dev tool; exposing it on a network would need auth and sandboxing
first.

## REPL command reference

Everything the interactive session accepts; `:help` prints the same list.

| Command                                                 | Does                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| `<expr>`                                                | evaluate (Epsil by default)                                 |
| `:wolfram` / `:mathjson` / `:latex` / `:epsil` `<expr>` | force an input syntax for one line                          |
| `let <name> = <expr>`                                   | bind a variable                                             |
| `%` · `%%` · `%n`                                       | last / 2nd-last / n-th result                               |
| `Out(n)` · `In(n)` · `InString(n)`                      | n-th result · n-th input, re-evaluated · n-th line as typed |
| `:form [name]`                                          | show or set the display form                                |
| `:env [name]`                                           | reduce results for an environment                           |
| `:forms`                                                | list the display forms                                      |
| `:in <syntax>`                                          | set the default input syntax                                |
| `:plot <expr>`                                          | plot a one-variable expression                              |
| `:glyph <kind> <list>`                                  | draw a combinatorial glyph                                  |
| `:export <path>` · `:import <path>`                     | write / read a file (Node)                                  |
| `:formats` · `:mime <type>`                             | the format registry · MIME → formats                        |
| `:vars` · `:clear` · `:help` · `:quit`                  | variables · clear · help · exit                             |
