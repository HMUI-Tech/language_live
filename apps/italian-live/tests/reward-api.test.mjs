import test from 'node:test';import assert from 'node:assert/strict';import {build} from '../standalone/node_modules/esbuild/lib/main.js';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';
test('saved wallet ownership, fixed prices and concurrent purchase protection',async()=>{
 const dir=await mkdtemp(tmpdir()+'/reward-api-'),rows=new Map();let user='learner-a';const oldFetch=globalThis.fetch;
 globalThis.__rewardTest={env:{FAMILY_SERVER_KEY:'test',SUPABASE_URL:'https://db.test',SUPABASE_PUBLISHABLE_KEY:'public'},user:()=>user?{userId:user}:null};
 globalThis.fetch=async(url,options)=>{const b=JSON.parse(options.body);assert.match(String(url),/reward_bridge$/);if(b.op==='read')return Response.json(rows.get(b.who)||null);const prev=rows.get(b.who);if((prev?.revision||0)!==b.expected)return Response.json({message:'wallet_conflict'},{status:409});const next={data:b.payload,revision:b.expected+1};rows.set(b.who,JSON.parse(JSON.stringify(next)));return Response.json(next);};
 try{
 await build({entryPoints:['app/api/rewards/route.ts'],outfile:dir+'/api.mjs',bundle:true,format:'esm',platform:'node',logLevel:'silent',plugins:[{name:'test-env',setup(b){b.onResolve({filter:/^(cloudflare:workers)$|chatgpt-auth$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__rewardTest.env;':'export async function getChatGPTUser(){return globalThis.__rewardTest.user();}'}));}}]});
 const api=await import(pathToFileURL(dir+'/api.mjs'));
 const post=(body,extra={})=>api.POST(new Request('https://site.test/api/rewards',{method:'POST',headers:{origin:'https://site.test','content-type':'application/json',...extra},body:JSON.stringify(body)}));
 let r=await post({op:'load',owner:'someone-else',wallet:{earned:9999}});assert.equal((await r.json()).wallet.earned,0);
 const word=globalThis.DLPlayCore.WORDS[0].id;r=await post({op:'event',kind:'match',id:word,amount:10000});assert.equal((await r.json()).wallet.earned,2);r=await post({op:'event',kind:'match',id:word});assert.equal((await r.json()).wallet.earned,2);
 assert.equal((await post({op:'buy',id:'hat',price:0})).status,400);
 const row=rows.get('chatgpt:learner-a');row.data.earned=100;row.data.ageBand="18+";
 const both=await Promise.all([post({op:'buy',id:'hat',price:0}),post({op:'buy',id:'glasses'})]);assert.deepEqual(both.map(r=>r.status).sort(),[200,409]);
 r=await post({op:'load'});let w=(await r.json()).wallet;assert.equal(w.spent,40);assert.equal(w.owned.length,1);const owned=w.owned[0];r=await post({op:'buy',id:owned});assert.equal((await r.json()).wallet.spent,40);
 user='learner-b';r=await post({op:'load'});assert.equal((await r.json()).wallet.earned,0);
 user=null;assert.equal((await post({op:'load'})).status,401);assert.equal((await api.GET()).status,200);
 }finally{globalThis.fetch=oldFetch;delete globalThis.__rewardTest;await rm(dir,{recursive:true,force:true});}
});
