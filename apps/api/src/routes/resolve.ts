import { Router } from "express";
import axios from "axios";
import { z } from "zod";

const router = Router();

const STEAMID64_BASE = 76561197960265728n;

// ---------- helpers ----------
function toSteam64From32(accountId: number | string): string {
  const n = BigInt(accountId as any);
  return (STEAMID64_BASE + n).toString();
}
function to32FromSteam64(steam64: string): string {
  return (BigInt(steam64) - STEAMID64_BASE).toString();
}

type Parsed =
  | { kind: "steam64"; steamid64: string }
  | { kind: "account32"; accountId: string }
  | { kind: "urlProfiles"; steamid64: string }
  | {
      kind: "steam2";
      universe: number;
      authServer: number;
      accountNumber: number;
    }
  | { kind: "steam3"; account32: string }
  | { kind: "name"; q: string }
  | { kind: "urlVanity"; vanity: string };

function parseInput(raw: string): Parsed {
  const s = raw.trim();
  const url = s.match(
    /https?:\/\/steamcommunity\.com\/(profiles|id)\/([^\/\s#?]+)/i
  );
  if (url) {
    if (url[1].toLowerCase() === "profiles" && /^\d{17}$/.test(url[2])) {
      return { kind: "urlProfiles", steamid64: url[2] };
    }
    if (url[1].toLowerCase() === "id") {
      return { kind: "urlVanity", vanity: url[2] };
    }
  }
  // SteamID64
  if (/^\d{17}$/.test(s)) return { kind: "steam64", steamid64: s };
  // account32 (friend id)
  if (/^\d{1,10}$/.test(s)) return { kind: "account32", accountId: s };
  // Steam2: STEAM_X:Y:Z
  const s2 = s.match(/^STEAM_([0-5]):([01]):(\d+)$/i);
  if (s2) {
    return {
      kind: "steam2",
      universe: parseInt(s2[1], 10),
      authServer: parseInt(s2[2], 10),
      accountNumber: parseInt(s2[3], 10),
    };
  }
  // Steam3: [U:1:XXXX]
  const s3 = s.match(/^\[U:1:(\d+)\]$/i);
  if (s3) return { kind: "steam3", account32: s3[1] };
  // otherwise treat as name/vanity
  return { kind: "name", q: s };
}

async function searchOpenDota(nameLike: string) {
  try {
    const { data } = await axios.get("https://api.opendota.com/api/search", {
      params: { q: nameLike },
      timeout: 12000,
    });
    const arr = Array.isArray(data) ? data : [];
    return arr.slice(0, 20).map((p: any) => ({
      steamid64: toSteam64From32(p.account_id),
      account_id: p.account_id,
      personaname: p.personaname,
      similarity: p.similarity,
      avatarfull: p.avatarfull,
      last_match_time: p.last_match_time,
    }));
  } catch {
    return [] as any[];
  }
}

// ---------- route ----------
router.get("/resolve", async (req, res) => {
  const q = z.object({ input: z.string().min(1) }).safeParse(req.query);
  if (!q.success)
    return res.status(400).json({ error: { message: "Missing ?input" } });

  const parsed = parseInput(String(q.data.input));

  // Only auto-resolve when the input is an **ID**, not a name/vanity.
  if (parsed.kind === "steam64" || parsed.kind === "urlProfiles") {
    const steamid64 = parsed.steamid64;
    return res.json({
      steamid64,
      account_id: to32FromSteam64(steamid64),
      source: "exact",
    });
  }
  if (parsed.kind === "account32") {
    const steamid64 = toSteam64From32(parsed.accountId);
    return res.json({
      steamid64,
      account_id: parsed.accountId,
      source: "exact32",
    });
  }
  if (parsed.kind === "steam3") {
    const steamid64 = toSteam64From32(parsed.account32);
    return res.json({
      steamid64,
      account_id: parsed.account32,
      source: "steam3",
    });
  }
  if (parsed.kind === "steam2") {
    const account32 = parsed.accountNumber * 2 + parsed.authServer;
    const steamid64 = toSteam64From32(account32);
    return res.json({
      steamid64,
      account_id: String(account32),
      source: "steam2",
    });
  }

  // For **vanity URLs** (/id/<name>) and general **names**, ALWAYS return candidates.
  if (parsed.kind === "urlVanity" || parsed.kind === "name") {
    const key = parsed.kind === "urlVanity" ? parsed.vanity : parsed.q;
    const candidates = await searchOpenDota(key);
    return res.json({ source: "search", candidates });
  }

  return res
    .status(400)
    .json({ error: { message: "Unrecognized input format" } });
});

export default router;
