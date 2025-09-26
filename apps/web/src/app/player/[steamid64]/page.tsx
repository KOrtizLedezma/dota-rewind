// apps/web/app/player/[steamid64]/page.tsx
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, useInView } from "framer-motion";

import type {
  SummaryResponse,
  HeroAPI,
  Histogram,
} from "../../../../types/summary";
import TopBar from "../../../../components/sections/TopBar";
import { TitleHeroSection } from "../../../../components/sections/TitleHeroSection";
import { SnapSection } from "../../../../components/common/SnapSection";
import { OverviewSplitSection } from "../../../../components/sections/OverviewSplitSection";
import { SidesStreaksSplitSection } from "../../../../components/sections/SidesStreakSplitSection";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

/* ----------------- tiny UI helpers ----------------- */
function LoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0b0d10]">
      <div className="flex flex-col items-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#ff5a36]" />
        <div className="mt-4 text-sm text-gray-300">
          Building your Dota Review…
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-gray-300 mb-3">{children}</div>;
}

function Reveal({
  children,
  y = 16,
  delay = 0,
}: {
  children: React.ReactNode;
  y?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

function BarList({ data, label }: { data: Histogram; label: string }) {
  const max = data.reduce((m, d) => Math.max(m, d.count), 0);
  if (!data.length)
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-gray-400">No {label} data</div>
      </div>
    );
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm mb-2 text-gray-300">{label}</div>
      <div className="space-y-2">
        {data.map((b) => {
          const pct = max ? Math.round((b.count / max) * 100) : 0;
          return (
            <div key={b.bucket} className="flex items-center gap-3">
              <div className="w-16 text-xs text-gray-400 tabular-nums">
                {b.bucket}+
              </div>
              <div className="h-3 flex-1 rounded bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[#ff5a36]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="w-8 text-right text-xs text-gray-400 tabular-nums">
                {b.count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function matchLink(id?: number) {
  return id ? `https://www.opendota.com/matches/${id}` : "#";
}

/* ----------------- constants ----------------- */
type RangeKey = "last_month" | "last_6_months" | "last_year";
type QueueKey = "all" | "turbo" | "ranked" | "normal";

const DEFAULT_RANGE: RangeKey = "last_year";
const DEFAULT_QUEUE: QueueKey = "all";
const DEFAULT_DEEP = 12;
const DEFAULT_PARSE = false;

/* ----------------- page ----------------- */
export default function PlayerSummarySnapPage() {
  const params = useParams<{ steamid64: string }>();
  const steamid64 = params?.steamid64;

  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Hero map for icons
  const [heroMap, setHeroMap] = useState<Record<number, HeroAPI>>({});
  useEffect(() => {
    let mounted = true;
    fetch("https://api.opendota.com/api/heroes")
      .then((r) => r.json())
      .then((arr: HeroAPI[]) => {
        if (!mounted) return;
        const map: Record<number, HeroAPI> = {};
        for (const h of arr) map[h.id] = h;
        setHeroMap(map);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  function heroImgUrl(hid?: number) {
    if (!hid || !heroMap[hid]) return null;
    const h = heroMap[hid];
    return `https://cdn.cloudflare.steamstatic.com${h.icon || h.img}`;
  }

  // initial fetch on mount with fixed defaults
  useEffect(() => {
    if (!steamid64) return;
    void fetchWith(DEFAULT_RANGE, DEFAULT_QUEUE, DEFAULT_DEEP, DEFAULT_PARSE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steamid64]);

  async function fetchWith(
    rng: RangeKey,
    que: QueueKey,
    deep: number,
    parse: boolean
  ) {
    if (!steamid64) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const url = `${API_BASE}/v1/players/${steamid64}/summary-advanced?range=${rng}&queue=${que}&deepLimit=${deep}${
        parse ? "&parse=1" : ""
      }`;
      const r = await fetch(url);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
      setData(j);
      setLastUpdated(new Date().toLocaleString());
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const title = useMemo(() => "All • Last Year", []);
  const noData: boolean = !!data && data.totals.matches === 0;

  return (
    <div className="min-h-screen bg-[#0b0d10] text-gray-200">
      <LoadingOverlay visible={loading} />

      <TopBar steamid64={steamid64 || "unknown"} />

      <main className="snap-y snap-mandatory">
        {/* Section 1: Title only*/}
        <TitleHeroSection
          subtitle={title}
          lastUpdated={lastUpdated}
          error={error}
          noData={noData}
        />

        {/* Section 2: Overview */}
        {data && <OverviewSplitSection totals={data.totals} />}

        {/* Section 3: Sides & Streaks */}
        {data && (
          <SidesStreaksSplitSection
            radiant={data.sides.radiant}
            dire={data.sides.dire}
            streaks={data.streaks}
          />
        )}

        {/* Section 4: Records */}
        <SnapSection className="px-6">
          <div className="mx-auto max-w-6xl w-full">
            <SectionTitle>Records</SectionTitle>
            {data && (
              <Reveal>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  <RecordCard
                    title="Most Kills"
                    v={data.records.most_kills?.kills}
                    hero={data.records.most_kills?.hero_name}
                    img={heroImgUrl(data.records.most_kills?.hero_id)}
                    link={matchLink(data.records.most_kills?.match_id)}
                  />
                  <RecordCard
                    title="Most Deaths"
                    v={data.records.most_deaths?.deaths}
                    hero={data.records.most_deaths?.hero_name}
                    img={heroImgUrl(data.records.most_deaths?.hero_id)}
                    link={matchLink(data.records.most_deaths?.match_id)}
                  />
                  <RecordCard
                    title="Most Assists"
                    v={data.records.most_assists?.assists}
                    hero={data.records.most_assists?.hero_name}
                    img={heroImgUrl(data.records.most_assists?.hero_id)}
                    link={matchLink(data.records.most_assists?.match_id)}
                  />
                  <RecordCard
                    title="Best GPM"
                    v={data.records.best_gpm?.gpm}
                    hero={data.records.best_gpm?.hero_name}
                    img={heroImgUrl(data.records.best_gpm?.hero_id)}
                    link={matchLink(data.records.best_gpm?.match_id)}
                  />
                  <RecordCard
                    title="Best XPM"
                    v={data.records.best_xpm?.xpm}
                    hero={data.records.best_xpm?.hero_name}
                    img={heroImgUrl(data.records.best_xpm?.hero_id)}
                    link={matchLink(data.records.best_xpm?.match_id)}
                  />
                </div>
              </Reveal>
            )}
          </div>
        </SnapSection>

        {/* Section 5: Top Heroes */}
        <SnapSection className="px-6">
          <div className="mx-auto max-w-6xl w-full">
            <SectionTitle>Top Heroes</SectionTitle>
            {data && (
              <Reveal>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {data.heroes.top3.map((h) => (
                    <div
                      key={h.hero_id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={heroImgUrl(h.hero_id) || ""}
                        alt=""
                        className="h-10 w-10 rounded mb-2"
                      />
                      <div className="text-base font-semibold">{h.name}</div>
                      <div className="mt-0.5 text-xs text-gray-400">
                        {h.wins}/{h.matches} • {h.winrate.toFixed(1)}% win
                      </div>
                      <div className="mt-3 text-sm text-gray-300">
                        K/D/A avg
                      </div>
                      <div className="text-xl font-semibold">
                        {h.avg_k.toFixed(1)} / {h.avg_d.toFixed(1)} /{" "}
                        {h.avg_a.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">
                        KDA {h.kda.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            )}
          </div>
        </SnapSection>

        {/* Section 6: Lanes */}
        <SnapSection className="px-6">
          <div className="mx-auto max-w-6xl w-full">
            <SectionTitle>Lanes</SectionTitle>
            {data && (
              <Reveal>
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/5 text-left text-gray-400">
                      <tr>
                        <th className="px-4 py-2">Lane</th>
                        <th className="px-4 py-2">Matches</th>
                        <th className="px-4 py-2">Wins</th>
                        <th className="px-4 py-2">Winrate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lanes.map((l) => (
                        <tr
                          key={l.lane}
                          className="odd:bg-white/0 even:bg-white/[0.03]"
                        >
                          <td className="px-4 py-2 capitalize">{l.lane}</td>
                          <td className="px-4 py-2">{l.matches}</td>
                          <td className="px-4 py-2">{l.wins}</td>
                          <td className="px-4 py-2">{l.winrate.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            )}
          </div>
        </SnapSection>

        {/* Section 7: Distributions */}
        <SnapSection className="px-6">
          <div className="mx-auto max-w-6xl w-full">
            <SectionTitle>Distributions</SectionTitle>
            {data && (
              <Reveal>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <BarList data={data.histograms.gpm} label="GPM Histogram" />
                  <BarList data={data.histograms.xpm} label="XPM Histogram" />
                </div>
              </Reveal>
            )}
          </div>
        </SnapSection>

        {/* Section 8: Deep Stats & Solo vs Party */}
        <SnapSection className="px-6">
          <div className="mx-auto max-w-6xl w-full space-y-6">
            <SectionTitle>Deep Stats</SectionTitle>
            {data && (
              <>
                <Reveal>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-sm text-gray-400">Wards</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          Obs placed:{" "}
                          <span className="text-gray-100">
                            {data.deep.wards.obs_placed}
                          </span>
                        </div>
                        <div>
                          Sen placed:{" "}
                          <span className="text-gray-100">
                            {data.deep.wards.sen_placed}
                          </span>
                        </div>
                        <div>
                          Obs killed:{" "}
                          <span className="text-gray-100">
                            {data.deep.wards.obs_killed}
                          </span>
                        </div>
                        <div>
                          Sen killed:{" "}
                          <span className="text-gray-100">
                            {data.deep.wards.sen_killed}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Per game — O:{data.deep.wards.per_game.obs_placed} / S:
                        {data.deep.wards.per_game.sen_placed} / OK:
                        {data.deep.wards.per_game.obs_killed} / SK:
                        {data.deep.wards.per_game.sen_killed}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                      <div className="text-sm text-gray-400">Other</div>
                      <div className="text-sm">
                        Healing:{" "}
                        <span className="text-gray-100">
                          {data.deep.healing}
                        </span>
                      </div>
                      <div className="text-sm">
                        Stuns:{" "}
                        <span className="text-gray-100">{data.deep.stuns}</span>
                      </div>
                      <div className="text-sm">
                        Purchases:{" "}
                        <span className="text-gray-100">
                          Smoke {data.deep.purchases.smoke}, Dust{" "}
                          {data.deep.purchases.dust}, Obs{" "}
                          {data.deep.purchases.obs}, Sen{" "}
                          {data.deep.purchases.sen}
                        </span>
                      </div>
                      <div className="text-sm">
                        Farm profile (avg):{" "}
                        <span className="text-gray-100">
                          Early {Math.round(data.deep.farm_profile.early_gpm)} /
                          Mid {Math.round(data.deep.farm_profile.mid_gpm)} /
                          Late {Math.round(data.deep.farm_profile.late_gpm)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Reveal>

                <SectionTitle>Solo vs Party</SectionTitle>
                <Reveal>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-sm text-gray-400">Solo</div>
                      <div className="mt-1 text-2xl font-semibold">
                        {data.solo_vs_party.solo.wins}/
                        {data.solo_vs_party.solo.matches}
                      </div>
                      <div className="text-xs text-gray-500">
                        {data.solo_vs_party.solo.winrate.toFixed(2)}%
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-sm text-gray-400">Party</div>
                      <div className="mt-1 text-2xl font-semibold">
                        {data.solo_vs_party.party.wins}/
                        {data.solo_vs_party.party.matches}
                      </div>
                      <div className="text-xs text-gray-500">
                        {data.solo_vs_party.party.winrate.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </Reveal>

                {data.warnings?.length > 0 && (
                  <div className="text-xs text-amber-300/80">
                    {data.warnings.join(" ")}
                  </div>
                )}
              </>
            )}
          </div>
        </SnapSection>

        {/* Footer section */}
        <SnapSection>
          <div className="mx-auto max-w-6xl px-6 w-full h-full grid place-items-center">
            <div className="text-center text-xs text-gray-500">
              Powered by OpenDota • Not affiliated with Valve
            </div>
          </div>
        </SnapSection>
      </main>
    </div>
  );
}

/* small presentational card used in Records */
function RecordCard({
  title,
  v,
  hero,
  img,
  link,
}: {
  title: string;
  v?: number;
  hero?: string;
  img: string | null;
  link: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wider text-gray-400">
        {title}
      </div>
      <div className="mt-1 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img || ""} alt="" className="h-8 w-8 rounded" />
        <div className="text-2xl font-semibold">{v ?? "-"}</div>
      </div>
      <div className="text-xs text-gray-500 mt-1 truncate">{hero || ""}</div>
      <a
        href={link}
        target="_blank"
        className="text-xs underline text-gray-400 mt-2 inline-block"
      >
        Open match
      </a>
    </div>
  );
}
