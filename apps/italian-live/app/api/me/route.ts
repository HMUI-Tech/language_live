import { getChatGPTUser } from '../../chatgpt-auth';
export const dynamic = 'force-dynamic';
export async function GET() {
 const user = await getChatGPTUser();
 return Response.json({user: user ? {id:user.userId, name:user.displayName} : null}, {headers:{'Cache-Control':'no-store'}});
}
