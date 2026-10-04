# @enumeratio/census

The whole namespace in one engine: what we declare, what it collides with, and what Wolfram
can do that we cannot. It exists for `fullEngine` alone — every library we ship, declared
into one `ComputeEngine` — because questions about the namespace as a whole are only
answerable against a complete engine, and a library left out of the list is a library those
questions silently pass over. Depends on nearly everything; nothing depends back on it,
which is what lets it depend on everything (`reference` can't play this role itself: it's a
dependency of the collections/statistics packages that type entries against it).

Encodes the rule from [Symbols](https://github.com/enumeratio/enumeratio/wiki/Symbols) §2 (when a name is already Wolfram's,
what we do about it) and the `HarmonicNumber`-shaped check from
[Roadmap](https://github.com/enumeratio/enumeratio/wiki/Roadmap) §1 (a head the transpiler will emit that the engine
doesn't actually answer).

## Entry points

`.` (`src/index.ts`):

- **`PLAN`/`DECLARATIONS`/`PACKAGE_DECLARATIONS`/`declaredNames`/`fullEngine`** (`engine.ts`) —
  every library this package depends on, declared in the order the manifest's hierarchy gives
  (`buildEngine`) into one engine, with the steps the census adds after combinatorics;
  `declaredNames` is the resulting binding table, the input to any collision or coverage check.
- **`contributions`/`Contribution`** (`contributions.ts`) — per head, which packages add it,
  re-sign it, or replace its handler, the type the engine ends up printing, and whether it
  holds its arguments. The manifest ([`manifest`](../manifest/README.md)) must agree —
  `tests/manifest.test.ts` holds it to it.
- **`CALL_FORMS`/`FRONTIER`/`FrontierEntry`** (`wolfram-frontier-data.ts`, generated) — what
  Wolfram's own docs examples call that we can't answer yet, ranked.
- **`RENAME_QUEUE`/`QueuedRename`** (`rename-queue.ts`) — a head declared under a spelling
  we've decided against, and what it should become; a test fails the moment a rename lands so
  the row comes out. Web-component tag renames are queued in
  [Component Naming](https://github.com/enumeratio/enumeratio/wiki/Component-Naming) §4 instead, since they aren't engine heads.

## Commands

```sh
vp check
vp test

vp node packages/census/scripts/audit-head-map.ts          # regenerate wolfram-frontier-data.ts's undeclared/unevaluated lists
vp node packages/census/scripts/collect-wolfram-frontier.ts # scrape Wolfram's docs examples for call forms and head gaps
vp node packages/census/scripts/type-records.ts             # write each package's contribution into the reference records
```

`audit-head-map.ts`'s `undeclared` list is gated by `tests/head-map-audit.test.ts`;
`unevaluated` is read-only — a passing sample on one overload arm isn't proof the head is
right on every shape it takes.

## Next

[Namespaces](https://github.com/enumeratio/enumeratio/wiki/Namespaces) and [Symbols](https://github.com/enumeratio/enumeratio/wiki/Symbols) are the two design docs this package
enforces; [Manifest](https://github.com/enumeratio/enumeratio/wiki/Manifest) is what `contributions.ts` keeps in sync with.
