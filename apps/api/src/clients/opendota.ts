import axios from "axios";
import axiosRetry from "axios-retry";
import Bottleneck from "bottleneck";
import "dotenv/config";

/** Axios client */
export const OD = axios.create({
  baseURL: "https://api.opendota.com/api",
  timeout: 20000,
});

/** Optional API key (keep optional for free tier) */
const OD_KEY = process.env.OPEN_DOTA_API_KEY;
if (OD_KEY) {
  OD.defaults.headers.common["Authorization"] = `Bearer ${OD_KEY}`;
}

/** Retry on 429/5xx with backoff (honor Retry-After) */
axiosRetry(OD, {
  retries: 5,
  retryDelay: (retryCount, error) => {
    const ra = Number(error?.response?.headers?.["retry-after"]);
    return ra ? ra * 1000 : Math.min(1000 * 2 ** (retryCount - 1), 8000);
  },
  retryCondition: (error) => {
    const s = error?.response?.status;
    return s === 429 || !s || s >= 500;
  },
});

/** Rate limit (keyless-friendly: ~1 req/sec) */
const limiter = new Bottleneck({ minTime: 1000 });

async function odGet<T>(url: string, config?: any): Promise<T> {
  // If you prefer query param instead of header:
  // if (OD_KEY) { config = { ...(config||{}), params: { ...(config?.params||{}), api_key: OD_KEY } }; }
  return limiter.schedule(async () => {
    const { data } = await OD.get(url, config);
    return data as T;
  });
}

/** Constants */
export const LOBBY = { NORMAL: 0, RANKED: 7 } as const;
export const GAME_MODE = { TURBO: 23 } as const;

export const LANE_NAME: Record<
  number,
  "safe" | "mid" | "off" | "jungle" | "roam" | "unknown"
> = {
  1: "safe",
  2: "mid",
  3: "off",
  4: "jungle",
  5: "roam",
} as any;

/** Heroes cache */
let HERO_NAME_BY_ID: Record<number, string> | null = null;

export async function getHeroNameMap(): Promise<Record<number, string>> {
  if (HERO_NAME_BY_ID) return HERO_NAME_BY_ID;
  const data = await odGet<any[]>("/heroes");
  HERO_NAME_BY_ID = Object.fromEntries(
    data.map((h) => [h.id as number, h.localized_name as string])
  );
  return HERO_NAME_BY_ID!;
}

/** players/{id}/matches with projected columns */
export async function getPlayerMatchesProjected(
  accountId: string,
  opts?: {
    limit?: number;
    dateDays?: number;
    gameMode?: number;
    lobbyType?: number;
  }
) {
  const params = new URLSearchParams();
  params.set("limit", String(opts?.limit ?? 5000));
  params.set("significant", "0");

  // IMPORTANT: use gold_per_min / xp_per_min (OpenDota naming)
  [
    "match_id",
    "start_time",
    "player_slot",
    "radiant_win",
    "duration",
    "hero_id",
    "kills",
    "deaths",
    "assists",
    "gold_per_min",
    "xp_per_min",
    "hero_damage",
    "tower_damage",
    "last_hits",
    "denies",
    "lobby_type",
    "game_mode",
    "lane",
    "lane_role",
    "is_roaming",
    "party_size",
    "version",
  ].forEach((col) => params.append("project", col));

  if (opts?.dateDays) params.set("date", String(opts.dateDays));
  if (opts?.gameMode !== undefined)
    params.set("game_mode", String(opts.gameMode));
  if (opts?.lobbyType !== undefined)
    params.set("lobby_type", String(opts.lobbyType));

  const raw = await odGet<any[]>(
    `/players/${accountId}/matches?${params.toString()}`
  );

  // Normalize to .gpm / .xpm so the rest of the code can rely on those
  const rows = raw.map((r) => ({
    ...r,
    gpm: r.gold_per_min ?? r.gpm ?? 0,
    xpm: r.xp_per_min ?? r.xpm ?? 0,
  }));

  return rows as Array<{
    match_id: number;
    start_time: number;
    player_slot: number;
    radiant_win: boolean;
    duration: number;
    hero_id: number;
    kills: number;
    deaths: number;
    assists: number;
    gpm: number;
    xpm: number;
    hero_damage?: number | null;
    tower_damage?: number | null;
    last_hits?: number | null;
    denies?: number | null;
    lobby_type?: number | null;
    game_mode?: number | null;
    lane?: number | null;
    lane_role?: number | null;
    is_roaming?: boolean | null;
    party_size?: number | null;
    version?: number | null;
  }>;
}

/** /matches/{id} (deep parsed) */
export async function getMatchDetail(matchId: number) {
  return odGet(`/matches/${matchId}`);
}

/** /benchmarks?hero_id= */
export async function getHeroBenchmarks(heroId: number) {
  return odGet(`/benchmarks`, { params: { hero_id: heroId } });
}

/** /players/{id}/rankings */
export async function getPlayerRankings(accountId: string) {
  return odGet(`/players/${accountId}/rankings`) as Promise<any[]>;
}

/** Queue a parse job for a match*/
export async function requestParse(matchId: number) {
  return odGet(`/request/${matchId}`);
}
