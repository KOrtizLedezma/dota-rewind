"use client";

import React from "react";
import { SnapSection } from "../common/SnapSection";

type SideStats = {
  matches: number;
  wins: number;
  winrate: number;
};

export interface SidesStreaksSplitSectionProps {
  radiant: SideStats;
  dire: SideStats;
  streaks?: { longest_win: number; longest_loss: number };
  className?: string;
  heading?: string;
}

export function SidesStreaksSplitSection({
  radiant,
  dire,
  streaks,
  className = "px-6",
  heading = "Sides & Streaks",
}: SidesStreaksSplitSectionProps) {
  return (
    <SnapSection className={className}>
      <div className="mx-auto max-w-6xl w-full">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <SideCard
              variant="radiant"
              label="Radiant"
              wins={radiant.wins}
              matches={radiant.matches}
              winrate={radiant.winrate}
            />
            <SideCard
              variant="dire"
              label="Dire"
              wins={dire.wins}
              matches={dire.matches}
              winrate={dire.winrate}
            />
          </div>

          {streaks && (
            <div className="mt-6 rounded-xl border border-white/10 bg-[#0e1116] p-4">
              <div className="flex flex-col md:flex-row items-stretch justify-around gap-3">
                <StreakCard
                  variant="win"
                  value={streaks.longest_win}
                  label="Longest Win Streak"
                />
                <StreakCard
                  variant="loss"
                  value={streaks.longest_loss}
                  label="Longest Loss Streak"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </SnapSection>
  );
}

/* ---------------- internals ---------------- */

function SideCard({
  variant,
  label,
  wins,
  matches,
  winrate,
}: {
  variant: "radiant" | "dire";
  label: string;
  wins: number;
  matches: number;
  winrate: number;
}) {
  const isRadiant = variant === "radiant";

  const titleGradient = isRadiant
    ? "bg-gradient-to-r from-[#22c55e] to-white"
    : "bg-gradient-to-r from-white to-[#ef4444]";

  const pctGradient = isRadiant
    ? "bg-gradient-to-r from-[#22c55e] to-white"
    : "bg-gradient-to-r from-white to-[#ef4444]";

  const logo = isRadiant ? <RadiantLogo /> : <DireLogo />;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0e1116] p-6 md:p-8">
      <div className="flex flex-col items-center justify-center text-center gap-4 min-h-[240px]">
        {/* Logo */}
        <div className="h-14 w-14">{logo}</div>

        {/* Title */}
        <div className="text-2xl md:text-3xl font-extrabold">
          <span className={`${titleGradient} bg-clip-text text-transparent`}>
            {label}
          </span>
        </div>

        {/* Percentage at bottom */}
        <div className="mt-2 text-4xl md:text-5xl font-extrabold">
          <span className={`${pctGradient} bg-clip-text text-transparent`}>
            {winrate.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function StreakCard({
  variant,
  value,
  label,
}: {
  variant: "win" | "loss";
  value: number;
  label: string;
}) {
  const grad =
    variant === "win"
      ? "bg-gradient-to-r from-[#22c55e] to-white"
      : "bg-gradient-to-r from-white to-[#ef4444]";

  return (
    <div className="flex-1 rounded-lg border border-white/10 bg-white/5 p-6 flex flex-col items-center justify-between text-center min-h-[140px]">
      <div className="text-5xl md:text-6xl font-extrabold leading-none">
        <span className={`${grad} bg-clip-text text-transparent`}>
          {Math.max(0, value)}
        </span>
      </div>
      <div className="mt-3 text-xs uppercase tracking-wider text-gray-400">
        {label}
      </div>
    </div>
  );
}

function RadiantLogo() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-full w-full"
      aria-hidden
      role="img"
      fill="none"
    >
      <defs>
        <linearGradient id="radGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#86efac" />
        </linearGradient>
      </defs>
      <rect
        x="6"
        y="10"
        width="52"
        height="44"
        rx="10"
        stroke="url(#radGrad)"
        strokeWidth="4"
      />
      <path
        d="M18 40l9-16 7 9 6-5 6 12"
        stroke="url(#radGrad)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DireLogo() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-full w-full"
      aria-hidden
      role="img"
      fill="none"
    >
      <defs>
        <linearGradient id="dirGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fecaca" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="22" stroke="url(#dirGrad)" strokeWidth="4" />
      <path
        d="M32 16c6 4 10 8 10 16s-4 12-10 16c-6-4-10-8-10-16s4-12 10-16Z"
        stroke="url(#dirGrad)"
        strokeWidth="3"
        fill="transparent"
      />
      <path d="M22 22l20 20" stroke="url(#dirGrad)" strokeWidth="3" />
    </svg>
  );
}
