# Design: syntax & formats

How notatio — the interface — reads input and renders output, across the notebook, the
REPL, the command line, and the host. The text syntax is **Epsil**, compute-engine's own;
enumeratio's symbols are declared into it. Component attributes and cells take an
**expression** — MathJSON, written in Epsil — never statements or effects; a cell may add
one `:=` binding on top of that (below). In the reference data the retypeable text form is
keyed `epsil`, and `notatio` keys the component (vdom) serialisation
(design/examples-as-data.md §2). Split out of the compute-host doc so the surface-syntax
decisions live in one place. Some of this is **implemented**; the rest is direction.

## Input syntax — Epsil is the default (implemented)

The default input syntax is **Epsil** — compute-engine's own surface syntax:
`(` for calls, `^` / `/` for powers and fractions, capitalized heads (`Binomial`,
`Sqrt`, `Sin`), list literals `[…]`. It is also rendered back as **Epsil** (via
InputForm, see below), so what you type is what you get back.

- **LaTeX** goes in `$…$` islands inside an Epsil line (`Binomial(10,3) + $\frac{1}{2}$`),
  or behind the `:latex` pragma for a whole line. **Bare LaTeX is not accepted** — a
  line starting with `\` is an Epsil error. This is deliberate: Epsil is the default,
  and LaTeX is the escape hatch, not the other way round.
- We lean on **Epsil**, not a fork — the goal is compute-engine's syntax as-is.
  Restricting an attribute or cell to one expression is a gate over it, not a new
  grammar.

We do **not** auto-detect syntax from the input shape any more (a leading `[` used to
mean MathJSON, `Head[…]` Wolfram). Everything is Epsil unless a pragma says otherwise —
one rule, no surprises when an Epsil list literal starts with `[`.

### Pragmas, and making selection coherent everywhere

A leading `:` is a **pragma namespace**. `:latex` / `:wolfram` / `:mathjson` / `:epsil`
select the syntax for one line; `:in <syntax>` sets the session default. That framing
should hold across environments:

- **REPL / TUI**: `:` is the pragma. Because it's a TUI we can do better than typing
  it — a **mode dropdown** (like the docs terminal's example picker) that sets the
  input syntax, with the active mode shown in the prompt.
- **LaTeX affordance**: a leading `\` could mean "this line is LaTeX" (Lean-style),
  since `\` unambiguously starts a LaTeX command — a shorthand for `:latex`,
  complementing `$…$` islands.
- **Command line**: flags (`-i wolfram`); unambiguous prefixes resolve (`-i w`).
- **Host**: a `syntax` field on `/eval`; the same resolver.

Names are **spelled out** (`:wolfram`, not `:wl`). Short aliases and unique prefixes
still resolve for convenience but are not the documented form. One shared resolver
(`resolveForm` / `resolveSyntax`) backs the CLI flags, the REPL pragmas, and the host,
so behaviour is identical everywhere. (Implemented.)

## Expressions: one per attribute or cell (implemented)

A component attribute or a cell takes **an expression** — Epsil restricted to
**a single expression with no statements or effects**: no assignment (`:=` / `=`),
no declarations (`type` / `protocol`), no control flow (`if` / `match` / `while`),
no pragmas (`#…`), no `;` sequences. It is the language of the web-component
attributes (`<notatio-plot value>`, `<notatio-manipulate>` slots) and the default
display form. `parseExpression` / `serializeExpression` (in `@enumeratio/formats`,
also on the `/expression` subpath for the browser elements) wrap `parseEpsil` /
`serializeEpsil` and add the single-expression gate — a parse error or a forbidden
head is a diagnostic, never a throw. Output always round-trips as itself (a result
prints as Epsil and re-reads as the same value).

`$…$` LaTeX islands are allowed — Epsil's own feature (parsed through the engine's
LaTeX parser, threaded in as a `parseLatex` hook); without an engine the islands are
inert. A product of two symbols needs an explicit `*` in the Epsil text
(`A * Sin(x)`) — juxtaposition (`A Sin(x)`) is only legal inside an island.

A notebook or worksheet **cell** is that same expression plus one binding. Its `seed`
is read by `parseExpression` with `allow: ["Assign"]`, so `s := 2` is accepted there
and nowhere else — a cell is where a reader names something, and that is the only
statement it needs. Everything a cell binds is still evaluated by enumeratio.

### Where the word stops: enumeratio owns meaning, notatio owns writing

The two names split by what they govern, not by layer. **enumeratio** is what an
expression _means_ — the heads, their definitions, evaluation — and its language is
_full_ Epsil, statements included, because a definition needs `:=`, `type`, control
flow. **notatio** is how a person _writes and sees_ one: InputForm printing it back,
the `*Form` heads, the components. Rule of thumb for prose: "a head", "defined as" →
enumeratio; "written as", "typed", "prints as" → notatio.

### Slots — named wildcards

Parameterized attributes use compute-engine's **own** pattern notation: a named
wildcard `_name` is a slot, filled from the control/parameter `name` (via CE's
`.subs`), then re-serialized. This replaced an earlier `${…}` JS-template syntax,
which collided with Epsil's `$` islands and `{}` set literals and evaluated as
JavaScript rather than as an expression. The `_` prefix _is_ the "this attribute is
a template" marker, so it is uniform across a plot's `value` (`Sin(_a * x)`) and any
other attribute (`n="_n * 20"`); `<notatio-manipulate>` treats a descendant
attribute as a template iff it parses as an expression and carries a matching
wildcard. In a plot, the wildcards are the bound parameters and the remaining bare
symbol is the plot axis.

## Output forms & the registry

Every output form is a registered **format** (`:formats` lists them, with MIME type
and import/export capability). Forms: `inputform`, `tex`, `mathjson`, `wolfram`,
`epsil`, `numpy`, `glsl`, `wgsl`, `js`. The code forms are real compute-engine
compilation targets. `:mime <type>` is Wolfram's `MIMETypeToFormatList`.

The `InputForm` and `Epsil` registry formats share the `serializeEpsil` serializer;
they differ on import — `InputForm` enforces the single-expression restriction,
`Epsil` accepts full Epsil.

## Shell escaping (command line)

The default being Epsil means most command-line input needs **no backslashes**:
`notatio "Binomial(10, 3)"`, `notatio -f numpy "Sqrt(x^2 + 1)"`. For LaTeX, use
`-i latex` or a `$…$` island, and either single-quote the expression or pipe a
**quoted heredoc** (`<<'EOF'`), which is literal so the backslashes reach `notatio`
intact. Documented in `/docs/cli/command-line`.
