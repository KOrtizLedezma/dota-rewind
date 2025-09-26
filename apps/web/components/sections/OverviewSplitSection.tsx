import React from "react";
import { SnapSection } from "../common/SnapSection";

export interface OverviewTotals {
  matches: number;
  wins: number;
  winrate: number;
  playtime_hours: number;
  avg_gpm: number;
  avg_xpm: number;
  avg_hero_damage: number;
  avg_last_hits: number;
  avg_denies: number;
}

export function OverviewSplitSection({
  totals,
  className = "px-6",
  heading = "Overview",
}: {
  totals: OverviewTotals;
  className?: string;
  heading?: string;
}) {
  const msg = `You’ve played ${fmtInt(totals.matches)} matches and won ${fmtInt(
    totals.wins
  )} (${totals.winrate.toFixed(
    2
  )}% winrate), across ${totals.playtime_hours.toFixed(2)} hours of play.`;

  return (
    <SnapSection className={className}>
      <div className="mx-auto max-w-6xl w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className=" flex justify-center align-middle text-xl md:text-2xl leading-relaxed text-gray-200">
              {msg}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BigStat label="Avg GPM" value={totals.avg_gpm} decimals={0} />
            <BigStat label="Avg XPM" value={totals.avg_xpm} decimals={0} />
            <BigStat
              label="Avg Hero Dmg"
              value={totals.avg_hero_damage}
              decimals={0}
            />
            <BigStat
              label="Avg Last Hits"
              value={totals.avg_last_hits}
              decimals={1}
            />
            <BigStat
              label="Avg Denies"
              value={totals.avg_denies}
              decimals={1}
            />
          </div>
        </div>
      </div>
    </SnapSection>
  );
}

/* ---------------- helpers ---------------- */

function BigStat({
  label,
  value,
  decimals = 0,
}: {
  label: string;
  value: number;
  decimals?: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs flex justify-center uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className=" flex justify-center mt-2 text-4xl md:text-5xl font-extrabold">
        <span className="bg-gradient-to-r from-[#ff3b30] via-[#ff7a18] to-[#ffd166] bg-clip-text text-transparent">
          {fmtNum(value, decimals)}
        </span>
      </div>
    </div>
  );
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString();
}

function fmtNum(n: number, decimals = 0) {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
