// Summary types based on OpenDota API response

export type Totals = {
  matches: number;
  wins: number;
  winrate: number;
  playtime_hours: number;
  total_hero_damage: number;
  avg_hero_damage: number;
  total_tower_damage: number;
  avg_gpm: number;
  avg_xpm: number;
  avg_last_hits: number;
  avg_denies: number;
};

export type Side = { matches: number; wins: number; winrate: number };

export type RecordKill = {
  match_id: number;
  kills: number;
  hero_id: number;
  start_time: number;
  hero_name: string;
} | null;

export type RecordDeath = {
  match_id: number;
  deaths: number;
  hero_id: number;
  start_time: number;
  hero_name: string;
} | null;

export type RecordAssist = {
  match_id: number;
  assists: number;
  hero_id: number;
  start_time: number;
  hero_name: string;
} | null;

export type RecordGpm = {
  match_id: number;
  gpm: number;
  hero_id: number;
  start_time: number;
  hero_name: string;
} | null;

export type RecordXpm = {
  match_id: number;
  xpm: number;
  hero_id: number;
  start_time: number;
  hero_name: string;
} | null;

export type HeroRow = {
  hero_id: number;
  name: string;
  matches: number;
  wins: number;
  winrate: number;
  avg_k: number;
  avg_d: number;
  avg_a: number;
  kda: number;
};

export type LaneRow = {
  lane: string;
  matches: number;
  wins: number;
  winrate: number;
};

export type Histogram = { bucket: number; count: number }[];

export type DeepMeta = {
  attempted: number;
  with_details: number;
  parse_requested: number;
};

// OpenDota heroes
export type HeroAPI = {
  id: number;
  name: string;
  localized_name: string;
  img: string;
  icon: string;
};

export interface SummaryResponse {
  filters: { range: string; queue: string; days: number; deep_used: number };
  warnings: string[];
  totals: Totals;
  sides: { radiant: Side; dire: Side };
  streaks: { longest_win: number; longest_loss: number };
  records: {
    most_kills: RecordKill;
    most_deaths: RecordDeath;
    most_assists: RecordAssist;
    best_gpm: RecordGpm;
    best_xpm: RecordXpm;
  };
  heroes: { top3: HeroRow[]; diversity: number };
  lanes: LaneRow[];
  histograms: { gpm: Histogram; xpm: Histogram; step: number };
  deep: {
    meta?: DeepMeta;
    wards: {
      obs_placed: number;
      sen_placed: number;
      obs_killed: number;
      sen_killed: number;
      per_game: {
        obs_placed: number;
        sen_placed: number;
        obs_killed: number;
        sen_killed: number;
      };
    };
    healing: number;
    stuns: number;
    purchases: { smoke: number; dust: number; obs: number; sen: number };
    farm_profile: {
      early_gpm: number;
      mid_gpm: number;
      late_gpm: number;
      matches_used: number;
    };
  };
  solo_vs_party: { solo: Side; party: Side };
}
