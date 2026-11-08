/* Aggregate counters only. No cookies, storage, visitor IDs or form contents. */
(() => {
 const seen=new Set();
 const optedOut=()=>navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true;
 function track(event){
  if(optedOut()||seen.has(event)||document.visibilityState!=='visible')return;
  seen.add(event);
  fetch('/api/usage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event}),credentials:'omit',referrerPolicy:'no-referrer',keepalive:true}).catch(()=>{});
 }
 window.LLAnalytics={track};
 const open=()=>track('page_open');
 if(document.visibilityState==='visible')open();
 else document.addEventListener('visibilitychange',open,{once:true});
 // Hashes identify app sections, never a user or a full URL.
 const section=()=>{const event={cards:'cards_open',talk:'talk_open',articles:'articles_open',english:'english_open'}[location.hash.slice(1)];if(event)track(event);};
 window.addEventListener('hashchange',section);section();
})();
