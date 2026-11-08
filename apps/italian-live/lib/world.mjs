// Server-only social service. Wallet entitlements are loaded from the verified account.
export const WORLD_TEXT_LIMIT=280;
const AGE_BANDS=['16-17','18+'];
const CLUBS=['cafe-club','travel-club','book-club','world-club'];
const REASONS=['Harassment','Unsafe contact','Spam','Other'];
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
export function cleanMessage(value){
 if(typeof value!=='string')fail('Write a message first.');
 const text=value.trim();if(!text||text.length>WORLD_TEXT_LIMIT||/[\x00-\x08\x0b-\x1f<>]/.test(text))fail('Use 1–280 characters of plain text.');
 if(/https?:|www\.|\S+@\S+\.\S+|(?:\+?\d[\s().-]*){8,}/i.test(text))fail('Keep links, email addresses and phone numbers out of chat.');
 return text;
}
const pair=(a,b)=>[a,b].sort().join(':');
export async function worldAction({db,id,wallet,body,C,token,now=Date.now(),moderator=false}){
 const one=(sql,...args)=>db.prepare(sql).bind(...args).first();
 const all=async(sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
 const run=(sql,...args)=>db.prepare(sql).bind(...args).run();
 const op=body.op||'load';
 if(op==='moderation'){
  if(!moderator)fail('Operator access only.',403);
  if(body.action){if(!['hide','ban','dismiss'].includes(body.action))fail('Unknown moderation action.');
   const report=await one('SELECT r.*,m.sender FROM world_reports r LEFT JOIN world_messages m ON m.id=r.message WHERE r.id=?',body.report);
   if(!report)fail('Report not found.',404);
   const statements=[];
   if(body.action==='hide')statements.push(db.prepare('UPDATE world_messages SET hidden=1 WHERE id=?').bind(report.message));
   if(body.action==='ban'&&report.sender){statements.push(db.prepare('INSERT OR IGNORE INTO world_bans(id,created_at) VALUES(?,?)').bind(report.sender,now));statements.push(db.prepare('UPDATE world_messages SET hidden=1 WHERE sender=?').bind(report.sender));}
   statements.push(db.prepare('UPDATE world_reports SET resolved=1 WHERE id=?').bind(report.id));await db.batch(statements);
  }
  return {reports:await all('SELECT r.id,r.reason,r.created_at,m.text,p.alias FROM world_reports r LEFT JOIN world_messages m ON r.message=m.id LEFT JOIN world_people p ON m.sender=p.id WHERE r.resolved=0 ORDER BY r.created_at LIMIT 100')};
 }
 if(!AGE_BANDS.includes(wallet.ageBand))fail('Confirm your age band in Rewards first. This world is for ages 16+.',403);
 if(await one('SELECT id FROM world_bans WHERE id=?',id))fail('Social access is suspended. Contact the operator through the Impressum to appeal.',403);
 let person=await one('SELECT * FROM world_people WHERE id=?',id);
 if(op==='enroll'){
  if(body.confirm!==true)fail('Confirm the social privacy notice first.');
  if(!person)await run('INSERT INTO world_people(id,age_band,alias,invite,invite_expires,enabled,created_at) VALUES(?,?,?,?,?,1,?)',id,wallet.ageBand,'Learner '+id.slice(0,8),token(),now+7*86400000,now);
  else await run('UPDATE world_people SET enabled=1 WHERE id=?',id);
  person=await one('SELECT * FROM world_people WHERE id=?',id);
 }
 if(!person)return {enrolled:false,moderator};
 if(person.age_band!==wallet.ageBand)fail('Your age band changed. Contact the operator to update social access.',403);
 if(op==='disable'){await run('UPDATE world_people SET enabled=0 WHERE id=?',id);return {enrolled:false,moderator};}
 if(!person.enabled&&op!=='load')fail('Social features are paused. Join again to continue.',403);
 if(!person.enabled)return {enrolled:false,moderator};
 await db.batch([db.prepare('DELETE FROM world_messages WHERE created_at<?').bind(now-30*86400000),db.prepare('DELETE FROM world_reports WHERE created_at<?').bind(now-90*86400000)]);
 const owns=item=>wallet.owned.includes(item);
 const blocked=async other=>!!await one('SELECT id FROM world_blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)',id,other,other,id);
 const peer=async other=>{const p=await one('SELECT * FROM world_people WHERE id=? AND enabled=1',other);if(!p||p.age_band!==person.age_band||await blocked(other)||await one('SELECT id FROM world_bans WHERE id=?',other))fail('This connection is unavailable.',403);return p;};
 const access=async room=>{
  if(typeof room!=='string'||room.length>180)fail('Choose a conversation.');
  if(room.startsWith('friend:')){
   if(!owns('friends-pass'))fail('Unlock the Friends & chat pass first.',403);
   const f=await one('SELECT * FROM world_friends WHERE id=? AND status=?',room.slice(7),'accepted');if(!f||![f.a,f.b].includes(id))fail('Accept this friendship first.',403);await peer(f.a===id?f.b:f.a);return;
  }
  const r=await one('SELECT * FROM world_rooms WHERE id=?',room);
  if(!r||r.age_band!==person.age_band||!await one('SELECT id FROM world_members WHERE room=? AND person=?',room,id))fail('Join this club first.',403);
  if(r.owner){if(!owns('friends-pass')&&!owns('private-club-pass'))fail('Unlock a social pass first.',403);if(r.owner!==id)await peer(r.owner);}
  else if(!owns(room.split(':')[1]))fail('Unlock this club membership first.',403);
 };
 if(op==='rotate-code')await run('UPDATE world_people SET invite=?,invite_expires=? WHERE id=?',token(),now+7*86400000,id);
 else if(op==='friend-request'){
  if(!owns('friends-pass'))fail('Unlock the Friends & chat pass first.',403);
  const p=await one('SELECT * FROM world_people WHERE invite=? AND invite_expires>? AND enabled=1',String(body.code||''),now);
  if(!p||p.id===id)fail('Invitation unavailable or expired.');await peer(p.id);
  if(!p.enabled)fail('Invitation unavailable.');
  if((await one('SELECT count(*) AS n FROM world_friends WHERE requester=? AND created_at>?',id,now-86400000)).n>=10)fail('You can send up to 10 friend requests per day.',429);
  await run('INSERT OR IGNORE INTO world_friends(id,a,b,requester,status,created_at) VALUES(?,?,?,?,?,?)',pair(id,p.id),...[id,p.id].sort(),id,'pending',now);
 }else if(op==='friend-response'){
  const f=await one('SELECT * FROM world_friends WHERE id=?',body.friend);
  if(!f||![f.a,f.b].includes(id)||f.requester===id||f.status!=='pending')fail('This request is unavailable.',403);
  if(body.accept){if(!owns('friends-pass'))fail('Unlock the Friends & chat pass first.',403);await peer(f.requester);await run('UPDATE world_friends SET status=? WHERE id=?','accepted',f.id);}
  else await run('DELETE FROM world_friends WHERE id=?',f.id);
 }else if(op==='remove-friend'){
  await run('DELETE FROM world_friends WHERE id=? AND (a=? OR b=?)',body.friend,id,id);
 }else if(op==='block'){
  if(typeof body.person!=='string'||!/^[a-f0-9]{64}$/.test(body.person)||body.person===id)fail('Choose another member.');
  await run('INSERT OR IGNORE INTO world_blocks(id,blocker,blocked) VALUES(?,?,?)',pair(id,body.person)+':'+id,id,body.person);
 }else if(op==='unblock')await run('DELETE FROM world_blocks WHERE blocker=? AND blocked=?',id,body.person);
 else if(op==='join-public'){
  if(!CLUBS.includes(body.club)||!owns(body.club))fail('Unlock this membership in Rewards first.',403);
  const room='club:'+body.club+':'+person.age_band;
  await db.batch([db.prepare('INSERT OR IGNORE INTO world_rooms(id,age_band,title) VALUES(?,?,?)').bind(room,person.age_band,C.CATALOG.find(x=>x.id===body.club).title),db.prepare('INSERT OR IGNORE INTO world_members(id,room,person) VALUES(?,?,?)').bind(room+':'+id,room,id)]);
 }else if(op==='create-club'){
  if(!owns('private-club-pass'))fail('Unlock the Private clubhouse charter first.',403);
  const room='private:'+id;
  await db.batch([db.prepare('INSERT OR IGNORE INTO world_rooms(id,owner,age_band,title,invite,invite_expires) VALUES(?,?,?,?,?,?)').bind(room,id,person.age_band,person.alias+'’s clubhouse',token(),now+7*86400000),db.prepare('INSERT OR IGNORE INTO world_members(id,room,person) VALUES(?,?,?)').bind(room+':'+id,room,id)]);
 }else if(op==='join-private'){
  if(!owns('friends-pass'))fail('Unlock the Friends & chat pass first.',403);
  const r=await one('SELECT * FROM world_rooms WHERE invite=? AND invite_expires>?',String(body.code||''),now);
  if(!r||r.age_band!==person.age_band)fail('Invitation unavailable or expired.');await peer(r.owner);
  await run('INSERT OR IGNORE INTO world_members(id,room,person) SELECT ?,?,? WHERE (SELECT count(*) FROM world_members WHERE room=?)<30',r.id+':'+id,r.id,id,r.id);
  if(!await one('SELECT id FROM world_members WHERE room=? AND person=?',r.id,id))fail('This club has reached its 30-member limit.');
 }else if(op==='rotate-club'||op==='remove-member'){
  const r=await one('SELECT * FROM world_rooms WHERE id=? AND owner=?',body.room,id);if(!r)fail('Club owner access only.',403);
  if(op==='rotate-club')await run('UPDATE world_rooms SET invite=?,invite_expires=? WHERE id=?',token(),now+7*86400000,r.id);
  else {if(body.person===id)fail('You cannot remove yourself as owner.');await db.batch([db.prepare('DELETE FROM world_members WHERE room=? AND person=?').bind(r.id,body.person),db.prepare('UPDATE world_rooms SET invite=?,invite_expires=? WHERE id=?').bind(token(),now+7*86400000,r.id)]);}
 }else if(op==='leave-club'){
  const r=await one('SELECT * FROM world_rooms WHERE id=?',body.room);if(r?.owner===id)fail('Pause social features to leave your own clubhouse.');
  await run('DELETE FROM world_members WHERE room=? AND person=?',body.room,id);
 }else if(op==='messages'||op==='send'||op==='report'){
  await access(body.room);
  if(op==='send'){
   const text=cleanMessage(body.text),mid=token();
   const result=await run('INSERT INTO world_messages(id,room,sender,text,created_at) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM world_messages WHERE sender=? AND created_at>?) AND (SELECT count(*) FROM world_messages WHERE sender=? AND created_at>?)<100',mid,body.room,id,text,now,id,now-5000,id,now-86400000);
   if(!result.meta.changes)fail('Please wait 5 seconds between messages. The limit is 100 messages per day.',429);
  }
  if(op==='report'){
   if(!REASONS.includes(body.reason))fail('Choose a report reason.');
   const m=await one('SELECT * FROM world_messages WHERE id=? AND room=? AND created_at>?',body.message,body.room,now-30*86400000);if(!m)fail('Message unavailable.',404);
   await run('INSERT OR IGNORE INTO world_reports(id,message,reporter,reason,created_at) VALUES(?,?,?,?,?)',m.id+':'+id,m.id,id,body.reason,now);
  }
  const messages=await all('SELECT m.id,m.sender,m.text,m.created_at,p.alias FROM world_messages m JOIN world_people p ON p.id=m.sender WHERE m.room=? AND m.hidden=0 AND m.created_at>? AND NOT EXISTS(SELECT 1 FROM world_blocks b WHERE (b.blocker=? AND b.blocked=m.sender) OR (b.blocked=? AND b.blocker=m.sender)) AND NOT EXISTS(SELECT 1 FROM world_reports r WHERE r.message=m.id AND r.reporter=?) AND NOT EXISTS(SELECT 1 FROM world_bans b WHERE b.id=m.sender) ORDER BY m.created_at DESC LIMIT 100',body.room,now-30*86400000,id,id,id);
  return {messages:messages.reverse(),reasons:REASONS,me:id};
 }else if(!['load','enroll','disable','rotate-code','moderation'].includes(op))fail('Unknown world action.');
 // Bounded retention; request-time deletion is maintenance, never schema mutation.

 const friends=await all('SELECT f.*,p.alias,p.id AS person FROM world_friends f JOIN world_people p ON p.id=CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE (f.a=? OR f.b=?) AND p.enabled=1 AND p.age_band=? AND NOT EXISTS(SELECT 1 FROM world_blocks b WHERE (b.blocker=? AND b.blocked=p.id) OR (b.blocked=? AND b.blocker=p.id)) AND NOT EXISTS(SELECT 1 FROM world_bans b WHERE b.id=p.id) ORDER BY f.created_at DESC LIMIT 100',id,id,id,person.age_band,id,id);
 const rooms=await all('SELECT r.id,r.title,r.owner,CASE WHEN r.owner=? THEN r.invite ELSE NULL END AS invite,CASE WHEN r.owner=? THEN r.invite_expires ELSE NULL END AS invite_expires FROM world_rooms r JOIN world_members m ON m.room=r.id WHERE m.person=? AND r.age_band=? LIMIT 100',id,id,id,person.age_band);
 for(const room of rooms)if(room.owner===id)room.members=await all('SELECT p.id,p.alias FROM world_members m JOIN world_people p ON p.id=m.person WHERE m.room=? LIMIT 30',room.id);
 return {enrolled:true,me:id,ageBand:person.age_band,alias:person.alias,code:person.invite,codeExpires:person.invite_expires,friends:friends.map(f=>({...f,incoming:f.requester!==id})),rooms,blocks:await all('SELECT b.blocked AS id,p.alias FROM world_blocks b LEFT JOIN world_people p ON p.id=b.blocked WHERE b.blocker=? LIMIT 100',id),moderator};
}
