import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {validEvent,allowedRequest,isBot,isOwner,dashboard} from '../lib/usage.mjs';
test('only fixed aggregate categories and same-origin JSON are accepted',()=>{
 assert(validEvent('page_open'));assert(!validEvent('user@example.com'));assert(!validEvent('__proto__'));assert(!validEvent(null));
 const req=(origin,type)=>new Request('https://test.site/api/usage',{method:'POST',headers:{origin,'content-type':type}});
 assert(allowedRequest(req('https://test.site','application/json')));assert(!allowedRequest(req('https://other.site','application/json')));assert(!allowedRequest(req('https://test.site','text/plain')));
 assert(isBot(new Request('https://test.site',{headers:{'user-agent':'LinkedInBot'}})));assert(!isBot(new Request('https://test.site',{headers:{'user-agent':'Mozilla/5.0 Chrome'}})));
});
test('owner authorization is independent of browser-supplied metadata',()=>{
 assert(isOwner({email:'IFYTHRONIKS@GMAIL.COM'},'operator@example.invalid'));assert(!isOwner(null,'operator@example.invalid'));assert(!isOwner({email:'someone@example.com'},'operator@example.invalid'));assert(!isOwner({email:'someone@example.com'},''));
});
test('client deduplicates within a page and honours privacy signals',()=>{
 const source=fs.readFileSync('public/usage.js','utf8');
 function run(nav={},visibility='visible'){
  const calls=[],handlers={};const ctx={navigator:nav,document:{visibilityState:visibility,addEventListener:(event,fn)=>handlers[event]=fn},location:{hash:'#cards'},window:{addEventListener:(event,fn)=>handlers[event]=fn},fetch:(url,options)=>{calls.push({url,options});return Promise.resolve()}};
  vm.runInNewContext(source,ctx);return {ctx,calls,handlers};
 }
 const r=run();assert.equal(r.calls.length,2);r.ctx.window.LLAnalytics.track('page_open');r.ctx.window.LLAnalytics.track('learning_started');r.ctx.window.LLAnalytics.track('learning_started');assert.equal(r.calls.length,3);
 for(const call of r.calls){assert.equal(call.options.credentials,'omit');assert.deepEqual(Object.keys(JSON.parse(call.options.body)),['event']);}
 assert.equal(run({doNotTrack:'1'}).calls.length,0);assert.equal(run({globalPrivacyControl:true}).calls.length,0);
 const hidden=run({},'hidden');assert.equal(hidden.calls.length,0);hidden.ctx.document.visibilityState='visible';hidden.handlers.visibilitychange();assert.equal(hidden.calls.length,1);
 assert(!/localStorage|sessionStorage|document\.cookie|randomUUID|Math\.random/.test(source));
});
test('dashboard calculates periods and includes zero days without visitor records',()=>{
 const html=dashboard({today:'2026-11-05',rows:[{day:'2026-11-05',site:'deutsch-live',event:'page_open',hits:8},{day:'2026-11-05',site:'italian-live',event:'learning_started',hits:2}]});
 assert(html.includes('<strong>8</strong>'));assert(html.includes('<strong>2</strong>'));assert(html.includes('2026-10-07'));assert(html.includes('not unique people'));assert(!html.includes('USAGE_SERVER_KEY'));
});
