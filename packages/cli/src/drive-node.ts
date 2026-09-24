// The driver (drive.ts) on a Node TTY: readline names the keys, raw stdin carries the
// mouse reports, and the prompt's own keypress listeners are held while the strip runs.

import { emitKeypressEvents } from "node:readline";
import { type Key, driver } from "./drive.ts";

type Json = Parameters<typeof driver>[0];

export interface DriveHost {
  /** Evaluate a pinned expression and render it as the session would. */
  show(expr: Json): string;
  color: boolean;
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
}

/**
 * Drive the controls of `expr` until the reader is done; resolves with the pinned
 * expression they left it at. Takes over the keypress stream while it runs.
 */
export function drive(expr: Json, host: DriveHost): Promise<Json> {
  const { stdin, stdout } = host;
  const d = driver(expr, {
    show: (e) => host.show(e),
    color: host.color,
    mouse: stdin.isTTY === true,
    write: (text) => stdout.write(text),
    cursorRow: () => stdout.rows ?? 24,
    columns: () => stdout.columns ?? 80,
  });
  if (d === undefined) return Promise.resolve(expr);

  return new Promise((resolve) => {
    emitKeypressEvents(stdin);
    // readline owns the keypress stream; hold its listeners while the strip does.
    const held = stdin.listeners("keypress") as ((...args: unknown[]) => void)[];
    for (const l of held) stdin.off("keypress", l);
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);

    const finish = (): void => {
      d.stop();
      stdin.off("keypress", onKey);
      stdin.off("data", onData);
      if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
      for (const l of held) stdin.on("keypress", l);
      resolve(d.pinned());
    };
    // Mouse reports arrive as raw bytes; keypress sees them too, and ignores them.
    const onData = (chunk: Buffer | string): void => d.data(String(chunk));
    const onKey = (_: string, key: Key = {}): void => {
      if (d.key(key)) finish();
    };
    stdin.on("keypress", onKey);
    stdin.on("data", onData);
    d.draw();
  });
}
