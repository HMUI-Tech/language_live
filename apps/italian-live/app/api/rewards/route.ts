import {learningRuntime,errorDetails} from "../../../lib/runtime-types";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {
  bodyJSON,
  parentIdentity,
  cookieToken,
  reply,
} from "../../../lib/family.mjs";
import { walletBridge } from "../../../lib/rewards.mjs";
import "../../../public/play-core.js";
import "../../../public/reading-data.js";
import "../../../public/rewards-data.js";
import "../../../public/rewards-core.js";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await walletBridge(env, "read", "healthcheck:no-profile");
    return reply({ available: true });
  } catch {
    return reply({ available: false }, 503);
  }
}
export async function POST(request: Request) {
  try {
    const b = await bodyJSON(request);
    if (cookieToken(request))
      return reply(
        { error: "Use the child profile shop during a Kids session." },
        403,
      );
    const owner = await parentIdentity(request, env, getChatGPTUser);
    if (!owner)
      return reply({ error: "Sign in to save your coins and rewards." }, 401);
    const row = await walletBridge(env, "read", owner),
      C = learningRuntime.DLRewardCore;
    if (b.op === "load") return reply({ wallet: C.normalize(row?.data) });
    const next = C.apply(row?.data, b, {
      day: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(
        new Date(),
      ),
      words: learningRuntime.DLPlayCore.WORDS,
      cardIds: learningRuntime.DLRewardCardIds,
      stories: learningRuntime.DLReadingStories.concat(
        learningRuntime.DLRewardStories,
      ),
    });
    await walletBridge(env, "write", owner, next, row?.revision || 0);
    return reply({ wallet: next });
  } catch (error: unknown) {
    const e=errorDetails(error);
    return reply(
      { error: e?.message || "Could not update rewards." },
      e?.status || 400,
    );
  }
}
