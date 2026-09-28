import { describe, expect, test } from "vite-plus/test";
import { resolveReviewLink, splitHash } from "./link.ts";

describe("resolveReviewLink", () => {
  test("rewrites the production host to a local path", () => {
    expect(resolveReviewLink("https://enumeratio.dev/reference/symbol/Primes")).toEqual({
      kind: "local",
      path: "/reference/symbol/Primes",
    });
  });

  test("keeps search and hash from the production host", () => {
    expect(resolveReviewLink("https://enumeratio.dev/reference/symbol/Primes?x=1#example-2")).toEqual({
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

  test("rewrites the local dev server to a local path, any port", () => {
    expect(resolveReviewLink("http://localhost:5173/reference/symbol/Floor")).toEqual({
      kind: "local",
      path: "/reference/symbol/Floor",
    });
    expect(resolveReviewLink("http://127.0.0.1:4173/guide/")).toEqual({ kind: "local", path: "/guide/" });
  });

  test("leaves github.com (and other unrelated hosts) external, e.g. because it refuses to be framed", () => {
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

describe("splitHash", () => {
  test("splits a path with a fragment", () => {
    expect(splitHash("/reference/symbol/Primes#example-2")).toEqual({
      path: "/reference/symbol/Primes",
      id: "example-2",
    });
  });

  test("no fragment: empty id", () => {
    expect(splitHash("/guide/")).toEqual({ path: "/guide/", id: "" });
  });

  test("decodes the fragment (an opaque string, never parsed for shape)", () => {
    expect(splitHash("/reference/symbol/Arccos#example%2Ffinding-42")).toEqual({
      path: "/reference/symbol/Arccos",
      id: "example/finding-42",
    });
  });
});
