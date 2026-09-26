# Command line

`notatio` is a normal, nix-y command-line tool: give it an expression and it
prints the result and exits. The terminal below runs the actual CLI in your
browser — the `$ notatio ` prompt is fixed, so you just type the arguments. Pick
an example from the dropdown, hit **▶ Play** to run through the corpus, or type
your own (e.g. `-f wolfram "x^2 + 1"`).

<notatio-terminal mode="cli"></notatio-terminal>

For the interactive session (persistent state, `In[n]`/`Out[n]`, `:plot`), see the
[live REPL](/docs/cli/repl); for the full reference, the [CLI docs](/docs/cli/).

Text on stdout is going somewhere that cannot move a slider, so a result with controls in
it is **reduced** — try `"Manipulate(a^2 + b, (a, 0, 1), ((b, 2), 0, 3))"`, or
`--env print` on the same thing for small multiples. The **Environments** group in the
dropdown runs both; [Environments](/playground/environments) explains the rest.

## Running it for real

From a checkout of the monorepo:

```bash
pnpm --filter @enumeratio/cli exec tsx src/main.ts "Binomial(10, 3)"
# or, after `pnpm --filter @enumeratio/cli build`:
node packages/cli/bin/notatio.mjs "Binomial(10, 3)"
```

`-f/--form` picks the output form, `-i/--in` the input syntax, `-c <expr>` passes
the expression explicitly. With no expression on a TTY it drops into the REPL.

The full form/syntax names are `inputform`, `tex`, `mathjson`, `wolfram`, `epsil`,
`numpy`, `glsl`, `wgsl`, `js` (forms) and `latex`, `mathjson`, `wolfram`, `epsil`
(syntaxes) — but any **unambiguous prefix** works, so `-f wolf`, `-f math`, and
`-i w` all resolve.

## Quoting LaTeX

The default is Epsil, so most input needs no backslashes at all — `Sqrt(x^2 + 1)`,
`Binomial(10, 3)`. For LaTeX, use `$…$` islands or `-i latex`. LaTeX is
backslash-heavy and the shell wants to eat backslashes, so **single-quote** the
expression (no expansion inside `'…'`), or — for anything long — pipe a **heredoc**
on stdin, which needs no escaping at all:

```bash
notatio '$\frac{d}{dx}\sin(x^2)$'    # 2 * x * Cos(x ^ 2)

notatio -i latex -f numpy <<'EOF'
\sqrt{x^2 + 1}
EOF
# np.sqrt(x ** 2 + 1)
```

A quoted heredoc (`<<'EOF'`) is literal — the backslashes reach `notatio` intact.

## Composing in a shell

Because it's a plain filter — stdin in, result out, non-zero exit on error — it
composes like any other unix tool (these use a real shell, not the terminal above):

```bash
# read the expression from stdin
echo "2 + 40" | notatio                      # 42

# capture a compiled form
src=$(notatio -f js "x^2 + 1")               # (_.x * _.x) + 1

# fail loudly in a pipeline
notatio ":wolfram 1 +" || echo "evaluation failed"
```
