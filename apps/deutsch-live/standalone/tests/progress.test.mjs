import test from 'node:test';
import assert from 'node:assert/strict';
import {makeProgressClient} from '../src/progress.js';
test('guest cannot load or save account progress',async()=>{
 const api=makeProgressClient(null);
 await assert.rejects(()=>api.load(),/Sign in/);
 await assert.rejects(()=>api.save({},0),/Sign in/);
});
test('save uses verified identity and preserves conflict errors',async()=>{
 let calls=0;
 const api=makeProgressClient({auth:{getUser:async()=>({data:{user:{id:'alice'}}})},rpc:async(name,args)=>{
  calls++; assert.equal(name,'save_german_progress'); assert.deepEqual(Object.keys(args).sort(),['expected_revision','new_docs']);
  return {error:{message:'progress_conflict'}};
 }});
 await assert.rejects(()=>api.save({meta:{}},1),e=>e.conflict===true);
 assert.equal(calls,1);
});
test('expired session prevents database writes',async()=>{
 const api=makeProgressClient({auth:{getUser:async()=>({data:{user:null},error:{}})},rpc:()=>assert.fail('must not write')});
 await assert.rejects(()=>api.save({},0),/sign in again/);
});
test('switching account cannot write the prior account progress',async()=>{
 let id='alice';let calls=0;
 const api=makeProgressClient({auth:{getUser:async()=>({data:{user:{id}}})},rpc:async(name)=>{calls++;return {data:name==='get_german_progress'?{docs:null,revision:0}:1};}});
 await api.load();id='bob';await assert.rejects(()=>api.save({},0),/Account changed/);assert.equal(calls,1);
});
