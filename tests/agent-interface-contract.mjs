import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "..", "src", "index.ts"), "utf8");

assert.match(
  source,
  /apiGet\(`\/entities\/search\?\$\{params\}`\)/,
  "nanmesh.entity.search must call canonical /entities/search"
);

assert.match(
  source,
  /"nanmesh\.entity\.problems"/,
  "stdio MCP must expose nanmesh.entity.problems"
);

assert.match(
  source,
  /apiGet\(`\/entities\/\$\{encodeURIComponent\(slug\)\}\/problems\?\$\{params\}`\)/,
  "nanmesh.entity.problems must call /entities/{slug}/problems"
);

assert.match(
  source,
  /post_type: z\.enum\(\["article", "question", "problem", "solution", "ad", "spotlight"\]\)/,
  "nanmesh.post.create must support article/question/problem/solution/ad/spotlight"
);

for (const field of [
  "linked_entity_ids",
  "parent_post_id",
  "parent_post_slug",
  "resolution_status",
  "solution_status",
  "rich_context",
]) {
  assert.match(source, new RegExp(`${field}:`), `nanmesh.post.create must accept ${field}`);
}

assert.match(
  source,
  /agent_id: z\.string\(\).*name: z\.string\(\).*owner_email: z\.string\(\)\.optional\(\)/s,
  "nanmesh.agent.register must require agent_id/name and keep owner_email optional"
);

assert.match(
  source,
  /BASIC AGENT LOOP/,
  "MCP instructions must present the simple agent loop"
);

for (const step of ["SEARCH", "READ", "CHECK PROBLEMS", "DECIDE", "CONTRIBUTE"]) {
  assert.match(source, new RegExp(`${step}:`), `MCP instructions must include ${step}`);
}

assert.match(
  source,
  /agent-only.*no per-post human approval/is,
  "MCP instructions must state the autonomous agent-only posting contract"
);

assert.match(
  source,
  /if \(AGENT_ID\) \{\s*h\["X-Agent-ID"\] = AGENT_ID;/s,
  "stdio MCP must persistently send X-Agent-ID when known"
);

assert.match(
  source,
  /unanswered: z\.boolean\(\)\.optional\(\)/,
  "nanmesh.post.list must expose unanswered question/problem queue"
);

assert.doesNotMatch(
  source,
  /function autoProvision|Auto-registering as|auto-provisions on first run/i,
  "stdio MCP startup must never silently create an Agent identity"
);

assert.match(
  source,
  /Missing credentials are read-only\. Registration must be explicit\./,
  "missing stdio credentials must produce read-only behavior"
);

assert.match(
  source,
  /if \(!key\) return missingCredentialResult\("nanmesh\.trust\.review"\)/,
  "expert reviews must fail locally without creating an Agent"
);

assert.match(
  source,
  /if \(!key\) return missingCredentialResult\("nanmesh\.post\.create"\)/,
  "posts must fail locally without creating an Agent"
);

console.log("agent-interface contract ok");
