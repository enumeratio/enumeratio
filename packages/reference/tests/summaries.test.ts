import { expect, test } from "vite-plus/test";
import { referenceEntries } from "../src/node.ts";

// A record created for a head that had none (census's type-records script) starts with a
// placeholder summary; a person replaces it before it lands.
test("no record's summary is still the placeholder", () => {
  const placeholder = referenceEntries()
    .filter(
      (e) =>
        e.summary.trim() === "TODO: summary" ||
        (e.signatures ?? []).some((s) => s.description.trim() === "TODO: summary"),
    )
    .map((e) => e.name);
  expect(placeholder).toEqual([]);
});
