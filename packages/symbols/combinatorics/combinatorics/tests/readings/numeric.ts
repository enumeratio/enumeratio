// The numeric sequences whose TS kernel no longer runs ahead of its Epsil definition (UNWIRED in
// collections/src/families/numeric-definitions.ts), as the fast path they were: the kernel in its own list,
// read as plain numbers, and the reach it kept. tests/fast-kernels.test.ts holds them to the definitions.
import type { FastKernel } from "../../collections/src/families/epsil.ts";
import { kernels as closedForm } from "../../collections/src/families/numeric-closed-form.ts";
import { fastOf, UNWIRED } from "../../collections/src/families/numeric-definitions.ts";
import { kernels as digits } from "../../collections/src/families/numeric-digits-primes.ts";
import { kernels as recurrence } from "../../collections/src/families/numeric-recurrence.ts";
import { kernels as sets } from "../../collections/src/families/numeric-sets.ts";

const listed = [...sets, ...closedForm, ...recurrence, ...digits];
const kernelOf = (head: string) => listed.find((kernel) => kernel.head === head)!;

/** The bit kernels scan up to the rank or element, which compiled Epsil answers in closed form past them. */
const BIT_REACH = { unrank: 100_000, rank: 200_000 };
const REACHES: Record<string, Parameters<typeof fastOf>[1]> = { EvilNumbers: BIT_REACH, OdiousNumbers: BIT_REACH };

export const readings: Record<string, FastKernel> = Object.fromEntries(
  [...UNWIRED].map((head) => [head, fastOf(kernelOf(head), REACHES[head])]),
);
