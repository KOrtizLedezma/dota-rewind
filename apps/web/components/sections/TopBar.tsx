import React from "react";

type TopBarProps = {
  steamid64: string;
};

const TopBar: React.FC<TopBarProps> = ({ steamid64 }) => (
  <div className="fixed top-0 left-0 right-0 z-40">
    <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
      <a href="/" className="text-sm text-gray-400 hover:text-white transition">
        ← Back
      </a>
      <div className="text-xs text-gray-500 font-mono">{steamid64}</div>
    </div>
  </div>
);

export default TopBar;
