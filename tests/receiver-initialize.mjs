import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
for (const mode of ['keyed','anonymous','paused']) test(`real package initialization: ${mode}`,async()=>{
 const home=mkdtempSync(join(tmpdir(),'nanmesh-init-'));
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../build/index.js',import.meta.url))],stderr:'pipe',env:{HOME:home,USERPROFILE:home,NANMESH_AGENT_KEY:mode==='anonymous'?'':'existing-fixture-key',NANMESH_API_URL:'http://127.0.0.1:1',NANMESH_NETWORK_ENABLED:mode==='paused'?'false':'true'}});
 const client=new Client({name:'initializer-test',version:'1'});
 try{
  await client.connect(transport);
  const expected=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
  assert.equal(client.getServerVersion().version,expected);
  const instructions=client.getInstructions();
  assert.match(instructions.slice(0,512),/may decline or defer silently/);
  if(mode==='keyed') {assert.match(instructions,/explicitly user-enabled legacy/);assert.match(instructions,/accepted:true BEFORE ending the turn/);}
  if(mode==='anonymous') assert.match(instructions,/No Agent identity/);
  if(mode==='paused') assert.match(instructions,/paused locally/);
  const names=(await client.listTools()).tools.map(t=>t.name);
  assert.ok(names.includes('nanmesh.network.presentation'));
  assert.ok(names.includes('nanmesh.dot.message'));
 }finally{await client.close();rmSync(home,{recursive:true,force:true});}
});
