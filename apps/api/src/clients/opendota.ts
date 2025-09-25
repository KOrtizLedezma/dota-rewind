import axios = require("axios");

export const OD = axios.create({
  baseURL: "https://api.opendota.com/api",
  timeout: 5000,
});

// Map of hero_id

let HERO_NAME_BY_ID: Record<number, string> | null = null;

export async function getHeroNameMap(): Promise<Record<number, string>> {
  if (HERO_NAME_BY_ID) return HERO_NAME_BY_ID;
  const { data } = await OD.get("/heroes");
  HERO_NAME_BY_ID = Object.fromEntries(
    (data as any[]).map((h) => [h.id as number, h.localized_name as string])
  );
  return HERO_NAME_BY_ID;
}

/** Fetch matches for a player. Grabbing only: match_id, start_time, player_slot, radiant_win, hero_id, kills, hero_damage */
export async function getPlayerMatchesProjected(
  accountId: string,
  limit = 5000
) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("significant", "0");
  [
    "match_id",
    "start_time",
    "player_slot",
    "radiant_win",
    "hero_id",
    "kills",
    "hero_damage",
  ].forEach((col) => params.append("project", col));

  const { data } = await OD.get(
    `/players/${accountId}/matches?${params.toString()}`
  );

  return data as Array<{
    match_id: number;
    start_time: number;
    player_slot: number;
    radiant_win: boolean;
    hero_id: number;
    kills: number;
    hero_damage: number;
  }>;
}
