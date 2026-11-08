import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) => Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
export async function GET() {
 const user = await getChatGPTUser();
 if (!user) return reply({error:'Sign in required'},401);
 if (!env.DB) return reply({error:'Storage unavailable'},503);
 const row = await env.DB.prepare('SELECT data, revision FROM progress WHERE user_id = ?').bind(user.userId).first<{data:string;revision:number}>();
 return reply({docs:row ? JSON.parse(row.data):null, revision:row?.revision || 0});
}
export async function PUT(request: Request) {
 const user = await getChatGPTUser();
 if (!user) return reply({error:'Sign in required'},401);
 if (!env.DB) return reply({error:'Storage unavailable'},503);
 if (request.headers.get('origin') !== new URL(request.url).origin) return reply({error:'Invalid origin'},403);
 if (!request.headers.get('content-type')?.includes('application/json')) return reply({error:'JSON required'},415);
 const raw = await request.text();
 if (raw.length > 2000000) return reply({error:'Progress file too large'},413);
 let body;
 try { body = JSON.parse(raw); } catch { return reply({error:'Invalid JSON'},400); }
 const {docs, revision} = body;
 if (!Number.isSafeInteger(revision) || revision < 0 || !docs || typeof docs !== 'object' || Array.isArray(docs) || docs.meta?.v !== 1 || !docs.meta?.settings || !docs.custom?.items || Object.keys(docs).some(k=>!['meta','custom'].includes(k)&&!/^cards-[\w-]+$/.test(k))) return reply({error:'Invalid progress format'},400);
 const data = JSON.stringify(docs), now = Date.now();
 const result = revision === 0
  ? await env.DB.prepare('INSERT INTO progress (user_id,data,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(user_id) DO NOTHING').bind(user.userId,data,now).run()
  : await env.DB.prepare('UPDATE progress SET data=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=?').bind(data,now,user.userId,revision).run();
 if (!result.meta.changes) return reply({error:'Progress changed on another device. Export your local copy, then reload.'},409);
 return reply({revision:revision+1});
}
