import { describe, expect, test } from "vite-plus/test";
import { resolveReviewLink } from "./link.ts";

describe("resolveReviewLink", () => {
  test("rewrites the production host to a local path", () => {
    expect(resolveReviewLink("https://enumeratio.dev/reference/symbol/Primes")).toEqual({
      kind: "local",
      path: "/reference/symbol/Primes",
    });
  });

  test("keeps search and hash from the production host", () => {
    expect(
      resolveReviewLink("https://enumeratio.dev/reference/symbol/Primes?x=1#example-2"),
    ).toEqual({
      kind: "local",
      path: "/reference/symbol/Primes?x=1#example-2",
    });
  });

  test("rewrites a Cloudflare Pages preview host to a local path", () => {
    expect(resolveReviewLink("https://a1b2c3d.enumeratio.pages.dev/guide/")).toEqual({
      kind: "local",
      path: "/guide/",
    });
  });

  test("rejects a preview-looking host with the wrong shape", () => {
    // 6 hex digits, not 7 -- must not match.
    expect(resolveReviewLink("https://a1b2c3.enumeratio.pages.dev/guide/")).toEqual({
      kind: "external",
      href: "https://a1b2c3.enumeratio.pages.dev/guide/",
    });
  });

  test("rejects a preview host with non-hex characters", () => {
    expect(resolveReviewLink("https://zzzzzzz.enumeratio.pages.dev/guide/")).toEqual({
      kind: "external",
      href: "https://zzzzzzz.enumeratio.pages.dev/guide/",
    });
  });

  test("leaves an unrelated host external", () => {
    expect(resolveReviewLink("https://github.com/enumeratio/notatio/pull/101")).toEqual({
      kind: "external",
      href: "https://github.com/enumeratio/notatio/pull/101",
    });
  });

  test("treats an already-relative path as local", () => {
    expect(resolveReviewLink("/reference/symbol/Primes")).toEqual({
      kind: "local",
      path: "/reference/symbol/Primes",
    });
  });

  test("treats an empty link as external (nothing to navigate to)", () => {
    expect(resolveReviewLink("")).toEqual({ kind: "external", href: "" });
  });

  test("ignores a non-http(s) scheme", () => {
    expect(resolveReviewLink("mailto:someone@enumeratio.dev")).toEqual({
      kind: "external",
      href: "mailto:someone@enumeratio.dev",
    });
  });
});
