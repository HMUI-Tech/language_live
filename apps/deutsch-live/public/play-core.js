/* Original Deutsch Live game content and deterministic progress rules. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DLPlayCore=api;})(globalThis,function(){
'use strict';
const WORDS=[
['hund','der','Hund','dog','🐕'],['katze','die','Katze','cat','🐈'],['haus','das','Haus','house','🏠'],
['baum','der','Baum','tree','🌳'],['blume','die','Blume','flower','🌼'],['buch','das','Buch','book','📖'],
['apfel','der','Apfel','apple','🍎'],['banane','die','Banane','banana','🍌'],['brot','das','Brot','bread','🍞'],
['tisch','der','Tisch','table','🪑'],['lampe','die','Lampe','lamp','💡'],['bett','das','Bett','bed','🛏️'],
['stuhl','der','Stuhl','chair','🪑'],['tuer','die','Tür','door','🚪'],['fenster','das','Fenster','window','🪟'],
['ball','der','Ball','ball','⚽'],['uhr','die','Uhr','clock','🕒'],['fahrrad','das','Fahrrad','bicycle','🚲'],
['fisch','der','Fisch','fish','🐟'],['sonne','die','Sonne','sun','☀️'],['auto','das','Auto','car','🚗'],
['vogel','der','Vogel','bird','🐦'],['wolke','die','Wolke','cloud','☁️'],['kind','das','Kind','child','🧒'],
['zug','der','Zug','train','🚆'],['tasche','die','Tasche','bag','👜'],['ei','das','Ei','egg','🥚'],
['mond','der','Mond','moon','🌙'],['schule','die','Schule','school','🏫'],['wasser','das','Wasser','water','💧'],
['stern','der','Stern','star','⭐'],['strasse','die','Straße','street','🛣️'],['telefon','das','Telefon','telephone','☎️'],
['garten','der','Garten','garden','🌱'],['flasche','die','Flasche','bottle','🍶'],['bild','das','Bild','picture','🖼️']
].map(([id,article,word,en,emoji])=>({id,article,word,en,emoji}));
const BADGES=[
{id:'first',title:'Erste Schritte',en:'First Steps',emoji:'🌱',description:'Get your first game answer right.',resource:'word-cards.pdf',reward:'Everyday word cards'},
{id:'words',title:'Wortentdecker',en:'Word Explorer',emoji:'🧭',description:'Match 12 different words.',resource:'word-missions.pdf',reward:'Word missions activity pack'},
{id:'articles',title:'Artikel-Detektiv',en:'Article Detective',emoji:'🔎',description:'Choose the article for 12 different words.',resource:'article-workbook.pdf',reward:'Article workbook + answers'},
{id:'quest',title:'Tagesheld',en:'Daily Quest Hero',emoji:'🏅',description:'Finish all three daily quests on one day.',resource:'dialogue-cards.pdf',reward:'Family & friend dialogue cards'},
{id:'days',title:'Immer neugierig',en:'Always Curious',emoji:'🌟',description:'Practise on three different days. They need not be consecutive.',resource:'mini-story.pdf',reward:'Illustration-ready mini-story + activities'}
];
const ids=new Set(WORDS.map(w=>w.id));
const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const reviews=value=>Array.isArray(value)?[...new Set(value.filter(id=>typeof id==='string'&&/^[a-z0-9._-]{1,80}$/i.test(id)))].slice(0,5):[];
const unique=value=>Array.isArray(value)?[...new Set(value.filter(id=>typeof id==='string'&&ids.has(id)))]:[];
function empty(){return{v:1,matches:[],articles:[],days:{},earned:{}};}
function sanitize(raw,today){
 const p=empty();if(!raw||typeof raw!=='object')return p;
 p.matches=unique(raw.matches);p.articles=unique(raw.articles);
 const cutoff=new Date(Date.parse(today+'T12:00:00Z')-89*86400000).toISOString().slice(0,10);
 for(const [day,value] of Object.entries(raw.days||{})){if(validDay(day)&&day<=today&&day>=cutoff&&value&&typeof value==='object')p.days[day]={matches:unique(value.matches),articles:unique(value.articles),reviewIds:reviews(value.reviewIds)};}
 for(const b of BADGES){const date=raw.earned?.[b.id];if(validDay(date)&&date<=today)p.earned[b.id]=date;}
 return p;
}
function quests(progress,today,log={}){
 const p=sanitize(progress,today),d=p.days[today]||{matches:[],articles:[]};const reviewed=(d.reviewIds||[]).length,dialogs=Math.max(0,Number(log[today]?.dialogs)||0);
 return[{id:'match',title:'Match three words',value:Math.min(3,d.matches.length),target:3,mode:'match'},
 {id:'articles',title:'Find three articles',value:Math.min(3,d.articles.length),target:3,mode:'articles'},
 {id:'lesson',title:'Recall five different cards or finish one dialogue',value:dialogs>0?5:Math.min(5,reviewed),target:5,mode:'lesson'}];
}
function award(raw,today,log={}){
 const p=sanitize(raw,today);const earn=id=>{if(!p.earned[id])p.earned[id]=today;};
 if(p.matches.length+p.articles.length>0)earn('first');
 if(p.matches.length>=12)earn('words');if(p.articles.length>=12)earn('articles');
 if(quests(p,today,log).every(q=>q.value>=q.target))earn('quest');
 const active=new Set(Object.entries(p.days).filter(([,d])=>d.matches.length+d.articles.length>0).map(([d])=>d));
 for(const [day,d]of Object.entries(log||{}))if(validDay(day)&&day<=today&&((Number(d.reviews)||0)+(Number(d.dialogs)||0)>0))active.add(day);
 if(active.size>=3)earn('days');return p;
}
function record(raw,today,mode,id,log={}){
 const p=sanitize(raw,today);if(!['match','articles'].includes(mode)||!ids.has(id))return award(p,today,log);
 const key=mode==='match'?'matches':'articles';if(!p[key].includes(id))p[key].push(id);
 const d=p.days[today]||(p.days[today]={matches:[],articles:[]});if(!d[key].includes(id))d[key].push(id);
 return award(p,today,log);
}
function recordReview(raw,today,id,correct,log={}){
 const p=sanitize(raw,today);if(correct&&typeof id==='string'&&/^[a-z0-9._-]{1,80}$/i.test(id)){
 const d=p.days[today]||(p.days[today]={matches:[],articles:[],reviewIds:[]});d.reviewIds=d.reviewIds||[];if(d.reviewIds.length<5&&!d.reviewIds.includes(id))d.reviewIds.push(id);
 }return award(p,today,log);
}
function shuffled(list,seed){let n=2166136261;for(const c of String(seed))n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;const out=[...list];for(let i=out.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
function round(seed){return shuffled(WORDS,seed).slice(0,6);}
return{WORDS,BADGES,empty,sanitize,quests,award,record,recordReview,shuffled,round};
});
