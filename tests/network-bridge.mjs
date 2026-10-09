import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ResourceUpdatedNotificationSchema, SubscribeRequestSchema, UnsubscribeRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { installNetwork } from '../build/network.js';
const URI = 'nanmesh://network/inbox';
const pause = ms => new Promise(r => setTimeout(r, ms));
async function until(fn) { for (let i=0;i<100;i++) { if(fn()) return; await pause(20); } assert.fail('Timed out'); }
async function downstream(url, key) {
  const server = new McpServer({name:'local',version:'1'});
  server.registerTool('trust', {}, async () => ({content:[{type:'text',text:'works'}]}));
  installNetwork(server, {apiUrl:url,getKey:()=>key});
  const [a,b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({name:'test',version:'1'});
  await client.connect(b);
  return {server,client,close:async()=>{await client.close();await server.close();}};
}
let hits=0, initialized=0, reads=0, subscribed=0, configured=0, dotReads=0;
const remote = new McpServer({name:'remote',version:'1'});
remote.server.registerCapabilities({resources:{subscribe:true}});
remote.server.oninitialized = () => initialized++;
remote.registerTool('nanmesh.network.status', {}, async()=>({content:[{type:'text',text:JSON.stringify({subscription:{enabled:false}})}]}));
remote.registerTool('nanmesh.network.configure', {}, async()=>{configured++;return {content:[]};});
remote.registerTool('nanmesh.dot.candidates', {}, async()=>{dotReads++;return {content:[{type:'text',text:JSON.stringify({candidates:[],human_presentation_required:false})}]};});
remote.registerResource('inbox',URI,{},async()=>{reads++;return {contents:[{uri:URI,text:'untrusted'}]};});
remote.server.setRequestHandler(SubscribeRequestSchema,async()=>{subscribed++;return {};});
remote.server.setRequestHandler(UnsubscribeRequestSchema,async()=>{subscribed--;return {};});
const transport = new StreamableHTTPServerTransport({sessionIdGenerator:randomUUID});
await remote.connect(transport);
const http = createServer((req,res)=>{hits++;assert.equal(req.headers['x-agent-key'],'existing-test-key');void transport.handleRequest(req,res);});
await new Promise(r=>http.listen(0,'127.0.0.1',r));
const url = `http://127.0.0.1:${http.address().port}`;
try {
  const missing = await downstream(url,'');
  const noKey = await missing.client.callTool({name:'nanmesh.network.status',arguments:{}});
  assert.match(noKey.content[0].text,/agent_key_required/);
  assert.equal(hits,0);await missing.close();
  process.env.NANMESH_NETWORK_ENABLED='false';
  const disabled=await downstream(url,'existing-test-key');
  assert.match((await disabled.client.callTool({name:'nanmesh.network.status',arguments:{}})).content[0].text,/disabled_locally/);
  assert.equal(hits,0);await disabled.close();delete process.env.NANMESH_NETWORK_ENABLED;
  const d = await downstream(url,'existing-test-key');
  try {
    await until(()=>initialized===1);
    assert.equal(reads,0);assert.equal(configured,0);assert.equal(dotReads,0);
    const result=await d.client.callTool({name:'nanmesh.network.status',arguments:{}});
    assert.deepEqual(JSON.parse(result.content[0].text),{subscription:{enabled:false}});
    assert.equal(configured,0);
    assert.equal(d.client.getServerCapabilities().resources.subscribe,true);
    assert.equal((await d.client.listTools()).tools.filter(t=>t.name.startsWith('nanmesh.network.')).length,10);
    assert.equal((await d.client.listTools()).tools.filter(t=>t.name.startsWith('nanmesh.dot.')).length,9);
    const dot=await d.client.callTool({name:'nanmesh.dot.candidates',arguments:{}});
    assert.equal(JSON.parse(dot.content[0].text).human_presentation_required,false);
    assert.equal(dotReads,1);
    let notifications=0;
    d.client.setNotificationHandler(ResourceUpdatedNotificationSchema,async()=>{notifications++;});
    await remote.server.sendResourceUpdated({uri:URI});await pause(60);assert.equal(notifications,0);
    await d.client.subscribeResource({uri:URI});assert.equal(subscribed,1);
    await remote.server.sendResourceUpdated({uri:URI});await until(()=>notifications===1);
    await d.client.unsubscribeResource({uri:URI});
    await remote.server.sendResourceUpdated({uri:URI});await pause(60);assert.equal(notifications,1);
    assert.equal(reads,0);
    // An upstream error is returned unchanged and does not damage other tools.
    const failure=await d.client.callTool({name:'nanmesh.network.ask',arguments:{item_id:'test',question:'details?'}});
    assert.equal(failure.isError,true);
    assert.equal((await d.client.callTool({name:'trust'})).content[0].text,'works');
  } finally {await d.close();}
} finally {await remote.close();http.closeAllConnections();await new Promise(r=>http.close(r));}
let leaked=0;
const target=createServer((req,res)=>{leaked++;res.end();});
await new Promise(r=>target.listen(0,'127.0.0.1',r));
const redirect=createServer((req,res)=>{res.writeHead(307,{Location:`http://127.0.0.1:${target.address().port}/steal`});res.end();});
await new Promise(r=>redirect.listen(0,'127.0.0.1',r));
try {
  const d=await downstream(`http://127.0.0.1:${redirect.address().port}`,'existing-test-key');
  try {
    assert.equal((await d.client.callTool({name:'nanmesh.network.status',arguments:{}})).isError,true);
    assert.equal(leaked,0);
    assert.equal((await d.client.callTool({name:'trust'})).content[0].text,'works');
  } finally {await d.close();}
} finally {
  redirect.closeAllConnections();target.closeAllConnections();
  await Promise.all([new Promise(r=>redirect.close(r)),new Promise(r=>target.close(r))]);
}
console.log('Network bridge: startup, opt-out, notification gating, no-key, local disable, isolation and redirect tests passed');

// A real HTTP peer that drops a subscription stream and loses a mutation reply.
let sessions=0, subscribes=0, deletes=0, mutations=0, engagement=0;
const streams=new Set();
let hangingClosed=false, failGet=false;
const peerHttp=createServer(async(req,res)=>{
  if(req.method==='DELETE'){deletes++;res.writeHead(200);res.end();return;}
  if(req.method==='GET'){
    if(failGet){res.writeHead(503);res.end();return;}
    res.writeHead(200,{'content-type':'text/event-stream'});res.flushHeaders();
    streams.add(res);res.on('close',()=>streams.delete(res));return;
  }
  let raw='';for await(const chunk of req)raw+=chunk;
  const message=JSON.parse(raw);
  if(message.id===undefined){res.writeHead(202);res.end();return;}
  let result={};
  if(message.method==='initialize'){
    sessions++;res.setHeader('mcp-session-id',String(sessions));
    result={protocolVersion:'2025-03-26',capabilities:{resources:{subscribe:true},tools:{}},serverInfo:{name:'fixture',version:'1'}};
  } else if(message.method==='resources/subscribe')subscribes++;
  else if(message.method==='resources/read')engagement++;
  else if(message.method==='tools/call'){
    if(message.params.name==='nanmesh.network.configure'){
      mutations++;res.destroy();return;
    }
    if(message.params.name==='nanmesh.network.ask'){
      res.writeHead(200,{'content-type':'text/event-stream'});res.flushHeaders();
      res.on('close',()=>{hangingClosed=true;});return;
    }
    engagement++;
  }
  res.setHeader('content-type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));
});
await new Promise(r=>peerHttp.listen(0,'127.0.0.1',r));
try {
  const d=await downstream(`http://127.0.0.1:${peerHttp.address().port}`,'existing-test-key');
  await until(()=>sessions===1);
  await d.client.subscribeResource({uri:URI});
  await until(()=>streams.size>0);
  for(const response of streams)response.destroy();
  await until(()=>sessions>=2&&subscribes>=2);
  assert.equal(engagement,0,'Reconnect must not read recommendations');
  assert.ok(deletes>=1,'Replacement terminates previous session');
  const ambiguous=await d.client.callTool({name:'nanmesh.network.configure',arguments:{enabled:false}});
  const unavailable=JSON.parse(ambiguous.content[0].text);
  assert.equal(unavailable.subscription_change,'unknown');
  assert.equal(mutations,1,'Ambiguous mutation must not retry');
  await d.client.unsubscribeResource({uri:URI});
  const before=sessions;await pause(1300);assert.equal(sessions,before,'Unsubscribe cancels reconnect');
  const pendingAsk=d.client.callTool({name:'nanmesh.network.ask',arguments:{item_id:'demo',question:'Details?'}},undefined,{timeout:2000}).catch(()=>{});
  await pause(100);
  await d.close();await pendingAsk;
  await until(()=>hangingClosed);
  assert.ok(deletes>=2,'Final close terminates session');
  const storm=await downstream(`http://127.0.0.1:${peerHttp.address().port}`,'existing-test-key');
  await storm.client.subscribeResource({uri:URI});
  const initialSessions=sessions;
  failGet=true;for(const response of streams)response.destroy();
  await pause(5500);
  assert.ok(sessions<=initialSessions+3,'GET failures must not cause endless successful POST handshakes');
  const capped=sessions;await pause(1500);assert.equal(sessions,capped);
  await storm.close();
  console.log('Network bridge: background reconnect, ambiguous mutation, session DELETE, retry cap and POST SSE cancellation passed');
} finally {peerHttp.closeAllConnections();await new Promise(r=>peerHttp.close(r));}
