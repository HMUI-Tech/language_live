/* Closed learning rewards. Shared deterministic rules; saved wallets are owned by the server. */
(function(root){
const CATALOG=[
{id:'hat',title:'Explorer hat',icon:'🎩',price:30,kind:'hat',description:'A permanent explorer hat for your learning companion.'},
{id:'glasses',title:'Curious glasses',icon:'👓',price:30,kind:'glasses',description:'Glasses for your companion. Wear them whenever you like.'},
{id:'scarf',title:'Adventure scarf',icon:'🧣',price:60,kind:'scarf',description:'A bright scarf for your companion.'},
{id:'garden',title:'Garden background',icon:'🌳',price:50,kind:'room',description:'A peaceful garden for your companion.'},
{id:'reading-room',title:'Cosy reading room',icon:'📚',price:100,kind:'room',description:'A reading corner with books and a warm lamp.'},
{id:'ocean',title:'Ocean theme',icon:'🌊',price:75,kind:'theme',description:'A blue colour theme for the app and reading background.'},
{id:'plum',title:'Berry theme',icon:'🫐',price:75,kind:'theme',description:'A purple colour theme for the app and reading background.'},
{id:'bonus',title:'Three bonus stories',icon:'📖',price:100,kind:'content',description:'Three new short mysteries with questions, explanations and vocabulary help.'},
{id:'branch',title:'Choose your adventure',icon:'🧭',price:50,kind:'content',description:'Explore a park story with different paths and endings. Replay every choice.'},
{id:'print',title:'Printable activity studio',icon:'🖨️',price:150,kind:'content',description:'Unlimited word-search, matching and article worksheets, with answer sheets. Print or save as PDF.'},
{id:'personal',title:'My practice workshop',icon:'🛠️',price:200,kind:'content',description:'Unlimited practice packs based on words you missed. If none are recorded, discover unpractised words.'},
{id:'journey',title:'Seven-stage travel adventure',icon:'🗺️',price:250,kind:'content',description:'Seven connected travel chapters with questions. Play at your own pace; no daily deadlines.'}
];
const empty=()=>({v:1,earned:0,spent:0,owned:[],wear:{},reading:{},match:[],articles:[],recall:[],reviews:[],weak:{},lastDay:'',history:[]});
function normalize(raw){const w=empty();if(!raw||typeof raw!=='object')return w;w.earned=Number.isSafeInteger(raw.earned)&&raw.earned>=0?raw.earned:0;w.spent=Number.isSafeInteger(raw.spent)&&raw.spent>=0&&raw.spent<=w.earned?raw.spent:0;w.owned=[...new Set((Array.isArray(raw.owned)?raw.owned:[]).filter(id=>CATALOG.some(x=>x.id===id)))];for(const slot of ['hat','glasses','scarf','room','theme'])if(CATALOG.some(x=>x.id===raw.wear?.[slot]&&x.kind===slot)&&w.owned.includes(raw.wear[slot]))w.wear[slot]=raw.wear[slot];for(const k of ['match','articles','recall'])w[k]=[...new Set((Array.isArray(raw[k])?raw[k]:[]).filter(x=>typeof x==='string'&&/^[a-z0-9._-]{1,80}$/i.test(x)))].slice(0,100);for(const [id,v]of Object.entries(raw.reading||{}))if(/^[a-z0-9._-]{1,80}$/i.test(id)&&Number.isInteger(v)&&v>=0&&v<=3)w.reading[id]=v;for(const[id,v]of Object.entries(raw.weak||{}))if(/^[a-z0-9._-]{1,80}$/i.test(id)&&Number.isInteger(v)&&v>0)w.weak[id]=Math.min(v,99);w.reviews=Array.isArray(raw.reviews)?[...new Set(raw.reviews.filter(n=>typeof n==='string'&&/^[a-f0-9]{16}$/.test(n)))].slice(0,10000):[];w.lastDay=typeof raw.lastDay==='string'?raw.lastDay:'';w.history=Array.isArray(raw.history)?raw.history.slice(-50):[];return w;}
const reviewKey=id=>{let a=2166136261,b=2246822507;for(const ch of id){a=Math.imul(a^ch.charCodeAt(0),16777619)>>>0;b=Math.imul(b^ch.charCodeAt(0),3266489909)>>>0;}return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');};
const balance=w=>Math.max(0,w.earned-w.spent);
function apply(raw,event,{day,words,stories,cardIds=[],kids=false}){
 const w=normalize(raw);let amount=0,note='',eligible=false;
 if(event.op==='buy'){
 const item=CATALOG.find(x=>x.id===event.id);if(!item)throw Error('Unknown reward.');if(w.owned.includes(item.id))return w;if(balance(w)<item.price)throw Error('Not enough coins yet. Keep learning; your coins do not expire.');w.owned.push(item.id);w.spent+=item.price;note='Unlocked '+item.title;amount=-item.price;if(item.kind!=='content')w.wear[item.kind]=item.id;
 }else if(event.op==='equip'){
 if(!['hat','glasses','scarf','room','theme'].includes(event.slot))throw Error('Unknown accessory slot.');if(event.id===null)delete w.wear[event.slot];else{const item=CATALOG.find(x=>x.id===event.id);if(!item||item.kind!==event.slot||!w.owned.includes(item.id))throw Error('Unlock this reward first.');w.wear[event.slot]=item.id;}return w;
 }else if(event.op==='event'){
 if(event.kind==='review'){const index=cardIds.includes(event.id)?reviewKey(event.id):null;if(kids||index===null)throw Error('Unknown review activity.');if(!w.reviews.includes(index)){w.reviews.push(index);amount=1;}eligible=true;note='First successful flashcard review';
 }else if(event.kind==='reading'){
 const s=stories.find(s=>s.id===event.id);if(!s||(kids&&!s.kids))throw Error('Unknown reading activity.');if(s.reward&&!w.owned.includes(s.reward))throw Error('Unlock this story collection first.');if(s.stage>1&&!(w.reading['journey-'+(s.stage-1)]>0))throw Error('Complete the previous stage first.');if(!Array.isArray(event.answers)||event.answers.length!==s.questions.length||event.answers.some((a,i)=>!Number.isInteger(a)||a<0||a>=s.questions[i].options.length))throw Error('Complete all questions first.');const score=s.questions.filter((q,i)=>q.answer===event.answers[i]).length;eligible=score>0;const previous=w.reading[s.id];if(previous===undefined)amount=score>0?10:0;else if(score>previous)amount=previous===0?10:2*(score-previous);w.reading[s.id]=Math.max(previous||0,score);note='Story practice';
 }else{
 const word=words.find(x=>x.id===event.id);if(!word||!['match','articles','recall','mistake'].includes(event.kind))throw Error('Unknown word activity.');if(event.kind==='mistake'){w.weak[word.id]=Math.min(99,(w.weak[word.id]||0)+1);return w;}if(!w[event.kind].includes(word.id)){w[event.kind].push(word.id);amount=2;}if(w.weak[word.id]){w.weak[word.id]--;if(!w.weak[word.id])delete w.weak[word.id];}note='Word practice';eligible=true;
 }
 if(eligible&&w.lastDay!==day){amount+=3;w.lastDay=day;note+=' + first practice of the day';}
 w.earned+=amount;
 }else throw Error('Unknown reward action.');
 if(amount)w.history.push({day,amount,note,id:event.id});w.history=w.history.slice(-50);return w;
}
root.DLRewardCore={CATALOG,empty,normalize,balance,reviewKey,apply};
})(globalThis);
