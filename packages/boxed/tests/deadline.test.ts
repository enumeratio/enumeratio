import { expect, test } from "vite-plus/test";
import { checkpoint, DeadlineExceededError, withDeadline } from "../src/deadline.ts";

test("checkpoint is a no-op with no deadline armed", () => {
  expect(() => checkpoint()).not.toThrow();
});

test("checkpoint throws once an already-expired deadline is armed", () => {
  expect(() => withDeadline(-1, checkpoint)).toThrow(DeadlineExceededError);
});

test("checkpoint does not throw within a deadline that has not passed", () => {
  expect(withDeadline(10_000, () => 42)).toBe(42);
});

test("withDeadline restores the outer state once it returns", () => {
  withDeadline(-1, () => {
    /* expired, but not checked here */
  });
  expect(() => checkpoint()).not.toThrow();
});

test("nesting only shortens the effective deadline, never extends it", () => {
  // The outer span is already expired; a looser inner one must not un-expire it.
  expect(() => withDeadline(-1, () => withDeadline(10_000, checkpoint))).toThrow(
    DeadlineExceededError,
  );
});
