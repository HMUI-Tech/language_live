import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from '../standalone/node_modules/esbuild/lib/main.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {validPin,profileSettings,pinHash,digest} from '../lib/family.mjs';
test('PINs, nicknames and session settings are validated',async()=>{
 for(const p of ['123456','111111','short','12345','9876543212345'])assert.equal(validPin(p),false);
 assert.equal(validPin('735921'),true);
 assert.throws(()=>profileSettings({name:'<script>',minutes:10,avatar:'🦊'}));
 assert.throws(()=>profileSettings({name:'Fox',minutes:100,avatar:'🦊'}));
 assert.equal(profileSettings({name:'Fox',minutes:5,avatar:'🦊'}).name,'Fox');
 assert.notEqual(await pinHash('735921','a'),await pinHash('735921','b'));
});
test('parent ownership, PIN lockout, scoped child access and revocation',async()=>{
 const dir=await mkdtemp(tmpdir()+'/family-test-'),rows=new Map();let parent='parent-a';
 globalThis.__familyTest={env:{FAMILY_SERVER_KEY:'test',SUPABASE_URL:'https://db.test',SUPABASE_PUBLISHABLE_KEY:'public'},user:()=>parent?{userId:parent}:null};
 const fetchBefore=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{assert.match(String(url),/german_family_bridge/);const b=JSON.parse(opts.body);let r;
 if(b.op==='read')r=rows.get(b.who);
 if(b.op==='child')r=[...rows.values()].find(x=>x.data.profiles.some(p=>p.token===b.who&&p.expires>Date.now()));
 if(b.op==='write'){const old=rows.get(b.who);if((old?.revision||0)!==b.expected)return Response.json({message:'family_conflict'},{status:409});r={owner:b.who,data:b.payload,revision:b.expected+1};rows.set(b.who,r);}
 return Response.json(r||null);};
 try{
 for(const name of ['family','kids'])await build({entryPoints:[`app/api/${name}/route.ts`],outfile:`${dir}/${name}.mjs`,bundle:true,format:'esm',platform:'node',plugins:[{name:'test-bindings',setup(b){b.onResolve({filter:/^(cloudflare:workers)$|chatgpt-auth$/},a=>({path:a.path,namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},a=>({contents:a.path==='cloudflare:workers'?'export const env=globalThis.__familyTest.env;':'export async function getChatGPTUser(){return globalThis.__familyTest.user();}'}));}}]});
 const family=await import(pathToFileURL(dir+'/family.mjs')),kids=await import(pathToFileURL(dir+'/kids.mjs'));
 const req=(body,cookie)=>new Request('https://site.test/api/family',{method:'POST',headers:{origin:'https://site.test','content-type':'application/json',...(cookie?{cookie}: {})},body:JSON.stringify(body)});
 const post=(body)=>family.POST(req({pin:'735921',...body}));
 assert.equal((await post({action:'setup',consent:false})).status,400);
 assert.equal((await post({action:'setup',consent:true})).status,200);
 let r=await post({action:'create',consent:true,name:'Fox',avatar:'🦊',minutes:5}),p=(await r.json()).profiles[0];
 parent='parent-b';assert.deepEqual(await(await post({action:'status'})).json(),{setup:false});
 parent='parent-a';
 for(let i=0;i<5;i++)assert.equal((await post({action:'list',pin:'999999'})).status,403);
 assert.equal((await post({action:'list'})).status,429);
 rows.get('chatgpt:parent-a').data.lockedUntil=0;
 r=await post({action:'start',id:p.id});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];
 const child=await kids.GET(new Request('https://site.test/api/kids',{headers:{cookie}}));assert.equal(child.status,200);const c=await child.json();assert.equal(c.profile.id,p.id);assert.equal(c.profile.token,undefined);assert.equal(c.profiles,undefined);
 assert.equal((await kids.GET(new Request('https://site.test/api/kids'))).status,401);
 assert.equal((await kids.POST(req({action:'create',name:'Hacked'},cookie))).status,400);
 assert.equal((await kids.POST(req({action:'match',id:'hund'},cookie))).status,200);
 assert.equal(rows.get('chatgpt:parent-a').data.profiles[0].play.matches.length,1);
 rows.get('chatgpt:parent-a').data.profiles[0].wallet.earned=100;
 let purchase=await kids.POST(req({action:'reward',event:{op:'buy',id:'hat',price:0}},cookie));assert.equal(purchase.status,200);assert.equal((await purchase.json()).wallet.spent,30);
 purchase=await kids.POST(req({action:'reward',event:{op:'buy',id:'hat'}},cookie));assert.equal((await purchase.json()).wallet.spent,30);
 assert.equal((await post({action:'edit',id:p.id,name:'Fox',avatar:'🦊',minutes:5,rewardsDisabled:true})).status,200);
 const session2=await post({action:'start',id:p.id});const cookie2=session2.headers.get('set-cookie').split(';')[0];
 assert.equal((await kids.POST(req({action:'reward',event:{op:'buy',id:'glasses'}},cookie2))).status,403);

 assert.equal((await post({action:'edit',id:p.id,name:'Fox',avatar:'🦊',minutes:5,paused:true})).status,200);
 assert.equal((await kids.GET(new Request('https://site.test/api/kids',{headers:{cookie}}))).status,401);
 parent=null;assert.equal((await post({action:'list'})).status,401);
 }finally{globalThis.fetch=fetchBefore;delete globalThis.__familyTest;await rm(dir,{recursive:true,force:true});}
});
