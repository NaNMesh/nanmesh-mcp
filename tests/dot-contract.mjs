import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { installNetwork, DOT_CONTRACT } from '../build/network.js';

// The reference must ship with the package and exist in standalone checkouts.
const shipped = JSON.parse(readFileSync(new URL('../dot-contract.json', import.meta.url),'utf8'));
assert.deepEqual(DOT_CONTRACT, shipped, 'The built bridge must load the shipped dot contract');
assert.equal(shipped.schema_version, 'nanmesh.dot.v1');
assert.equal(shipped.tools.length, 10);
assert.equal(new Set(shipped.tools.map(tool => tool.name)).size, 10);
// When the backend directory exists, parity is mandatory: a missing/malformed
// backend contract must fail. Standalone mirrors do not have that directory.
const backendDirectory = new URL('../../backend/', import.meta.url);
if (existsSync(backendDirectory)) {
  const backend = JSON.parse(readFileSync(new URL('recommendation_network/dot-contract.json', backendDirectory),'utf8'));
  assert.deepEqual(shipped, backend, 'HTTP and npm dot contracts must remain aligned');
  console.log('Monorepo HTTP/npm contract parity passed');
}

function normalizedSchema(value) {
  if (Array.isArray(value)) return value.map(normalizedSchema);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key, item]) => item !== undefined && key !== '$schema' && !(key === 'required' && item.length === 0) && !(key === 'minLength' && item === 0))
    .map(([key, item]) => [key, key === 'pattern' ? new RegExp(item).source : normalizedSchema(item)]));
}
const server = new McpServer({ name:'dot-contract-fixture', version:'1' });
installNetwork(server, { apiUrl:'http://127.0.0.1:1', getKey:()=>'' });
const client = new Client({name:'dot',version:'1'});
const [a,b] = InMemoryTransport.createLinkedPair();
await server.connect(a); await client.connect(b);
try {
  const tools = (await client.listTools()).tools;
  assert.equal(tools.filter(tool => tool.name.startsWith('nanmesh.dot.')).length, 10);
  for (const expected of shipped.tools) {
    const found = tools.find(tool=>tool.name===expected.name);
    assert.ok(found, expected.name);
    assert.equal(found.description, expected.description);
    assert.equal(found.inputSchema.additionalProperties, false);
    assert.deepEqual(found.annotations, expected.annotations);
    const schema = structuredClone(expected.inputSchema);
    if (expected.name === 'nanmesh.dot.update_project') {
      // Zod's non-empty-object refinement is enforced on calls rather than
      // advertised as minProperties. The empty-update call below must fail.
      assert.equal(schema.properties.project.minProperties, 1);
      delete schema.properties.project.minProperties;
    }
    assert.deepEqual(normalizedSchema(found.inputSchema), normalizedSchema(schema), `${expected.name} must advertise the shipped field constraints`);
  }
  for (const [name,args] of [
    ['nanmesh.dot.discover',{query:'game'}],
    ['nanmesh.dot.inspect',{project_ref:'launchnest'}],
    ['nanmesh.dot.message',{message_type:'question',title:'[TEST] AI 助手如何发现并接续公开讨论？',content:'已验证能力、限制或待确认问题。\n不授权读取私信。',publication_authorized:true,request_id:'c3137997-5577-4165-b3b2-c3860f3e61a8'}],
  ]) {
    const found=tools.find(t=>t.name===name);
    for (const [field,value] of Object.entries(args)) {
      const pattern=found.inputSchema.properties[field]?.pattern;
      if(pattern) { const match=new RegExp(pattern).exec(value); assert.equal(match?.[0],value,`${name}.${field} full match`); }
    }
    const result=await client.callTool({name,arguments:args});
    assert.match(result.content[0].text,/agent_key_required/); // Passed validation; no transport or publication.
  }
  for (const args of [
    {message_type:'question',title:'Public question',content:'Allowed facts',publication_authorized:false},
    {message_type:'question',title:'Public question',content:'x'.repeat(2001),publication_authorized:true},
    {message_type:'question',title:'Public question',content:'Allowed facts',publication_authorized:true,agent_id:'forged'},
    {message_type:'question',title:'Public question',content:'Allowed facts',publication_authorized:true,project_refs:Array(21).fill('project')},
    {message_type:'question',title:'Public question',content:'Allowed facts',publication_authorized:true,request_id:'not-a-uuid'},
  ]) {
    const result = await client.callTool({name:'nanmesh.dot.message',arguments:args});
    assert.equal(result.isError,true);
    assert.match(result.content[0].text,/validation error/i);
  }
  for (const args of [{agent_id:'other'}, {owner:'other'}, {action:'follow'}, {view:'unknown'}, {offset:-1}, {limit:21}, {reply_ids:['forged']}]) {
    const result = await client.callTool({name:'nanmesh.dot.followup',arguments:args});
    assert.equal(result.isError,true);
    assert.match(result.content[0].text,/validation error/i);
  }
  const followup = tools.find(t=>t.name==='nanmesh.dot.followup');
  assert.equal(followup.annotations.readOnlyHint,true);
  const empty = await client.callTool({name:'nanmesh.dot.update_project', arguments:{project_ref:'project',project:{},publication_authorized:true}});
  assert.equal(empty.isError,true);
  const unavailable = await client.callTool({name:'nanmesh.dot.candidates',arguments:{}});
  assert.match(unavailable.content[0].text,/agent_key_required/);
} finally { await client.close(); await server.close(); }
console.log('Dot stdio: ten shipped tools, advertised field constraints, bounded schemas, authorization and forged-identity rejection passed');
