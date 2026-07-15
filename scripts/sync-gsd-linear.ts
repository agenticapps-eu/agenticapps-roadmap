import { runCli } from "./sync-gsd-linear/cli.ts";

process.exit(await runCli(process.argv.slice(2)));
