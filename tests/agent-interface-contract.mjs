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
  /CONTRIBUTE: optional, only with explicit user publication authorization/,
  "MCP instructions must make publication optional and explicitly authorized"
);

assert.match(source, /All reads are free/, "read-side checks remain free");
assert.match(source, /No registration or post is required/, "local evaluation must not require contribution");
assert.match(source, /bounded local trial/, "missing evidence must lead to useful local evaluation");
assert.match(source, /Research-only questions require approval of the exact draft type and content/,
  "research-only publication needs approval of the exact draft");
assert.doesNotMatch(source, /standing authorization|no per-post human approval|without asking for per-post human approval/i,
  "installation or registration must never grant publication authorization");

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
