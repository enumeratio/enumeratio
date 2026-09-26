# Design: compute host & a universal reference syntax

Moved whole from design/compute-host.md.

Status: **draft / thinking**. Captures direction for `notatio serve` and, more
importantly, a canonical way to _name_ well-known mathematical objects that the
host's route structure can be built on.

## 1. Where we are

`notatio serve` is a thin HTTP adapter over the I/O-agnostic core (the same
`Session` / `Repl` / `runCommand` the bin and browser terminal use):

- `POST /eval` `{ input, syntax?, form? }` — stateless; fresh session per request;
  returns `notatio` / `tex` / `mathjson` / `wolfram` forms.
- `GET /formats`, `GET /mime?type=…` — registry introspection.

Bound to `127.0.0.1`, no auth, single trusted user. Arbitrary evaluation is a
compute/DoS vector; network exposure is out of scope until it has auth + per-request
limits + sandboxing (see §6).

## 2. The core question — addressing mathematical objects

We want to speak **universally** about well-known objects — `Binomial`, the
Catalan numbers, `SymmetricGroup(4)`, the Ferrers diagram of `[5,3,3,1]` — with a
canonical name that is stable, resolvable, and the backbone of the route
structure. This is the piece to nail down first; everything else hangs off it.

### Two kinds of thing to name

1. **Operators / heads** — `Binomial`, `Inversions`, `HurwitzZeta`. Finite,
   curated, already the keys of MathJSON + `@enumeratio/reference`.
2. **Object instances** — a _specific_ permutation `[3,1,2]`, partition `[5,3,3,1]`,
   the group `SymmetricGroup(4)`, the sequence "Catalan numbers". Infinite, but
   built from heads applied to arguments.

An instance is just a head applied to arguments — i.e. a **MathJSON expression** —
so one scheme covers both: _the canonical name of an object is a normalized
expression naming it._

### Proposal: expression-addressed routes

Use the head name (MathJSON, Wolfram-aligned) as the primary key, and canonical
serialized arguments as the path tail:

```
GET /symbol/Binomial                     # the operator: signature, docs, examples, forms
GET /object/Binomial(10,3)               # an instance: evaluate + every form + graphic links
GET /object/Permutation([3,1,2])         # → one-line notation, inversions, glyph, …
GET /object/IntegerPartition([5,3,3,1])  # → Ferrers glyph, conjugate, statistics
```

Open choices for the instance encoding in the path:

- **(a) the Epsil surface form** (`Binomial(10,3)`) — human-readable, parens are
  URL-safe in the path, and it is the default input / notatio form
  ([syntax-and-formats.md](../syntax-and-formats.md)). Preferred.
- (b) percent-encoded MathJSON (`%5B%22Binomial%22...%5D`) — unambiguous, ugly.
- (c) a short content hash of the normalized MathJSON — stable, opaque; good as an
  _alias_ / cache key, not the primary human route.

Recommendation: **(a) as the primary human route, (c) as a canonical alias.** The
server normalizes the expression (canonical MathJSON) and can 301 from any
equivalent spelling to the canonical one, so `Binomial(10,3)` and
`\binom{10}{3}` and `["Binomial",10,3]` all resolve to the same object.

### Cross-references (the "universal" part)

The canonical name should carry links to the wider mathematical namespace, so an
object is addressable _and_ citable:

- **OEIS** A-numbers for sequences (Catalan → `A000108`).
- **DLMF** section ids for special functions.
- **Wikidata** Q-ids for named objects.
- **Wolfram** function name (already our MathJSON alignment via `@enumeratio/wolfram`).

These live in `@enumeratio/reference` (already the single source for symbol
examples) as an optional `refs: { oeis?, dlmf?, wikidata?, wolfram? }` block, and
surface at `GET /symbol/:name`. That makes the reference package the registry of
record for "what is this object, canonically."

### Route sketch

```
GET  /symbol                     list heads (paged, by domain)
GET  /symbol/:name               one head: signature, refs, examples, default forms
GET  /object/:expr               evaluate an instance; forms + graphic links + refs
POST /eval                       ad-hoc evaluation (current)
GET  /formats  /mime             registry (current)
```

`/object/:expr` is `/eval` with the expression in the path and a canonical,
cacheable identity — the same machinery, addressed rather than posted.

## 3. Host roadmap (after the minimal cut)

- **Stateful sessions** — `POST /session` → id; `/session/:id/eval` keeps history,
  `%`, `let`, vars (a `Repl` per id, with idle eviction). Enables a browser-terminal
  **remote mode**: the terminal talks to a host instead of the in-browser core, so
  the docs terminal and a real deployment share one protocol.
- **Deployed API functions** — name → expression template with holes, callable by
  URL (`GET /fn/binom?n=10&k=3`). Wolfram's `APIFunction` / `CloudDeploy`, scoped
  to our heads.
- **Graphics** — `POST /export` `{ value, format }` → bytes (PNG via raster,
  server-side), and `/object/:expr/glyph.svg` convenience routes.
- **Streaming** — long/aggregate computations over Server-Sent Events or WS.

## 4. Input syntax & output forms

Moved to [syntax-and-formats.md](../syntax-and-formats.md): Epsil is the default input
and the notatio subset, `$…$` islands for LaTeX, the `:` pragma model, and the shared
form/syntax resolver. The host's `/eval` `syntax` and `form` fields use that same
resolver. Shell escaping (single-quote / heredoc) lives there too.

## 5. Security

Localhost-only, single user, no auth for now. Before any network exposure: auth
(token/header), per-request wall-clock + step limits on evaluation (arbitrary heads
can be expensive), a bounded scope per session, and rate limits. These gate exposure,
not the localhost dev tool.

## Open questions

1. Instance path encoding — confirm `(a)` (surface form) as primary, hash as alias.
2. Where do OEIS/DLMF/Wikidata refs live and who curates them — extend
   `@enumeratio/reference` with a `refs` block?
3. Remote-terminal mode: is a shared session protocol (host + docs terminal) worth
   building before deployed API functions?
