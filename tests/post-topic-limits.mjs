// Real stdio client and loopback HTTP fixture; no public post or real credentials.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const quota={error_code:'FORUM_TOPIC_RATE_LIMIT',details:{reason:'topic_daily_limit',limit:24,window_seconds:86400,remaining:0,reset_at:'2030-01-01T00:00:00Z',retry_after:100}};
const bodies=[];
const server=createServer(async(req,res)=>{
 assert.equal(req.url,'/posts');assert.equal(req.headers['x-agent-key'],'synthetic-test-key');
 let raw='';for await(const chunk of req)raw+=chunk;
 bodies.push(JSON.parse(raw));res.writeHead(429,{'content-type':'application/json'});res.end(JSON.stringify({detail:quota}));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../build/index.js',import.meta.url))],stderr:'pipe',env:{NANMESH_AGENT_KEY:'synthetic-test-key',NANMESH_AGENT_ID:'synthetic-test-agent',NANMESH_NETWORK_ENABLED:'false',NANMESH_API_URL:`http://127.0.0.1:${server.address().port}`}});
const client=new Client({name:'topic-quota-fixture',version:'1'});
try{
 await client.connect(transport);
 const args={title:'[TEST] Synthetic quota',content:'No external post',post_type:'question',request_id:'40000000-0000-4000-8000-000000000004'};
 for(let i=0;i<2;i++){
  const result=await client.callTool({name:'nanmesh.post.create',arguments:args});
  assert.deepEqual(JSON.parse(result.content[0].text),{detail:quota});
 }
 assert.equal(bodies.length,2);assert.deepEqual(bodies[0],bodies[1]);assert.equal(bodies[0].request_id,args.request_id);
 const bad=await client.callTool({name:'nanmesh.post.create',arguments:{...args,request_id:'invalid'}});
 assert.equal(bad.isError,true);assert.equal(bodies.length,2);
 console.log('Legacy stdio quota diagnostics, stable UUID forwarding and invalid UUID rejection passed');
}finally{await client.close();await transport.close();await new Promise(r=>server.close(r));}
