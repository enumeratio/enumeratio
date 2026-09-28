# Writing the docs in enumeratio's own terms

Status: **speculative**. A direction to test, not a plan.

More of the site is becoming data the engine can read:

- reference examples are MathJSON (`<Head>.examples.yaml`), with their forms derived;
- component stories are MathJSON over the component's head (`<Name>.stories.yaml`),
  shown in the `<Head>` syntax;
- notatio is gaining markdown support, so prose and live cells can share one document.

## The idea

Write more of the docs in the same terms instead of markdown with islands:

- **Examples and stories as the only source of demos.** A guide page cites examples by
  id (`#example/<id>`) instead of inlining its own snippets, so every demo on the site
  is tested and scanned against the oracles.
- **Pages as notebook documents.** A guide is a notatio document: markdown cells for the
  prose, `<Head>` cells for the math, evaluated and pinned at build time like the
  generated reference data.
- **One prose renderer.** Captions, record prose and page prose all go through the same
  `$…$` / `[[Symbol]]` renderer (`web/.vitepress/prose-math.ts`, #353).

## What it would buy

Every demo becomes a test. A syntax change reaches the whole site through one printer.
And the docs exercise the notebook the way users will.

## What it costs, and open questions

- Build time: evaluating whole pages at build could add to the ~6-minute site build, most
  of which is Vite bundling today.
- Authoring: is markdown with `$…$` islands easier to write than a notebook document?
  Which pages are worth converting first (the guides? the explore rigs)?
- It needs the `<Head>` canonical form first ([vdom-canonical-form.md](./vdom-canonical-form.md)).
