import { env } from "cloudflare:workers";
export const dynamic = "force-dynamic";
export function GET() {
  const vars = env as unknown as Record<string, string>;
  const url = vars.SUPABASE_URL || "";
  const key = vars.SUPABASE_PUBLISHABLE_KEY || "";
  // Only the explicitly public publishable key may enter the browser.
  if (!url.startsWith("https://") || !key.startsWith("sb_publishable_"))
    return Response.json(
      { url: "", key: "", hosted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  return Response.json(
    { url, key, hosted: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
