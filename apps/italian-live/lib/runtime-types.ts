/** Contracts for classic-script learning engines imported by the server routes. */
export interface ChildProfile {
  id: string;
  name: string;
  avatar: string;
  minutes: number;
  token?: string | null;
  expires?: number;
  paused?: boolean;
  rewardsDisabled?: boolean;
  play?: unknown;
  wallet?: unknown;
}
export interface RewardWallet {
  ageBand: '16-17' | '18+' | null;
  owned: string[];
  earned: number;
  spent: number;
  stars: number;
  starPoints: number;
}
interface Runtime {
  DLRewardCore: {
    normalize(value: unknown): RewardWallet;
    apply(wallet: unknown, event: unknown, context: Record<string, unknown>): RewardWallet;
    CATALOG: {id: string; kind: string; title: string}[];
  };
  DLPlayCore: {
    WORDS: {id: string}[];
    record(...args: unknown[]): unknown;
    recordReview(...args: unknown[]): unknown;
  };
  DLRewardStories: unknown[];
  DLReadingStories: unknown[];
  DLRewardCardIds: string[];
}
export const learningRuntime = globalThis as unknown as Runtime;
export interface WorldEnvironment {
  DB?: D1Database;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  FAMILY_SERVER_KEY: string;
  REWARDS_SERVER_KEY: string;
  USAGE_OWNER_EMAIL: string;
}
export function errorDetails(value: unknown) {
  const error = value instanceof Error ? value : null;
  const status = error && 'status' in error && typeof error.status === 'number' ? error.status : undefined;
  return {message: error?.message || 'Request failed.', status};
}
