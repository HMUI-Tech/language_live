const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(supported=true) {
  const made=[]; const recognitions=[];
  function Recognition(){recognitions.push(this);this.start=()=>{};this.stop=()=>this.onend?.();this.abort=()=>{this.aborted=true;};}
  function h(tag,attrs,...children){const el={tag,...attrs,children,value:'',textContent:children.filter(c=>typeof c==='string').join(''),events:{},addEventListener(k,v){this.events[k]=v;},setAttribute(k,v){this[k]=v;}};made.push(el);return el;}
  const source=fs.readFileSync('legacy/app/src/app.js','utf8');
  const chunk=source.slice(source.indexOf('  let activeRecognition'),source.indexOf('  function renderDialog'));
  const context={window:{addEventListener(){},SpeechRecognition:supported?Recognition:undefined},h,tts:{ok:false}};
  vm.createContext(context);vm.runInContext(chunk+';this.api={spokenAnswer,stopListening,normalizeSpeech};',context);
  return {api:context.api,made,recognitions};
}
test('German transcript ignores case and punctuation without dropping umlauts',()=>{
 const {api}=setup();assert.equal(api.normalizeSpeech(' Ich heiße SAM! '),'ich heisse sam');assert.notEqual(api.normalizeSpeech('schon'),api.normalizeSpeech('schön'));
});
test('microphone requires a click; result needs explicit review and submit; navigation aborts',()=>{
 const {api,made,recognitions}=setup();let submitted=null;api.spokenAnswer(t=>submitted=t);
 const mic=made.find(x=>x['aria-pressed']); const submit=made.find(x=>x.textContent==='Check response');
 assert.equal(recognitions.length,0);mic.events.click();const r=recognitions[0];assert.equal(r.lang,'de-DE');
 r.onresult({results:[[{transcript:'Ich heiße Sam.'}]]});assert.equal(submitted,null);assert.equal(submit.disabled,true);
 r.onend();assert.equal(submit.disabled,false);submit.onclick();assert.equal(submitted,'Ich heiße Sam.');
 mic.events.click();api.stopListening();assert.equal(recognitions[1].aborted,true);assert.equal(recognitions[1].onresult,null);
});
test('denied microphone and unsupported browsers retain typing fallback',()=>{
 const a=setup();a.api.spokenAnswer(()=>{});a.made.find(x=>x['aria-pressed']).events.click();a.recognitions[0].onerror({error:'not-allowed'});a.recognitions[0].onend();assert.match(a.made.find(x=>x.role==='status').textContent,/denied/);
 const b=setup(false);b.api.spokenAnswer(()=>{});assert.equal(b.made.find(x=>x['aria-pressed']).disabled,true);const input=b.made.find(x=>x.tag==='textarea');input.value='Hallo';input.events.input();assert.equal(b.made.find(x=>x.textContent==='Check response').disabled,false);
});
