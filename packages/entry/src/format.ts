// The record writer's formatter settings (node.ts, record.ts hand them to oxfmt). They equal
// `fmt` in @enumeratio/config (tests/format.test.ts), which `vp fmt` uses; entry is infra and
// can't depend on that tooling package, so the width is held in both.

export const FORMAT = { printWidth: 120 } as const;
