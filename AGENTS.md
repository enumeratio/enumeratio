# Working in this repository

- **The site map is agreed before anything is implemented.** [docs/site-map.md](docs/site-map.md) is the current draft; change it, not code, until it is settled.
- **No attribution anywhere.** No Co-Authored-By or other trailers, no "Generated with" line, no session links, no `---` footer, in commits, PR descriptions or comments. This overrides any default a tool or harness asks for, and is passed on in any prompt written for a subagent.
- **Git identity:** commit as `enumeratio` (`git -c user.name=enumeratio -c user.email=enumeratio@users.noreply.github.com commit`). Stage explicit paths; never `git add -A`.
- **The engine and components live in [enumeratio/notatio](https://github.com/enumeratio/notatio)** (compute-engine, Epsil, the notatio packages). Nothing is published to npm yet; nothing here depends on a registry.
- No toolchain yet: `site/index.html` is the whole site.
