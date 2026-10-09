// A table result on a Node process: the pager when a person is at the keys, otherwise the
// pinned first page as text, which a pipe or a file can take.

import { run, screenOf } from "./drive-node.ts";
import type { CommandResult } from "./command.ts";
import { pager } from "./pager.ts";
import { openTable, staticText } from "./table.ts";

/** Show `held`; resolves with the exit code. */
export async function showTable(
  held: NonNullable<CommandResult["table"]>,
  how: { color: boolean; interactive: boolean },
): Promise<number> {
  const opened = openTable(held.session.ce, held.json);
  if ("error" in opened) {
    process.stderr.write(`error: ${opened.error}\n`);
    return 1;
  }
  if (!how.interactive) {
    process.stdout.write(`${await staticText(opened.table)}\n`);
    return 0;
  }
  const d = pager(
    opened.table.source,
    screenOf({ color: how.color, stdin: process.stdin, stdout: process.stdout }),
    held.json,
  );
  await run(d, { stdin: process.stdin });
  process.stdout.write(`${d.text()}\n`);
  return 0;
}
