import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('public/learn.html','utf8');
const content=JSON.parse(fs.readFileSync('public/content.json','utf8'));
const dictionary=JSON.parse(fs.readFileSync('public/data/word-bridges.json','utf8'));
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const context={window:{}};
for(const script of scripts){new vm.Script(script);if(script.includes('window.DLGuides =')||script.includes('function expectedAnswer'))vm.runInNewContext(script,context);}
test('Italian content is independent and preserves complete dialogue structure',()=>{
 assert.equal(content.language,'it');assert.equal(content.packs.filter(p=>p.dialogue).length,26);
 const cards=content.packs.flatMap(p=>p.items);assert.equal(cards.length,4208);assert.equal(new Set(cards.map(i=>i.id)).size,cards.length);
 assert(cards.filter(i=>i.pos==='noun').length>2000);
 for(const p of content.packs.filter(p=>p.dialogue))for(const step of p.dialogue.steps){assert.equal(step.options.filter(o=>o.ok).length,1);for(const option of step.options)assert(option.ok||option.why);}
 assert.equal(cards.find(i=>i.de==='casa').art,'la');assert.equal(cards.find(i=>i.de==='libro').pl,'i libri');
});
test('Italian articles, apostrophes and accent distinctions are checked',()=>{
 const C=context.DLCore;
 assert.equal(C.expectedAnswer({de:'amico',art:"l'",pos:'noun'}),"l'amico");
 assert.equal(C.checkAnswer({de:'amico',art:"l'",pos:'noun'},'l’amico').result,'correct');
 assert.equal(C.checkAnswer({de:'casa',art:'la',pos:'noun'},'il casa').result,'article');
 assert.equal(C.checkAnswer({de:'casa',art:'la',pos:'noun'},'casa').result,'article');
 assert.notEqual(C.normalize('è'),C.normalize('e'));
});
test('4,000 distinct word bridges and 18 Italian article patterns',()=>{
 const g=context.window.DLGuides;assert.equal(g.rules.length,18);assert.equal(g.pairs.length+dictionary.length,4000);
 const words=g.pairs.concat(dictionary).map(r=>r[0].replace(/^(il |lo |la |l'|gli |le |i )/,''));assert.equal(new Set(words).size,4000);
 assert(html.includes('recognition.lang = "it-IT"'));assert(html.includes('/^it(-|_|$)/i'));assert(!html.includes('Ding 1.9'));assert(!html.includes('German voice'));
});
test('word bridge filters, pagination and failed-load retry',async()=>{
 const els=[];const ctx={window:context.window,fetch:async()=>({ok:true,json:async()=>dictionary})};
 ctx.h=(tag,props,...kids)=>{const el={tag,...props,kids:kids.flat(),value:tag==='select'?'all':'',addEventListener(k,f){this[k]=f},replaceChildren(...a){this.kids=a},append(...a){this.kids.push(...a)}};els.push(el);return el};ctx.guideExample=(...x)=>x;ctx.speakBtn=()=>null;ctx.guideSources=()=>null;
 vm.runInNewContext(html.slice(html.indexOf('  let bridgeRows ='),html.indexOf('  // ---------- TODAY ----------')),ctx);ctx.viewEnglish();await new Promise(r=>setTimeout(r,0));
 const result=els.find(x=>x.class==='guide-grid'),category=els.find(x=>x['aria-label']==='Word pair category'),search=els.find(x=>x.type==='search'),level=els.find(x=>x['aria-label']==='Suggested learning level'),pattern=els.find(x=>x['aria-label']==='Spelling pattern'),pager=els.find(x=>x['aria-label']==='Word pair pages');
 assert.equal(result.kids.length,48);assert(pager.kids[1].textContent.includes('4000'));pager.kids[2].onclick();assert(pager.kids[1].textContent.includes('Page 2'));
 category.value='false';category.change();assert.equal(result.kids.length,16);assert(level.disabled&&pattern.disabled);
 category.value='all';category.change();pattern.value='tion';pattern.change();assert(result.kids.length>0);search.value='zzzzzz';search.input();assert.equal(result.kids[0].class,'note');assert(pager.kids[2].disabled);
 const failing={...ctx,fetch:async()=>{throw Error('offline')}};vm.runInNewContext(html.slice(html.indexOf('  let bridgeRows ='),html.indexOf('  // ---------- TODAY ----------')),failing);failing.viewEnglish();await new Promise(r=>setTimeout(r,0));assert(els.some(x=>x.tag==='button'&&x.kids.includes('Retry')));
});
