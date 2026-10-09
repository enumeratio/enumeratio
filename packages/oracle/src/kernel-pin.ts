// What `kernels.json` pins for a system, and what a running kernel reports. A pin compares the
// release: the version and its build date. The platform is informational, since the same release
// reports a different platform on each machine (Wolfram 15.0.0 is "for Mac OS X ARM (64-bit)" on
// a Mac and "for Linux x86 (64-bit)" on Linux). A version string this file doesn't know is its
// own release, so an unrecognised kernel still matches only its exact string.

/** A kernel's version string, split into the part a pin compares and the part it only reports. */
export interface KernelVersion {
  /** The version and its build date: `15.0.0 (May 26, 2026)`, `10.9 (2026-05-04)`. */
  readonly release: string;
  /** Where the kernel runs, for display: `Linux x86 (64-bit)`. Undefined when the string names none. */
  readonly platform?: string;
}

// Wolfram's `$Version`: `15.0.0 for Mac OS X ARM (64-bit) (May 26, 2026)`. The platform may itself
// hold parentheses, so the date is the last parenthesised group.
const WOLFRAM = /^(\S+) for (.+) \(([^()]+)\)$/;
// Sage's `version()`: `SageMath version 10.9, Release Date: 2026-05-04`.
const SAGE = /^SageMath version (\S+), Release Date: (\S+)$/;

/** Split a kernel's version string into its release and its platform. */
export function kernelVersion(version: string): KernelVersion {
  const text = version.trim();
  const wolfram = WOLFRAM.exec(text);
  if (wolfram !== null) return { release: `${wolfram[1]} (${wolfram[3]})`, platform: wolfram[2] };
  const sage = SAGE.exec(text);
  if (sage !== null) return { release: `${sage[1]} (${sage[2]})` };
  return { release: text };
}

/** Whether a running kernel's version is the release `pinned` names; the platform is not compared. */
export function sameRelease(pinned: string, running: string): boolean {
  return kernelVersion(pinned).release === kernelVersion(running).release;
}
