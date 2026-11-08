import {
  learningRuntime,
  errorDetails,
  type WorldEnvironment,
} from "../../../lib/runtime-types";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {
  parentIdentity,
  cookieToken,
  bodyJSON,
  reply,
  digest,
  randomToken,
} from "../../../lib/family.mjs";
import { walletBridge } from "../../../lib/rewards.mjs";
import { isOwner } from "../../../lib/usage.mjs";
import { worldAction } from "../../../lib/world.mjs";
import "../../../public/rewards-core.js";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const body = await bodyJSON(request);
    if (cookieToken(request))
      return reply(
        { error: "Kids profiles cannot access the 16+ world." },
        403,
      );
    const owner = await parentIdentity(request, env, getChatGPTUser);
    if (!owner) return reply({ error: "Sign in to enter the 16+ world." }, 401);
    const vars = env as unknown as WorldEnvironment;
    if (!vars.DB)
      return reply({ error: "World temporarily unavailable." }, 503);
    const C = learningRuntime.DLRewardCore;
    const row = await walletBridge(env, "read", owner),
      wallet = C.normalize(row?.data);
    const moderator =
      !request.headers.has("authorization") &&
      isOwner(await getChatGPTUser(), vars.USAGE_OWNER_EMAIL);
    return reply(
      await worldAction({
        db: vars.DB,
        id: await digest(owner + ":world"),
        wallet,
        body,
        C,
        token: () => randomToken().slice(0, 32),
        moderator,
      }),
    );
  } catch (error: unknown) {
    const e = errorDetails(error);
    return reply(
      {
        error: e?.status
          ? e.message
          : "World temporarily unavailable. Please try again.",
      },
      e?.status || 503,
    );
  }
}
