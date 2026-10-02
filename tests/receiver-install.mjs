import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,writeFileSync,rmSync,symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateReceiver,RECEIVER_RULE,DOT_RECEIVER_RULE } from '../build/receiver.js';
test('explicit receiver enable preserves existing instructions and is idempotent/reversible',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nanmesh-receiver-'));
 try{
  const file=join(dir,'AGENTS.md');writeFileSync(file,'Existing owner rules.\n');
  assert.equal(updateReceiver(file,true),true);
  const installed=readFileSync(file,'utf8');assert.ok(installed.startsWith('Existing owner rules.\n'));assert.ok(installed.includes(RECEIVER_RULE));
  assert.equal(updateReceiver(file,true),false);
  assert.equal(updateReceiver(file,false),true);assert.equal(readFileSync(file,'utf8').trim(),'Existing owner rules.');
  assert.equal(updateReceiver(file,false),false);
  writeFileSync(file,'<!-- nanmesh-receiver:start -->broken');assert.throws(()=>updateReceiver(file,true),/markers/);
  const link=join(dir,'link.md');symlinkSync(file,link);assert.throws(()=>updateReceiver(link,true),/non-regular/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('explicit dot profile replaces notices, preserves owner instructions and permits silent decline',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nanmesh-dot-profile-'));
 try {
  const file=join(dir,'AGENTS.md');writeFileSync(file,'Owner rules.\n');
  updateReceiver(file,true);
  assert.equal(updateReceiver(file,true,'dot'),true);
  const installed=readFileSync(file,'utf8');
  assert.ok(installed.startsWith('Owner rules.\n'));
  assert.ok(installed.includes(DOT_RECEIVER_RULE));
  assert.ok(!installed.includes(RECEIVER_RULE));
  assert.match(installed,/decline or defer silently/);
  assert.match(installed,/nanmesh.dot.guide/);
  assert.equal(updateReceiver(file,true,'dot'),false);
  assert.equal(updateReceiver(file,false),true);
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('npm bin symlink executes explicit enable and disable',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nanmesh-npx-'));
 try{
  const bin=join(dir,'nanmesh-receiver');symlinkSync(fileURLToPath(new URL('../build/receiver.js',import.meta.url)),bin);
  const env={...process.env,CODEX_HOME:dir};
  const enable=spawnSync(process.execPath,[bin,'enable','--codex'],{env,encoding:'utf8'});
  assert.equal(enable.status,0,enable.stderr);assert.match(enable.stdout,/Updated:/);
  assert.ok(readFileSync(join(dir,'AGENTS.md'),'utf8').includes(RECEIVER_RULE));
  const disable=spawnSync(process.execPath,[bin,'disable','--codex'],{env,encoding:'utf8'});
  assert.equal(disable.status,0,disable.stderr);assert.match(disable.stdout,/Updated:/);
  assert.ok(!readFileSync(join(dir,'AGENTS.md'),'utf8').includes(RECEIVER_RULE));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

 test('explicit upgrade replaces stale receiver block without touching owner instructions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nanmesh-receiver-upgrade-'));
 try {
  const file=join(dir,'AGENTS.md');
  writeFileSync(file,'Owner prefix.\n<!-- nanmesh-receiver:start -->\nOld final-only guidance.\n<!-- nanmesh-receiver:end -->\nOwner suffix.\n');
  assert.equal(updateReceiver(file,true),true);
  const installed=readFileSync(file,'utf8');
  assert.ok(installed.startsWith('Owner prefix.\n')); assert.ok(installed.endsWith('\nOwner suffix.\n'));
  assert.ok(!installed.includes('Old final-only guidance.'));
  assert.match(installed,/BEFORE ending the turn/); assert.match(installed,/accepted:true/);
  assert.equal(updateReceiver(file,true),false);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
