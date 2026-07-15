import { runCli } from "./sync-gsd-linear/cli.ts";

// IN-03: runCli throws for every failure path (missing key, bulk-write
// guard, GraphQL errors) -- without a try/catch here, a throw became an
// unhandled promise rejection with a full stack trace instead of the clean
// fail-fast message cli.ts's own header claims. Never logs `err` itself
// (which could echo user input back) beyond its message, and no thrown
// message ever contains the token (auth is never interpolated into an
// Error) -- so this can't leak the token either.
try {
  process.exit(await runCli(process.argv.slice(2)));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
