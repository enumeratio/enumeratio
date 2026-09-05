# Contributing

The full contributor guide — repo shape, local setup, verification gates, conventions, and the LLM-assisted
workflow — lives on the docs site:

**[enumeratio.dev/develop/contributing/](https://enumeratio.dev/develop/contributing/)**

Quick start:

```bash
pnpm install
cd packages/data && node --import tsx run.mts   # apply the core, run the example suite
pnpm docs:dev                                    # the docs site, from repo root
```
