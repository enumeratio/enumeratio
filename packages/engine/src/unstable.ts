/**
 * The full compute-engine API, as the copy this package pins: one class identity, so values
 * made here and in the nucleus are the same classes.
 *
 * OUTSIDE SEMVER. Anything reached through here can change or vanish on a compute-engine bump.
 * Every use carries a one-line comment naming why the facade doesn't cover it:
 *
 *     // unstable: <reason, and the issue if there is one>
 *
 * The count of those comments is how we see what the facade is missing; the target is zero.
 */
export * from "@cortex-js/compute-engine";
