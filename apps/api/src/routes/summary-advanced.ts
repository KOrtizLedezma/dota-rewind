import { Router } from "express";
import { z } from "zod";
import {
  getHeroNameMap,
  getMatchDetail,
  getPlayerMatchesProjected,
  LANE_NAME,
  requestParse,
} from "../clients/opendota";
import { isRadiant, toAccountId } from "../utils/steam";
import { rangeKeyToDays, rangeUnixBounds } from "../utils/time";
import { queueToFilters } from "../utils/queue";
import { cacheWrap } from "../utils/cache";

const router = Router();

/** Defaults tuned for keyless OpenDota usage */
const DEFAULT_DEEP_MATCH_LIMIT = 20;
const CONCURRENCY = 2;

/** Simple bounded-concurrency mapper for side-effect work */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (t: T, idx: number) => Promise<void>
) {
  let i = 0;
  const workers = Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) break;
        try {
          await fn(items[idx], idx);
        } catch {
          // swallow; caller can track a warning flag
        }
      }
    });
  await Promise.all(workers);
}

type RangeKey = "last_month" | "last_6_months" | "last_year";
type QueueKey = "all" | "turbo" | "ranked" | "normal";

/**
 * GET /v1/player/:steamid64/summary-advanced
 * Query:
 *   - range: last_month | last_6_months | last_year
 *   - queue: all | turbo | ranked | normal
 *   - deepLimit: number (0..300)
 *   - parse: 0 | 1    (optional) request parse for matches that lack details
 */
router.get("/:steamid64/summary-advanced", async (req, res, next) => {
  try {
    const q = z
      .object({
        steamid64: z.string().regex(/^\d+$/),
        range: z
          .enum(["last_month", "last_6_months", "last_year"])
          .default("last_year"),
        queue: z.enum(["all", "turbo", "ranked", "normal"]).default("all"),
        deepLimit: z.coerce
          .number()
          .min(0)
          .max(300)
          .default(DEFAULT_DEEP_MATCH_LIMIT),
        parse: z
          .union([z.literal("0"), z.literal("1")])
          .optional()
          .default("0"),
      })
      .parse({ ...req.params, ...req.query });

    const requestParseIfMissing = q.parse === "1";

    const accountId = toAccountId(q.steamid64);
    const days = rangeKeyToDays(q.range as RangeKey);
    const { start, end } = rangeUnixBounds(days);
    const filters = queueToFilters(q.queue as QueueKey);

    // --------- cacheable calls ---------
    const heroNames = await cacheWrap("heroes:v1", 60 * 60, getHeroNameMap);

    const matchesCacheKey = `m:${accountId}:${days}:${
      filters.gameMode ?? "any"
    }:${filters.lobbyType ?? "any"}`;
    const baseMatches = await cacheWrap(matchesCacheKey, 60 * 5, () =>
      getPlayerMatchesProjected(accountId, {
        limit: 5000,
        dateDays: days,
        gameMode: filters.gameMode,
        lobbyType: filters.lobbyType,
      })
    );

    // Exact timestamp window
    const rows = (baseMatches as any[]).filter(
      (m) => m.start_time >= start && m.start_time <= end
    );
    const sortedByTime = [...rows].sort((a, b) => a.start_time - b.start_time);

    // --------- aggregations on projected data ---------
    const totals = {
      matches: 0,
      wins: 0,
      playtime_seconds: 0,
      total_hero_damage: 0,
      total_tower_damage: 0,
      avg_hero_damage: 0,
      avg_gpm: 0,
      avg_xpm: 0,
      avg_last_hits: 0,
      avg_denies: 0,
    };

    // Records
    let maxKills: {
      match_id: number;
      kills: number;
      hero_id: number;
      start_time: number;
    } | null = null;
    let maxDeaths: {
      match_id: number;
      deaths: number;
      hero_id: number;
      start_time: number;
    } | null = null;
    let maxAssists: {
      match_id: number;
      assists: number;
      hero_id: number;
      start_time: number;
    } | null = null;
    let maxGPM: {
      match_id: number;
      gpm: number;
      hero_id: number;
      start_time: number;
    } | null = null;
    let maxXPM: {
      match_id: number;
      xpm: number;
      hero_id: number;
      start_time: number;
    } | null = null;

    // Streaks
    let curWin = 0,
      bestWin = 0,
      curLose = 0,
      bestLose = 0;

    // Sides
    let radG = 0,
      radW = 0,
      direG = 0,
      direW = 0;

    // Heroes & lanes
    const heroAgg = new Map<
      number,
      {
        games: number;
        wins: number;
        kills: number;
        deaths: number;
        assists: number;
      }
    >();
    type LaneKey = "safe" | "mid" | "off" | "jungle" | "roam" | "unknown";
    const laneAgg = new Map<LaneKey, { games: number; wins: number }>();

    // Histograms (bucket step=100)
    const gpmBins = new Map<number, number>();
    const xpmBins = new Map<number, number>();
    const addBin = (map: Map<number, number>, value: number, step = 100) => {
      const bucket = Math.floor((value || 0) / step) * step;
      map.set(bucket, (map.get(bucket) ?? 0) + 1);
    };

    for (const m of sortedByTime) {
      totals.matches++;
      totals.playtime_seconds += m.duration ?? 0;
      totals.total_hero_damage += m.hero_damage ?? 0;
      totals.total_tower_damage += m.tower_damage ?? 0;

      const r = isRadiant(m.player_slot);
      const won = (m.radiant_win && r) || (!m.radiant_win && !r);
      if (won) {
        totals.wins++;
        curWin++;
        bestWin = Math.max(bestWin, curWin);
        curLose = 0;
      } else {
        curLose++;
        bestLose = Math.max(bestLose, curLose);
        curWin = 0;
      }

      if (r) {
        radG++;
        if (won) radW++;
      } else {
        direG++;
        if (won) direW++;
      }

      // Records (with numeric fallbacks)
      if (!maxKills || (m.kills ?? 0) > maxKills.kills)
        maxKills = {
          match_id: m.match_id,
          kills: m.kills ?? 0,
          hero_id: m.hero_id,
          start_time: m.start_time,
        };
      if (!maxDeaths || (m.deaths ?? 0) > maxDeaths.deaths)
        maxDeaths = {
          match_id: m.match_id,
          deaths: m.deaths ?? 0,
          hero_id: m.hero_id,
          start_time: m.start_time,
        };
      if (!maxAssists || (m.assists ?? 0) > maxAssists.assists)
        maxAssists = {
          match_id: m.match_id,
          assists: m.assists ?? 0,
          hero_id: m.hero_id,
          start_time: m.start_time,
        };
      if (!maxGPM || (m.gpm ?? 0) > maxGPM.gpm)
        maxGPM = {
          match_id: m.match_id,
          gpm: m.gpm ?? 0,
          hero_id: m.hero_id,
          start_time: m.start_time,
        };
      if (!maxXPM || (m.xpm ?? 0) > maxXPM.xpm)
        maxXPM = {
          match_id: m.match_id,
          xpm: m.xpm ?? 0,
          hero_id: m.hero_id,
          start_time: m.start_time,
        };

      // Averages
      totals.avg_gpm += m.gpm ?? 0;
      totals.avg_xpm += m.xpm ?? 0;
      totals.avg_last_hits += m.last_hits ?? 0;
      totals.avg_denies += m.denies ?? 0;

      addBin(gpmBins, m.gpm ?? 0);
      addBin(xpmBins, m.xpm ?? 0);

      // Heroes
      const h = heroAgg.get(m.hero_id) ?? {
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
      };
      h.games++;
      if (won) h.wins++;
      h.kills += m.kills ?? 0;
      h.deaths += m.deaths ?? 0;
      h.assists += m.assists ?? 0;
      heroAgg.set(m.hero_id, h);

      // Lanes
      const laneName = (LANE_NAME[m.lane ?? 0] ?? "unknown") as LaneKey;
      const la = laneAgg.get(laneName) ?? { games: 0, wins: 0 };
      la.games++;
      if (won) la.wins++;
      laneAgg.set(laneName, la);
    }

    if (totals.matches > 0) {
      totals.avg_hero_damage = +(
        totals.total_hero_damage / totals.matches
      ).toFixed(2);
      totals.avg_gpm = +(totals.avg_gpm / totals.matches).toFixed(2);
      totals.avg_xpm = +(totals.avg_xpm / totals.matches).toFixed(2);
      totals.avg_last_hits = +(totals.avg_last_hits / totals.matches).toFixed(
        2
      );
      totals.avg_denies = +(totals.avg_denies / totals.matches).toFixed(2);
    }

    // Top 3 heroes by games (with winrate/KDA)
    const topHeroes = [...heroAgg.entries()]
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 3)
      .map(([hero_id, v]) => ({
        hero_id,
        name: heroNames[hero_id] ?? `Hero ${hero_id}`,
        matches: v.games,
        wins: v.wins,
        winrate: v.games ? +((v.wins / v.games) * 100).toFixed(2) : 0,
        avg_k: +(v.kills / Math.max(1, v.games)).toFixed(2),
        avg_d: +(v.deaths / Math.max(1, v.games)).toFixed(2),
        avg_a: +(v.assists / Math.max(1, v.games)).toFixed(2),
        kda: +((v.kills + v.assists) / Math.max(1, v.deaths)).toFixed(2),
      }));

    // Hero diversity
    const heroDiversity = heroAgg.size;

    // Lanes
    const lanes = [...laneAgg.entries()].map(([lane, v]) => ({
      lane,
      matches: v.games,
      wins: v.wins,
      winrate: v.games ? +((v.wins / v.games) * 100).toFixed(2) : 0,
    }));

    // Histograms
    const gpm_histogram = [...gpmBins.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, count]) => ({ bucket, count }));
    const xpm_histogram = [...xpmBins.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, count]) => ({ bucket, count }));

    // --------- Deep stats (attempt details for most-recent deepLimit matches) ---------
    const deepTarget = q.deepLimit > 0 ? sortedByTime.slice(-q.deepLimit) : [];

    const deep = {
      meta: {
        attempted: deepTarget.length,
        with_details: 0,
        parse_requested: 0,
      },
      wards: {
        obs_placed: 0,
        sen_placed: 0,
        obs_killed: 0,
        sen_killed: 0,
        per_game: {
          obs_placed: 0,
          sen_placed: 0,
          obs_killed: 0,
          sen_killed: 0,
        },
      },
      healing: 0,
      stuns: 0,
      purchases: { smoke: 0, dust: 0, obs: 0, sen: 0 },
      farm_profile: { early_gpm: 0, mid_gpm: 0, late_gpm: 0, matches_used: 0 },
    };
    let rateLimited = false;
    const accountIdNum = Number(accountId);

    await mapWithConcurrency(deepTarget, CONCURRENCY, async (m) => {
      try {
        const detail: any = await getMatchDetail(m.match_id);
        const p = (detail?.players || []).find(
          (pl: any) => pl.account_id === accountIdNum
        );

        // If no player row or no useful fields, optionally queue a parse
        const hasUseful =
          p &&
          (p.obs_placed != null ||
            p.sen_placed != null ||
            p.obs_killed != null ||
            p.sen_killed != null ||
            Array.isArray(p.purchase_log) ||
            Array.isArray(p.gold_t) ||
            p.healing != null ||
            p.hero_healing != null ||
            p.stuns != null);

        if (!hasUseful) {
          if (requestParseIfMissing) {
            try {
              await requestParse(m.match_id);
              deep.meta.parse_requested++;
            } catch {}
          }
          return;
        }

        deep.meta.with_details++;

        // Wards / dewards
        deep.wards.obs_placed += p.obs_placed ?? 0;
        deep.wards.sen_placed += p.sen_placed ?? 0;
        deep.wards.obs_killed += p.obs_killed ?? 0;
        deep.wards.sen_killed += p.sen_killed ?? 0;

        // Healing / stuns
        deep.healing += p.hero_healing ?? p.healing ?? 0;
        deep.stuns += Math.round(p.stuns ?? 0);

        // Purchases
        if (Array.isArray(p.purchase_log)) {
          for (const it of p.purchase_log) {
            const key = String(it?.key ?? "");
            if (key === "smoke_of_deceit") deep.purchases.smoke++;
            if (key === "dust" || key === "dust_of_appearance")
              deep.purchases.dust++;
            if (key === "ward_observer") deep.purchases.obs++;
            if (key === "ward_sentry") deep.purchases.sen++;
          }
        }

        // Farm profile from per-minute net worth (gold_t)
        const goldT: number[] | undefined = p.gold_t;
        if (Array.isArray(goldT) && goldT.length > 1) {
          const mins = goldT.length - 1; // arrays start at t=0
          const seg = (from: number, to: number) =>
            Math.max(
              0,
              goldT[Math.min(to, mins)] - goldT[Math.min(from, mins)]
            );
          const early = seg(0, 10);
          const mid = seg(10, 25);
          const late = seg(25, mins);
          const early_gpm = early / Math.max(1, Math.min(10, mins));
          const mid_gpm =
            mid / Math.max(1, Math.min(15, Math.max(0, mins - 10)));
          const late_gpm = late / Math.max(1, Math.max(0, mins - 25));
          deep.farm_profile.early_gpm += early_gpm;
          deep.farm_profile.mid_gpm += mid_gpm;
          deep.farm_profile.late_gpm += late_gpm;
          deep.farm_profile.matches_used++;
        }
      } catch (e: any) {
        if (e?.response?.status === 429) rateLimited = true;
        // skip this one
      }
    });

    if (deepTarget.length > 0 && deep.meta.with_details > 0) {
      const games = deep.meta.with_details;
      deep.wards.per_game = {
        obs_placed: +(deep.wards.obs_placed / games).toFixed(2),
        sen_placed: +(deep.wards.sen_placed / games).toFixed(2),
        obs_killed: +(deep.wards.obs_killed / games).toFixed(2),
        sen_killed: +(deep.wards.sen_killed / games).toFixed(2),
      };
      if (deep.farm_profile.matches_used > 0) {
        deep.farm_profile.early_gpm = +(
          deep.farm_profile.early_gpm / deep.farm_profile.matches_used
        ).toFixed(2);
        deep.farm_profile.mid_gpm = +(
          deep.farm_profile.mid_gpm / deep.farm_profile.matches_used
        ).toFixed(2);
        deep.farm_profile.late_gpm = +(
          deep.farm_profile.late_gpm / deep.farm_profile.matches_used
        ).toFixed(2);
      }
    }

    // --------- Solo vs party ---------
    let soloG = 0,
      soloW = 0,
      partyG = 0,
      partyW = 0;
    for (const m of rows) {
      const won =
        (m.radiant_win && isRadiant(m.player_slot)) ||
        (!m.radiant_win && !isRadiant(m.player_slot));
      const party = (m.party_size ?? 1) > 1;
      if (party) {
        partyG++;
        if (won) partyW++;
      } else {
        soloG++;
        if (won) soloW++;
      }
    }
    const solo_vs_party = {
      solo: {
        matches: soloG,
        wins: soloW,
        winrate: soloG ? +((soloW / soloG) * 100).toFixed(2) : 0,
      },
      party: {
        matches: partyG,
        wins: partyW,
        winrate: partyG ? +((partyW / partyG) * 100).toFixed(2) : 0,
      },
    };

    // --------- Response ---------
    res.json({
      filters: {
        range: q.range,
        queue: q.queue,
        days,
        deep_used: deepTarget.length,
      },
      warnings: rateLimited
        ? ["Some deep stats were skipped due to rate limiting."]
        : [],
      totals: {
        matches: totals.matches,
        wins: totals.wins,
        winrate: totals.matches
          ? +((totals.wins / totals.matches) * 100).toFixed(2)
          : 0,
        playtime_hours: +(totals.playtime_seconds / 3600).toFixed(2),
        total_hero_damage: totals.total_hero_damage,
        avg_hero_damage: totals.avg_hero_damage,
        total_tower_damage: totals.total_tower_damage,
        avg_gpm: totals.avg_gpm,
        avg_xpm: totals.avg_xpm,
        avg_last_hits: totals.avg_last_hits,
        avg_denies: totals.avg_denies,
      },
      sides: {
        radiant: {
          matches: radG,
          wins: radW,
          winrate: radG ? +((radW / radG) * 100).toFixed(2) : 0,
        },
        dire: {
          matches: direG,
          wins: direW,
          winrate: direG ? +((direW / direG) * 100).toFixed(2) : 0,
        },
      },
      streaks: { longest_win: bestWin, longest_loss: bestLose },
      records: {
        most_kills: maxKills
          ? { ...maxKills, hero_name: heroNames[maxKills.hero_id] }
          : null,
        most_deaths: maxDeaths
          ? { ...maxDeaths, hero_name: heroNames[maxDeaths.hero_id] }
          : null,
        most_assists: maxAssists
          ? { ...maxAssists, hero_name: heroNames[maxAssists.hero_id] }
          : null,
        best_gpm: maxGPM
          ? { ...maxGPM, hero_name: heroNames[maxGPM.hero_id] }
          : null,
        best_xpm: maxXPM
          ? { ...maxXPM, hero_name: heroNames[maxXPM.hero_id] }
          : null,
      },
      heroes: { top3: topHeroes, diversity: heroDiversity },
      lanes,
      histograms: { gpm: gpm_histogram, xpm: xpm_histogram, step: 100 },
      deep, // wards/healing/stuns/purchases + farm_profile (with meta)
      solo_vs_party,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
