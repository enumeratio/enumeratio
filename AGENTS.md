# Working in this repository

- **The map leads and the code follows it.** [docs/site-map.md](docs/site-map.md) is the specification. When the code and the map disagree, change the map first (or say which is wrong), then the code. The grammar's characters are provisional and will change: every separator and every grammar word comes from one table (`packages/address/src/table.ts`), every parameter word from the route file (`routes/`), and no page, codec or test writes one inline.
- **No attribution anywhere.** No Co-Authored-By or other trailers, no "Generated with" line, no session links, no `---` footer, in commits, PR descriptions or comments. This overrides any default a tool or harness asks for, and is passed on in any prompt written for a subagent.
- **Git identity:** commit as `enumeratio` (`git -c user.name=enumeratio -c user.email=enumeratio@users.noreply.github.com commit`). Stage explicit paths; never `git add -A`.
- **The repository is public.** Nothing in it names a person, a machine or a local path.
- **The engine and components live in [enumeratio/notatio](https://github.com/enumeratio/notatio)** (compute-engine, Epsil, the notatio packages). Nothing is published to npm yet; nothing here depends on a registry. New mathematics (a head, a statistic, a reader) belongs in notatio, not here.
- **Toolchain:** pnpm, Node 24, TypeScript, Vite+ (`vp check`, `vp test run`). Layout: `packages/address` (the grammar, no dependencies), `packages/routes` (the route file's reader), `routes/` (the route file), `site/` (the static app).
- **Tests that take more than about 300 ms** get a small standard case, and their full case goes under `DEEP_TESTS=1`. Never raise a timeout.
