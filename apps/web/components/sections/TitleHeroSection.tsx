"use client";

import React from "react";
import { motion } from "framer-motion";
import { SnapSection } from "../common/SnapSection";

export interface TitleHeroSectionProps {
  subtitle: string;
  heading?: string;
  lastUpdated?: string | null;
  error?: string | null;
  noData?: boolean;
  className?: string;
}

export function TitleHeroSection({
  subtitle,
  heading = "Your Dota Review",
  lastUpdated,
  error,
  noData,
  className = "px-6",
}: TitleHeroSectionProps) {
  return (
    <SnapSection className={className}>
      <div className="mx-auto max-w-6xl w-full h-full grid place-items-center text-center">
        <div>
          <motion.h1
            className="text-4xl md:text-6xl font-extrabold"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span className="bg-gradient-to-r from-[#ff3b30] via-[#ff7a18] to-[#ffd166] bg-clip-text text-transparent">
              {heading}
            </span>
          </motion.h1>

          <div className="mt-2 text-sm text-gray-400">{subtitle}</div>

          {lastUpdated && (
            <div className="mt-1 text-xs text-gray-500">
              Last updated: {lastUpdated}
            </div>
          )}

          {error && <div className="mt-4 text-red-400">{error}</div>}

          {noData && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-gray-300">
              No matches found.
            </div>
          )}
        </div>
      </div>
    </SnapSection>
  );
}
