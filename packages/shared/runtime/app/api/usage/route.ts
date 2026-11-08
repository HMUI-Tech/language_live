import { env } from "cloudflare:workers";
import {
  validEvent,
  allowedRequest,
  isBot,
  usageRpc,
} from "../../../lib/usage.mjs";
export const dynamic = "force-dynamic";
const reply = (status: number) =>
  new Response(null, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  if (!allowedRequest(request)) return reply(403);
  if (isBot(request)) return reply(204);
  if (Number(request.headers.get("content-length") || 0) > 128)
    return reply(413);
  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  let raw = "",
    size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128) {
        await reader.cancel();
        return reply(413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch {
    return reply(400);
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return reply(400);
  }
  if (!value || Object.keys(value).length !== 1 || !validEvent(value.event))
    return reply(400);
  try {
    await usageRpc(env, "record_language_usage", { event_name: value.event });
    return reply(204);
  } catch {
    return reply(503);
  }
}
