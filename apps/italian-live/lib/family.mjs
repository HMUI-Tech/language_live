// Server-owned records: verified adult identity + PIN; child sessions are opaque and scoped.
export const EMOJIS=['🦊','🐼','🐸','🦁','🐨','🐧'];
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
export async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function pinHash(pin,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);return Array.from(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256)),x=>x.toString(16).padStart(2,'0')).join('');}
export function validPin(pin){return typeof pin==='string'&&/^\d{6,12}$/.test(pin)&&!/^([0-9])\1+$/.test(pin)&&!['123456','654321','12345678'].includes(pin);}
export function profileSettings(body){const name=String(body.name||'').trim();if(name.length<1||name.length>20||/[<>\x00-\x1f]/.test(name))throw Error('Use a nickname of 1–20 characters.');if(![5,10,15,20].includes(body.minutes)||!EMOJIS.includes(body.avatar))throw Error('Choose a session length and avatar.');return {name,minutes:body.minutes,avatar:body.avatar};}
export function publicProfile(p){return {id:p.id,name:p.name,avatar:p.avatar,minutes:p.minutes,play:p.play||null,paused:!!p.paused,wallet:p.wallet||null,rewardsDisabled:!!p.rewardsDisabled};}
export const cookieToken=request=>request.headers.get('cookie')?.match(/(?:^|;\s*)il_kid=([a-f0-9]{64})(?:;|$)/)?.[1];
export const childCookie=(token,seconds)=>`il_kid=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
export async function bridge(vars,op,who,payload=null,expected=0){
 if(!vars.FAMILY_SERVER_KEY||!vars.SUPABASE_URL||!vars.SUPABASE_PUBLISHABLE_KEY){console.warn('family_config_missing');throw Error('Family services are temporarily unavailable.');}
 const res=await fetch(vars.SUPABASE_URL+'/rest/v1/rpc/italian_family_bridge',{method:'POST',headers:{apikey:vars.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({op,who,payload,expected,server_key:vars.FAMILY_SERVER_KEY}),signal:AbortSignal.timeout(10000)});
 if(!res.ok){const text=await res.text();let code='unknown';try{code=JSON.parse(text).code||'unknown';}catch{}console.warn('family_storage_failure',res.status,code);if(text.includes('family_conflict'))throw Error('Your family changed on another device. Reload and try again.');throw Error('Family services are temporarily unavailable.');}return res.json();
}
export async function parentIdentity(request,vars,getChatGPTUser){
 const auth=request.headers.get('authorization');
 if(auth?.startsWith('Bearer ')){
 const r=await fetch(vars.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:vars.SUPABASE_PUBLISHABLE_KEY,Authorization:auth},signal:AbortSignal.timeout(10000)});
 if(!r.ok)return null;const u=await r.json();return u.id&&!u.is_anonymous?'supabase:'+u.id:null;
 }const u=await getChatGPTUser();return u?'chatgpt:'+u.userId:null;
}
export async function bodyJSON(request){if(request.headers.get('origin')!==new URL(request.url).origin)throw Error('Invalid origin.');if(!request.headers.get('content-type')?.includes('application/json'))throw Error('JSON required.');const raw=await request.text();if(raw.length>4000)throw Error('Request too large.');return JSON.parse(raw);}
export const reply=(data,status=200,cookie)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
