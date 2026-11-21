import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';

test('edits legacy purchases in place, persists changes, and enforces device ownership',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'goldfolio-edit-'));
 const device='11111111-1111-4111-8111-111111111111';
 const other='22222222-2222-4222-8222-222222222222';
 const lot='33333333-3333-4333-8333-333333333333';
 writeFileSync(path.join(dir,'store.json'),JSON.stringify({devices:{[device]:{lots:[{id:lot,grams:5,buyPrice:400,date:'2025-01-01',note:'Old purchase'}],alerts:[]}},history:[],quote:null}));
 const child=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{env:{...process.env,DATA_DIR:dir,PORT:'0'},stdio:['ignore','pipe','ignore']});
 try {
  const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),10000);child.stdout.on('data',d=>{const match=d.toString().match(/http:\/\/localhost:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});child.on('error',e=>{clearTimeout(timer);reject(e);});});
  const edit=(id,body,target=lot)=>fetch(url+'/api/lots/'+target,{method:'PATCH',headers:{'Content-Type':'application/json','x-device-id':id},body:JSON.stringify(body)});
  assert.equal((await edit(other,{grams:7,totalCost:3000})).status,404);
  assert.equal((await edit(device,{grams:0,totalCost:3000})).status,400);
  assert.equal((await edit(device,{grams:7,totalCost:3000,note:'Updated description'})).status,200);
  const response=await fetch(url+'/api/portfolio',{headers:{'x-device-id':device}});
  const {lots}=await response.json();assert.equal(lots.length,1);
  assert.deepEqual(lots[0],{id:lot,grams:7,date:'2025-01-01',note:'Updated description',totalCost:3000});
  const stored=JSON.parse(readFileSync(path.join(dir,'store.json')));assert.equal(stored.devices[device].lots[0].totalCost,3000);
 }finally{const exited=once(child,'exit');child.kill();await exited;rmSync(dir,{recursive:true,force:true});}
});
