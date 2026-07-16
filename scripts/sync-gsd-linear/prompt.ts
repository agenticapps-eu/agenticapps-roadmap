// ---------------------------------------------------------------------------
// Interactive y/N approval gate for sync-gsd-linear (D-06-07).
//
// Uses the builtin Promise-based readline interface -- no dependency needed
// for a single yes/no prompt (06-RESEARCH.md Standard Stack). Only "y"/"yes"
// (case-insensitive)
// resolves true; anything else -- including a bare Enter -- is a safe
// default-No, matching the CLI's dry-run-first posture.
// ---------------------------------------------------------------------------

import { createInterface } from "node:readline/promises";

export async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
