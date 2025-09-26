"use client";

import { useState } from "react";
import { motion } from "framer-motion";

// Simple landing page with an animated title and a username/vanity/URL input.
// It resolves using your API: http://localhost:3001/v1/resolve?input=...
// On a single strong match or exact input it redirects to /player/[steamid64].
// Otherwise it shows the top candidates inline to pick from.

const API_BASE = "http://localhost:3001";

type Candidate = {
  steamid64: string;
  account_id: number;
  personaname?: string;
  similarity?: number;
  avatarfull?: string;
  last_match_time?: string;
};

type ResolveResponse =
  | { steamid64: string; account_id: string; source: string }
  | { source: string; candidates: Candidate[] }
  | { error: { message: string } };

export default function HomePage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);

  async function onResolve() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setCandidates(null);
    try {
      const r = await fetch(
        `${API_BASE}/v1/resolve?input=${encodeURIComponent(input.trim())}`
      );
      const json: ResolveResponse = await r.json();
      if ("error" in json) {
        setError(json.error.message || "Could not resolve input");
        return;
      }
      if ("steamid64" in json) {
        window.location.href = `/player/${json.steamid64}`;
        return;
      }
      if ("candidates" in json) {
        setCandidates(json.candidates);
        if (json.candidates?.length === 1) {
          window.location.href = `/player/${json.candidates[0].steamid64}`;
        }
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  function useCandidate(steamid64: string) {
    window.location.href = `/player/${steamid64}`;
  }

  return (
    <div className="min-h-screen bg-[#0b0d10] text-gray-200 flex flex-col">
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl opacity-30"
          style={{
            background:
              "radial-gradient(45% 45% at 50% 50%, #d23b34 0%, rgba(210,59,52,0) 70%)",
          }}
        />
        <div
          className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-30"
          style={{
            background:
              "radial-gradient(45% 45% at 50% 50%, #e8891a 0%, rgba(232,137,26,0) 70%)",
          }}
        />
      </div>

      <main className="relative flex-1 grid place-items-center px-6">
        <div className="w-full max-w-2xl">
          <motion.h1
            className="text-center text-5xl md:text-6xl font-extrabold tracking-tight"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span className="bg-gradient-to-r from-[#ff3b30] via-[#ff7a18] to-[#ffd166] bg-clip-text text-transparent">
              DOTA REVIEW
            </span>
          </motion.h1>
          <motion.p
            className="mt-4 text-center text-sm md:text-base text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.6 }}
          >
            Paste your Steam profile URL, SteamID, friend ID, or username/vanity
            to begin.
          </motion.p>

          <motion.div
            className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <div className="flex items-center gap-3">
              <input
                className="flex-1 rounded-xl bg-[#0f1216] border border-[#1b1f26] focus:border-[#ff5a36] outline-none px-4 py-3 text-sm md:text-base placeholder:text-gray-500 transition"
                placeholder="e.g. https://steamcommunity.com/id/yourname or Dendi"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onResolve()}
              />
              <button
                onClick={onResolve}
                disabled={loading || !input.trim()}
                className="rounded-xl px-4 py-3 text-sm md:text-base font-medium bg-[#ff5a36] hover:bg-[#ff6f3f] disabled:opacity-50 disabled:cursor-not-allowed transition text-black"
              >
                {loading ? "Resolving…" : "Show my review"}
              </button>
            </div>
            {error && <div className="mt-3 text-sm text-red-400">{error}</div>}

            {candidates && candidates.length > 0 && (
              <div className="mt-5 grid gap-2">
                <div className="text-xs text-gray-400">
                  Multiple possible matches found — pick yours:
                </div>
                {candidates.slice(0, 6).map((c) => (
                  <div
                    key={c.steamid64}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.avatarfull || ""}
                      alt=""
                      className="h-10 w-10 rounded"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {c.personaname || "(unknown name)"}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        SteamID64: {c.steamid64} • Similarity:{" "}
                        {(c.similarity ?? 0).toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => useCandidate(c.steamid64)}
                      className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-sm"
                    >
                      Use
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-gray-500">
        Powered by OpenDota • This project is not affiliated with Valve
      </footer>
    </div>
  );
}
