import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function gateway(subject:string,docs:unknown=null,revision:number|null=null) {
 const vars=env as unknown as Record<string,string>;
 if(!vars.ITALIAN_BRIDGE_SECRET||!vars.SUPABASE_URL||!vars.SUPABASE_PUBLISHABLE_KEY) return reply({error:'Storage unavailable'},503);
 try {
  const response=await fetch(vars.SUPABASE_URL+'/rest/v1/rpc/italian_site_progress',{method:'POST',headers:{apikey:vars.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({bridge_key:vars.ITALIAN_BRIDGE_SECRET,subject,new_docs:docs,expected_revision:revision}),signal:AbortSignal.timeout(15000)});
  if(!response.ok){const error=await response.json() as {message?:string};return reply({error:error.message?.includes('progress_conflict')?'Progress changed on another device. Export this copy and reload.':'Could not save progress.'},error.message?.includes('progress_conflict')?409:502);}
  return reply(await response.json());
 } catch{return reply({error:'Storage temporarily unavailable'},503);}
}
export async function GET(){const user=await getChatGPTUser();return user?gateway(user.userId):reply({error:'Sign in required'},401);}
export async function PUT(request:Request){
 const user=await getChatGPTUser();if(!user)return reply({error:'Sign in required'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid origin'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required'},415);
 const raw=await request.text();if(raw.length>2000000)return reply({error:'Progress file too large'},413);
 let body;try{body=JSON.parse(raw);}catch{return reply({error:'Invalid JSON'},400);}
 const {docs,revision}=body||{};
 if(!Number.isSafeInteger(revision)||revision<0||!docs||Array.isArray(docs)||docs.meta?.v!==1||!docs.meta?.settings||!docs.custom?.items||Object.keys(docs).some(k=>!['meta','custom'].includes(k)&&!/^cards-[\w-]+$/.test(k)))return reply({error:'Invalid progress format'},400);
 return gateway(user.userId,docs,revision);
}
