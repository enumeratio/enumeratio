# JavaScript

A **code output form**: JavaScript source, via compute-engine's default
compilation target (the `JavaScriptForm` form). It's what powers numeric
evaluation — free variables are read off a scope object `_` (so `x` compiles to
`_.x`), and math maps to the `Math` namespace.

Like the other code forms it's floating-point, so exact rationals become float
literals. Each row shows an expression and its JavaScript source.

<SourceOutput language="javascript" />
