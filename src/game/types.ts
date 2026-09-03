export type FactionId = 'helios' | 'azur' | 'ferrum';
export type ResKey = 'metal' | 'polymer' | 'electronics' | 'energy' | 'alloy' | 'core';
export type PartCat = 'chassis' | 'mobility' | 'reactor' | 'weapon' | 'defense' | 'utility';
export type Behavior = 'aggressive' | 'defensive' | 'support' | 'structures' | 'kite';
export type TerrType = 'district' | 'metal' | 'polymer' | 'electronics' | 'energy' | 'factory' | 'strategic' | 'landmark' | 'outpost' | 'park' | 'water';
export type OwnerId = FactionId | 'raiders' | null;

export interface Faction {
  id: FactionId; name: string; short: string; color: string; soft: string; desc: string; bonus: string;
}

export interface PartMods {
  hp?: number; armor?: number; shield?: number; shieldRegen?: number; dmg?: number; range?: number;
  speed?: number; rof?: number; acc?: number; energyCap?: number; energyRegen?: number; weight?: number;
  capacity?: number; detect?: number; repair?: number; aoe?: number; energyUse?: number; stealth?: number;
}

export interface Part {
  id: string; cat: PartCat; name: string; tier: 1 | 2 | 3; weight: number; mods: PartMods;
  cost: Partial<Record<ResKey | 'credits', number>>; desc: string; req?: { research?: string; eng?: number };
}

export interface Build { name: string; slots: Record<PartCat, string | null>; behavior: Behavior; }
export interface Robot { id: string; build: Build; condition: number; }

export interface Garrison { power: number; size: number; }

export interface Territory {
  id: string; q: number; r: number; x: number; y: number; name: string; type: TerrType; tier: number;
  owner: OwnerId; garrison: Garrison; defense: number; unclaimed: number; discovered: boolean;
  factoryId?: string; eventId?: string | null; capturedAt?: number; attackReadyAt?: number;
}

export interface GameEvent { id: string; hexId: string; kind: 'anomaly' | 'wreck' | 'convoy' | 'invasion'; expiresAt: number; }
export interface ProdJob { id: string; hexId: string; partId: string; startedAt: number; duration: number; }
export interface RepairJob { robotId: string; startedAt: number; duration: number; }
export interface ModuleJob { moduleId: string; startedAt: number; duration: number; }
export interface ChatMsg { id: string; author: string; self?: boolean; text: string; at: number; }
export interface LogEntry { id: string; at: number; kind: 'info' | 'combat' | 'econ' | 'alert'; text: string; }

export interface DailyState { date: string; counters: Record<string, number>; claimed: string[]; }

export interface MissionDef {
  id: string; title: string; metric: string; target: number;
  reward: { credits?: number; res?: Partial<Record<ResKey, number>>; xp?: number; part?: string };
}

export interface ResearchNode {
  id: string; branch: 'weapon' | 'armor' | 'mobility' | 'production' | 'energy'; tier: 1 | 2 | 3;
  name: string; desc: string; cost: Partial<Record<ResKey | 'credits', number>>; time: number; requires?: string;
}

export interface RobotStats {
  hp: number; armor: number; shield: number; shieldRegen: number; dmg: number; range: number; speed: number;
  rof: number; acc: number; energyCap: number; energyRegen: number; energyUse: number; weight: number;
  capacity: number; detect: number; repair: number; aoe: number; stealth: number; archetype: string; overloaded: boolean;
}

export interface Recipe { partId: string; input: Partial<Record<ResKey, number>>; time: number; req?: string; }

export interface AchievementDef { id: string; name: string; desc: string; metric: string; target: number; reward: number; }

export interface GameState {
  v: number; startedAt: number; now: number; lastTick: number;
  profile: { name: string; faction: FactionId | null; level: number; xp: number; engXp: number; engLevel: number };
  credits: number; res: Record<ResKey, number>;
  pos: { x: number; y: number }; heading: number;
  terrs: Territory[];
  robots: Robot[];
  inv: Record<string, number>;
  prod: ProdJob[];
  research: { id: string; startedAt: number; duration: number } | null;
  researched: string[];
  base: { hexId: string | null; modules: Record<string, number>; shieldUntil: number; repairs: RepairJob[]; upgrades: ModuleJob[] };
  events: GameEvent[];
  daily: DailyState;
  ops: { step: number; done: boolean; claimed: number[] };
  stats: Record<string, number>;
  onboard: { done: boolean; dismissed: boolean };
  alliance: { contrib: number; chat: ChatMsg[]; weeklyClaimed: boolean; lastSupport: number };
  achievements: string[];
  settings: { notifProd: boolean; notifCombat: boolean; notifEvents: boolean; notifDaily: boolean; speed: 1 | 4 | 12; gps: boolean };
  log: LogEntry[];
  buffs: { supportUntil: number };
  aiNext: number; chatNext: number; eventNext: number; raidShieldUntil: number;
}
