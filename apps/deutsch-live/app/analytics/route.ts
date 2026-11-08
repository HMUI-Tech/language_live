import { env } from 'cloudflare:workers';
import { getChatGPTUser,chatGPTSignInPath } from '../chatgpt-auth';
import {isOwner,usageRpc,dashboard} from '../../lib/usage.mjs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','Content-Type':'text/html; charset=utf-8','X-Robots-Tag':'noindex, nofollow','Vary':'Cookie','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"};
export async function GET(){
 const user=await getChatGPTUser();
 if(!user)return new Response(null,{status:303,headers:{Location:chatGPTSignInPath('/analytics'),'Cache-Control':'no-store'}});
 const vars=env as unknown as Record<string,string>;
 if(!isOwner(user,vars.USAGE_OWNER_EMAIL))return new Response('<h1>Owner access only</h1><p>This dashboard belongs to the website operator.</p>',{status:403,headers});
 try{return new Response(dashboard(await usageRpc(vars,'language_usage_summary')),{headers});}
 catch{return new Response('<h1>Analytics temporarily unavailable</h1><p>Please try again shortly.</p>',{status:503,headers});}
}
