/* Optional 16+ social world. DOM text nodes only; messages never enter innerHTML. */
window.DLWorldUI={create({h,getWallet,guest=false}){
 const root=h('section',{class:'world-zone stack'});let data=null,chat=null,messages=[],reasons=[],text='',friendCode='',clubCode='',busy=false,status='',reporting=null,reports=null;
 const button=(label,fn,extra={})=>h('button',{type:'button',class:'btn',disabled:busy,onclick:fn,...extra},label);
 const wallet=()=>DLRewardCore.normalize(getWallet());
 async function request(body){const headers=await window.DLAuth.familyHeaders();const r=await fetch('/api/world',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.error||'World unavailable.');return d;}
 async function run(body,kind='home'){if(busy)return;busy=true;status='Saving…';paint();try{const result=await request(body);if(kind==='chat'){messages=result.messages;reasons=result.reasons;reporting=null;if(body.op==='send')text='';}else if(kind==='moderation')reports=result.reports;else{data=result;chat=null;reports=null;}status=body.op==='report'?'Report sent to the operator. This message is hidden for you.':'Saved ✓';}catch(e){status=e.message;}finally{busy=false;paint();}}
 function openChat(room,title){chat={room,title};messages=[];text='';reporting=null;return run({op:'messages',room},'chat');}
 function field(label,value,update){return h('label',{class:'stack'},h('span',{},label),h('input',{type:'text',value,maxLength:32,autocomplete:'off',oninput:e=>update(e.target.value.trim())}));}
 function estate(w){return h('div',{class:'world-districts'},...['property','vehicle','outfit'].map(kind=>{const item=DLRewardCore.CATALOG.find(x=>x.id===w.wear[kind]);return h('article',{class:'panel world-district'},h('span',{class:'world-landmark','aria-hidden':'true'},item?.icon||({property:'🏕️',vehicle:'🚶',outfit:'👕'})[kind]),h('h3',{},item?.title||({property:'Starter camp',vehicle:'On foot',outfit:'Starter T-shirt'})[kind]),h('p',{},item?'Owned permanently · equip alternatives in My collection.':'Earn coins through learning, then upgrade in the shop.'));}));}
 function paint(){const w=wallet(),nodes=[h('p',{class:'eyebrow'},'LANGUAGE LIVE · WORLD 16+'),h('h2',{},'Your learning. Your city.'),estate(w),h('div',{class:'panel'},h('strong',{},'🪙 '+DLRewardCore.balance(w)+' coins · ⭐ '+w.stars),h('p',{},'Luxury prices double by tier. Earn at most 20 new coins per calendar day. No rent, debt, random prizes or coin transfers.'),h('p',{},'Voice and video calls: unavailable. No coin purchase can enable calling.'))];
 if(guest)nodes.push(h('p',{class:'note'},'Sign in to save your world and use friends or clubs. Guest collections are temporary.'));
 else if(!w.ageBand)nodes.push(h('p',{class:'note'},'Choose your age band at the top of Rewards before entering social spaces. Ages 16–17 and 18+ use separate spaces.'));
 else if(!data)nodes.push(button('Load social world',()=>run({op:'load'})));
 else if(!data.enrolled)nodes.push(h('div',{class:'panel stack'},h('h3',{},'Optional friends and clubs'),h('p',{},'Your account stays private. Invitations require acceptance; there is no public people directory. Your generated alias and messages are visible to accepted friends or club members. Messages are retained for up to 30 days; reports for up to 90 days. The operator can review reported content. Chat is not end-to-end encrypted.'),h('p',{},'Keep personal details out of messages. No links, phone numbers, attachments, voice or video. You can block, report, leave clubs or pause social features. Age bands are self-declared, not identity-verified.'),button('Join social world · I understand',()=>run({op:'enroll',confirm:true}))));
 else if(reports!==null){
  nodes.push(h('h3',{},'Operator moderation inbox'),button('Back to my world',()=>{reports=null;paint();}));
  if(!reports.length)nodes.push(h('p',{},'No open reports.'));
  for(const r of reports)nodes.push(h('article',{class:'panel stack'},h('b',{},r.alias||'Former member'),h('p',{},r.text||'Message expired'),h('p',{},r.reason),h('div',{class:'row'},...['hide','ban','dismiss'].map(action=>button(({hide:'Hide message',ban:'Suspend sender',dismiss:'Dismiss report'})[action],()=>run({op:'moderation',action,report:r.id},'moderation'))))));
 }
 else if(chat){nodes.push(h('div',{class:'row'},button('Back to world',()=>run({op:'load'})),button('Refresh conversation',()=>run({op:'messages',room:chat.room},'chat'))),h('h3',{},chat.title),h('p',{class:'small'},'Only invited participants can read this conversation. Report unsafe contact; block to stop contact. Messages expire after 30 days.'),h('div',{class:'world-messages',role:'log','aria-label':'Conversation'},...(messages.length?messages.map(m=>h('article',{class:'panel'},h('b',{},m.alias+(m.sender===data.me?' · you':'')),h('p',{class:'world-message-text'},m.text),h('p',{class:'small'},new Date(m.created_at).toLocaleString()),m.sender!==data.me?h('div',{class:'row'},button('Report',()=>{reporting=m.id;paint();}),button('Block member',()=>run({op:'block',person:m.sender}))):null,reporting===m.id?h('div',{class:'row'},...reasons.map(reason=>button(reason,()=>run({op:'report',room:chat.room,message:m.id,reason},'chat')))):null)):[h('p',{},'No messages yet. Say hello!')])),h('label',{class:'stack'},h('span',{},'Message · maximum 280 characters'),h('textarea',{rows:3,maxLength:280,value:text,oninput:e=>{text=e.target.value;},placeholder:'Practise your language together…'})),button('Send message',()=>run({op:'send',room:chat.room,text},'chat')));}
 else{
  const hasFriends=w.owned.includes('friends-pass'),hasClub=w.owned.includes('private-club-pass');
  nodes.push(h('div',{class:'panel stack'},h('h3',{},data.alias+' · '+data.ageBand),h('p',{},'Your private friend code · expires '+new Date(data.codeExpires).toLocaleDateString()),h('code',{class:'world-code'},data.code),h('p',{class:'small'},'Share only with people you choose. Requests still need your acceptance. Replacing the code cancels unused invitations.'),button('Replace invitation code',()=>run({op:'rotate-code'}))));
  const friendPanel=h('div',{class:'panel stack'},h('h3',{},'Friends'));
  const friendNodes=[];
  if(hasFriends)friendNodes.push(field('Friend’s invitation code',friendCode,v=>friendCode=v),button('Send friend request',()=>run({op:'friend-request',code:friendCode})));
  else friendNodes.push(h('p',{},'Unlock the Friends & chat pass for 160 coins in the shop. Both friends need a pass.'));
  for(const f of data.friends){
   const controls=[h('b',{},f.alias)];
   if(f.status==='accepted')controls.push(button('Chat',()=>openChat('friend:'+f.id,f.alias)));
   else if(f.incoming)controls.push(h('div',{class:'row'},button('Accept request',()=>run({op:'friend-response',friend:f.id,accept:true})),button('Decline',()=>run({op:'friend-response',friend:f.id,accept:false}))));
   else controls.push(h('p',{},'Awaiting acceptance'));
   controls.push(h('div',{class:'row'},button('Remove connection',()=>run({op:'remove-friend',friend:f.id})),button('Block',()=>run({op:'block',person:f.person}))));
   friendNodes.push(h('article',{class:'world-friend'},...controls));
  }
  friendPanel.replaceChildren(h('h3',{},'Friends'),...friendNodes);nodes.push(friendPanel);
  const clubNodes=[h('h3',{},'Clubs'),h('p',{},'Each age band has separate rooms. Private clubs are invitation-only, with up to 30 members.')];
  for(const item of DLRewardCore.CATALOG.filter(x=>x.kind==='club'))clubNodes.push(h('div',{class:'row'},h('b',{},item.icon+' '+item.title),w.owned.includes(item.id)?button('Join club',()=>run({op:'join-public',club:item.id})):h('span',{},item.price+' coins · unlock in shop')));
  clubNodes.push(hasClub?button('Create / open my private club',()=>run({op:'create-club'})):h('p',{},'Create one private club with a 2,560-coin Private clubhouse charter.'));
  if(hasFriends)clubNodes.push(field('Private club invitation code',clubCode,v=>clubCode=v),button('Accept club invitation',()=>run({op:'join-private',code:clubCode})));
  for(const r of data.rooms){
   const controls=[h('h4',{},r.title),button('Open conversation',()=>openChat(r.id,r.title))];
   if(r.owner===data.me)controls.push(h('p',{},'Invitation expires '+new Date(r.invite_expires).toLocaleDateString()),h('code',{class:'world-code'},r.invite),button('Replace club invitation',()=>run({op:'rotate-club',room:r.id})));
   if(r.owner===data.me)for(const member of r.members||[])if(member.id!==data.me)controls.push(h('div',{class:'row'},h('span',{},member.alias),button('Remove member',()=>run({op:'remove-member',room:r.id,person:member.id}))));
   if(r.owner!==data.me)controls.push(button('Leave club',()=>run({op:'leave-club',room:r.id})));
   clubNodes.push(h('article',{class:'panel stack'},...controls));
  }
  nodes.push(h('div',{class:'panel stack'},...clubNodes));
  const safety=[h('h3',{},'Privacy and safety'),h('p',{},'Pause social access at any time. Your learning and collection stay available.')];
  for(const b of data.blocks)safety.push(h('div',{class:'row'},h('span',{},b.alias||'Blocked member'),button('Unblock',()=>run({op:'unblock',person:b.id}))));
  safety.push(button('Pause my social features',()=>run({op:'disable'})));
  if(data.moderator)safety.push(button('Open moderation inbox',()=>run({op:'moderation'},'moderation')));
  nodes.push(h('div',{class:'panel stack'},...safety));
 }
 nodes.push(h('p',{role:'status','aria-live':'polite'},status));root.replaceChildren(...nodes.filter(Boolean));}
 paint();return root;
}};
