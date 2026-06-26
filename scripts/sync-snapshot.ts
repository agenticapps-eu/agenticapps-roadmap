import { writeFileSync } from "node:fs";
import { fetchWorkspace } from "./linear/client.ts";
import { buildSnapshot } from "./linear/transform.ts";

const snap = buildSnapshot(await fetchWorkspace());
writeFileSync("public/roadmap.json", JSON.stringify(snap, null, 2));
console.log(`Snapshot written to public/roadmap.json (${snap.projects.length} projects, ${snap.initiatives.length} initiatives)`);
