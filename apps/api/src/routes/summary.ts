import { Router } from "express";
import { z } from "zod";
import { getHeroNameMap, getPlayerMatchesProjected } from "../clients/opendota";
import { isRadiant, toAccountId } from "../utils/steam";

const router = Router();

/**
 * GET /v1/players/:steamid64/summary?year=2025
 * Returns: overall/radiant/dire winrates, most played hero, most kills, total hero damage.
 */
router.get("/players/:steamid64/summary", async (req, res, next) => {
  try {
    const q = z
      .object({
        steamid64: z.string().regex(/^\d+$/),
        year: z.coerce
          .number()
          .int()
          .min(2012)
          .max(2100)
          .default(new Date().getUTCFullYear()),
      })
      .parse({ ...req.params, ...req.query });

    const accountId = toAccountId(q.steamid64);

    // Fetch many matches with the fields we need
    const matches = await getPlayerMatchesProjected(accountId, 5000);

    // Filter by the requested calendar year [Jan 1 00:00:00, Dec 31 23:59:59] (UTC)
    const start = Date.UTC(q.year, 0, 1) / 1000;
    const end = Date.UTC(q.year + 1, 0, 1) / 1000;
    const yearMatches = matches.filter(
      (m) => m.start_time >= start && m.start_time < end
    );

    // Aggregate
    let total = 0,
      wins = 0;
    let radGames = 0,
      radWins = 0,
      direGames = 0,
      direWins = 0;
    let totalHeroDamage = 0;

    const heroCounts = new Map<number, number>();
    let mostKills = -1;
    let mostKillsMatch: {
      match_id: number;
      kills: number;
      start_time: number;
      hero_id: number;
    } | null = null;

    for (const m of yearMatches) {
      total++;
      const r = isRadiant(m.player_slot);
      const won = (m.radiant_win && r) || (!m.radiant_win && !r);
      if (won) wins++;

      if (r) {
        radGames++;
        if (won) radWins++;
      } else {
        direGames++;
        if (won) direWins++;
      }

      heroCounts.set(m.hero_id, (heroCounts.get(m.hero_id) ?? 0) + 1);
      if ((m.kills ?? 0) > mostKills) {
        mostKills = m.kills ?? 0;
        mostKillsMatch = {
          match_id: m.match_id,
          kills: mostKills,
          start_time: m.start_time,
          hero_id: m.hero_id,
        };
      }
      totalHeroDamage += m.hero_damage ?? 0;
    }

    // Most played hero
    let mostPlayed: { hero_id: number; games: number } | null = null;
    for (const [hero_id, games] of heroCounts.entries()) {
      if (!mostPlayed || games > mostPlayed.games)
        mostPlayed = { hero_id, games };
    }

    const heroNames = await getHeroNameMap();
    const response = {
      year: q.year,
      totals: {
        matches: total,
        wins,
        winrate: total ? +((wins / total) * 100).toFixed(2) : 0,
        playtime_hours_est: undefined as number | undefined,
        total_hero_damage: totalHeroDamage,
      },
      by_side: {
        radiant: {
          matches: radGames,
          wins: radWins,
          winrate: radGames ? +((radWins / radGames) * 100).toFixed(2) : 0,
        },
        dire: {
          matches: direGames,
          wins: direWins,
          winrate: direGames ? +((direWins / direGames) * 100).toFixed(2) : 0,
        },
      },
      most_played_hero: mostPlayed
        ? {
            hero_id: mostPlayed.hero_id,
            name: heroNames[mostPlayed.hero_id] ?? `Hero ${mostPlayed.hero_id}`,
            matches: mostPlayed.games,
          }
        : null,
      most_kills_game: mostKillsMatch
        ? {
            match_id: mostKillsMatch.match_id,
            kills: mostKillsMatch.kills,
            date_utc: new Date(mostKillsMatch.start_time * 1000).toISOString(),
            hero_id: mostKillsMatch.hero_id,
            hero_name:
              heroNames[mostKillsMatch.hero_id] ??
              `Hero ${mostKillsMatch.hero_id}`,
          }
        : null,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
