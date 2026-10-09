import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { kernelVersion, sameRelease } from "../src/kernel-pin.ts";

const MAC = "15.0.0 for Mac OS X ARM (64-bit) (May 26, 2026)";
const LINUX = "15.0.0 for Linux x86 (64-bit) (May 26, 2026)";

describe("a kernel pin compares the release, not the platform", () => {
  test("the same Wolfram 15.0.0 release matches on Mac and on Linux", () => {
    expect(sameRelease(MAC, LINUX)).toBe(true);
    expect(kernelVersion(MAC).release).toBe("15.0.0 (May 26, 2026)");
    expect(kernelVersion(LINUX).release).toBe("15.0.0 (May 26, 2026)");
  });

  test("the platform is reported, not compared", () => {
    expect(kernelVersion(MAC).platform).toBe("Mac OS X ARM (64-bit)");
    expect(kernelVersion(LINUX).platform).toBe("Linux x86 (64-bit)");
  });

  test("a different Wolfram release is a different pin, on any platform", () => {
    expect(sameRelease(MAC, "15.0.1 for Mac OS X ARM (64-bit) (June 2, 2026)")).toBe(false);
    expect(sameRelease(MAC, "15.0.1 for Linux x86 (64-bit) (June 2, 2026)")).toBe(false);
  });

  test("a Sage pin compares its version and date", () => {
    const pin = "SageMath version 10.9, Release Date: 2026-05-04";
    expect(sameRelease(pin, "SageMath version 10.9, Release Date: 2026-05-04")).toBe(true);
    expect(sameRelease(pin, "SageMath version 10.9, Release Date: 2026-06-01")).toBe(false);
    expect(sameRelease(pin, "SageMath version 10.10, Release Date: 2026-06-01")).toBe(false);
  });

  test("a string this file doesn't recognise matches only itself", () => {
    expect(kernelVersion("some other kernel 1.0").release).toBe("some other kernel 1.0");
    expect(sameRelease("some other kernel 1.0", "some other kernel 1.0")).toBe(true);
    expect(sameRelease("some other kernel 1.0", "some other kernel 1.1")).toBe(false);
  });

  test("the pins committed in kernels.json both parse to a release", () => {
    const pins = JSON.parse(readFileSync(new URL("../kernels.json", import.meta.url), "utf8")) as Record<
      string,
      string
    >;
    expect(kernelVersion(pins.wolfram!).release).toBe("15.0.0 (May 26, 2026)");
    expect(kernelVersion(pins.sage!).release).toBe("10.9 (2026-05-04)");
  });
});
