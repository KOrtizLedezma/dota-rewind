// SteamID64 -> 32-bit account_id used by OpenDota
export function toAccountId(steamid64: string): string {
  // 76561197960265728 offset
  return (BigInt(steamid64) - 76561197960265728n).toString();
}

// Determine if the player was Radiant from player_slot
export function isRadiant(player_slot: number): boolean {
  // In Dota, slots 0-127 are Radiant, 128-255 are Dire
  return player_slot < 128;
}
