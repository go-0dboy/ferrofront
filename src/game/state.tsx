import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';
import type { FactionId, GameState, ResKey, Robot, ChatMsg } from './types';
import {
  generateWorld, FACTIONS, STARTER_INV, rateFor, lootFor, uid, todayStr, incomeCapMult, prodSpeed, prodSlots,
  RESEARCH_MAP, researchSpeed, MODULES, moduleCost, maxRobots, repairSlots, repairCostMult, repairSpeedMult,
  baseDefense, DAILY_POOL, WEEKLY_POOL, WALK_MILESTONES, OPS_CHAIN, ACHIEVEMENTS, PART_MAP, RECIPES, revealRadius,
  neighborIds, CHAT_POOL, ALLIANCE_MEMBERS, xpForLevel, terrAt, weekStr, ATTACK_ENERGY_COST, DEPLOY_ENERGY_MAX,
} from './data';
import type { Territory } from './types';

const SAVE_KEY = 'ferrofront_save_v2';

export interface Toast { id: string; title: string; sub?: string; kind: 'ok' | 'warn' | 'info' | 'combat'; }

function dailyMissionsFor(date: string) {
  let h = 0;
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) | 0;
  const pool = [...DAILY_POOL];
  const out = [];
  for (let i = 0; i < 5 && pool.length; i++) out.push(pool.splice(Math.abs(h >> (i * 3)) % pool.length, 1)[0]);
  return out;
}

function freshState(name: string, faction: FactionId): GameState {
  const { terrs } = generateWorld(7);
  const home = terrs.find((t) => t.owner === faction)!;
  const now = Date.now();
  let disc = 0;
  for (const t of terrs) if (Math.hypot(t.x - home.x, t.y - home.y) < 430) { t.discovered = true; disc++; }
  const chat: ChatMsg[] = [
    { id: uid(), author: 'кмд. Волкова', text: `Добро пожаловать в ряды, ${name}. Сектор ждёт.`, at: now - 300000 },
    { id: uid(), author: 'инж. Соколов', text: 'Собери меха в гараже и захвати ближайшую нейтральную зону.', at: now - 120000 },
  ];
  return {
    v: 2, startedAt: now, now, lastTick: now,
    profile: { name, faction, level: 1, xp: 0, engXp: 0, engLevel: 1 },
    credits: 500,
    res: { metal: 150, polymer: 100, electronics: 60, energy: 50, alloy: 0, core: 0 },
    deployEnergy: DEPLOY_ENERGY_MAX,
    pos: { x: home.x, y: home.y }, heading: 0,
    terrs, robots: [], squads: [], inv: { ...STARTER_INV },
    prod: [], research: null, researched: [],
    base: { hexId: home.id, modules: { hq: 1, garage: 1, storage: 1, generator: 1, turrets: 1, radar: 1, lab: 1, workshop: 1, shieldgen: 1 }, shieldUntil: now + 6 * 3600e3, repairs: [], upgrades: [] },
    events: [],
    daily: { date: todayStr(), counters: {}, claimed: [] },
    weekly: { week: weekStr(), counters: {}, claimed: [] },
    maxCluster: 2,
    ops: { step: 0, done: false, claimed: [] },
    stats: { walkM: 0, steps: 0, wins: 0, losses: 0, captures: 0, kills: 0, crafted: 0, built: 0, incomeCollected: 0, discovered: disc, dailyWalk: 0, dailySteps: 0, dailyCaptures: 0, dailyWins: 0, dailyCraft: 0, dailyIncome: 0, dailyDisc: 0, dailyRepair: 0, dailyAbilities: 0, dailyReinforce: 0, defended: 0, eventsDone: 0, reinforced: 0, baseUp2: 0, outpostCaptured: 0, researchDone: 0, creditsPeak: 500, upgradesDone: 0, landmarks: 0 },
    onboard: { done: false, dismissed: false },
    alliance: { contrib: 0, chat, weeklyClaimed: false, lastSupport: 0 },
    achievements: [],
    settings: { notifProd: true, notifCombat: true, notifEvents: true, notifDaily: true, speed: 4, gps: false },
    log: [{ id: uid(), at: now, kind: 'info', text: `Командир ${name} вступил в ${FACTIONS[faction].name}. Штаб развёрнут: «${home.name}».` }],
    buffs: { supportUntil: 0 },
    aiNext: now + 30000, chatNext: now + 40000, eventNext: now + 25000, raidShieldUntil: 0,
  };
}

type Action = { type: string; [k: string]: unknown };

const pushLog = (s: GameState, kind: 'info' | 'combat' | 'econ' | 'alert', text: string) => {
  s.log = [{ id: uid(), at: s.now, kind, text }, ...s.log].slice(0, 60);
};
const qToast = (s: GameState, title: string, kind: Toast['kind'] = 'info', sub?: string) => {
  (s as GameState & { _toasts?: Toast[] })._toasts = [...((s as GameState & { _toasts?: Toast[] })._toasts ?? []), { id: uid(), title, sub, kind }];
};
const addXp = (s: GameState, v: number) => {
  s.profile.xp += v;
  while (s.profile.xp >= xpForLevel(s.profile.level)) {
    s.profile.xp -= xpForLevel(s.profile.level); s.profile.level++;
    s.credits += 200;
    qToast(s, `Уровень ${s.profile.level}!`, 'ok', '+200 кредитов');
    pushLog(s, 'info', `Достигнут уровень командира ${s.profile.level}.`);
  }
};
const addEngXp = (s: GameState, v: number) => {
  s.profile.engXp += v;
  const need = (l: number) => Math.round(90 * Math.pow(l, 1.4));
  while (s.profile.engXp >= need(s.profile.engLevel)) {
    s.profile.engXp -= need(s.profile.engLevel); s.profile.engLevel++;
    qToast(s, `Инженерный уровень ${s.profile.engLevel}`, 'ok', 'Открываются новые компоненты');
  }
};
const inc = (s: GameState, life: string, daily: string | null, v = 1) => {
  s.stats[life] = (s.stats[life] ?? 0) + v;
  if (daily) s.daily.counters[daily] = (s.daily.counters[daily] ?? 0) + v;
};
const payRes = (s: GameState, cost: Partial<Record<ResKey | 'credits', number>>): boolean => {
  if ((cost.credits ?? 0) > s.credits) return false;
  for (const [k, v] of Object.entries(cost)) {
    if (k !== 'credits' && (v ?? 0) > s.res[k as ResKey]) return false;
  }
  s.credits -= cost.credits ?? 0;
  for (const [k, v] of Object.entries(cost)) {
    if (k !== 'credits') s.res[k as ResKey] -= v ?? 0;
  }
  return true;
};
const grant = (s: GameState, r: { credits?: number; res?: Partial<Record<ResKey, number>>; xp?: number; part?: string }) => {
  if (r.credits) s.credits += r.credits;
  if (r.res) for (const [k, v] of Object.entries(r.res)) s.res[k as ResKey] += v ?? 0;
  if (r.xp) addXp(s, r.xp);
  if (r.part) s.inv[r.part] = (s.inv[r.part] ?? 0) + 1;
};
const isNight = () => { const h = new Date().getHours(); return h >= 23 || h < 7; };
/** размер крупнейшего связного кластера зон фракции */
const largestCluster = (s: GameState, f: FactionId): number => {
  const own = new Set(s.terrs.filter((t) => t.owner === f).map((t) => t.id));
  const byKey = new Map(s.terrs.map((t) => [t.id, t]));
  const seen = new Set<string>();
  let best = 0;
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  for (const start of own) {
    if (seen.has(start)) continue;
    let size = 0;
    const stack = [start];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id); size++;
      const t = byKey.get(id);
      if (!t) continue;
      for (const [dq, dr] of dirs) {
        const nk = `${t.q + dq},${t.r + dr}`;
        if (own.has(nk) && !seen.has(nk)) stack.push(nk);
      }
    }
    best = Math.max(best, size);
  }
  return best;
};
/** бонус производства за связную сеть территорий */
export const networkBonus = (cluster: number) => (cluster >= 10 ? 0.15 : cluster >= 5 ? 0.1 : cluster >= 3 ? 0.05 : 0);

function reducer(state: GameState, a: Action): GameState {
  const s: GameState & { _toasts?: Toast[] } = structuredClone(state);
  switch (a.type) {
    case 'NEW_GAME': return freshState(a.name as string, a.faction as FactionId);

    case 'TICK': {
      const now = a.now as number;
      const dt = Math.min((now - s.lastTick) / 1000, 8 * 3600);
      s.now = now; s.lastTick = now;
      // доход территорий
      const capMult = incomeCapMult(s);
      const netBonus = 1 + networkBonus(s.maxCluster);
      for (const t of s.terrs) {
        if (t.owner !== s.profile.faction) continue;
        const r = rateFor(t);
        let bonus = netBonus;
        if (t.type === 'strategic') bonus = netBonus;
        for (const n of neighborIds(t, s.terrs)) if (n.owner === s.profile.faction && n.type === 'strategic') bonus += 0.15;
        const cap = r.credits * 45 * capMult;
        t.unclaimed = Math.min(cap, t.unclaimed + r.credits * bonus * (dt / 60));
        if (r.res && r.amount) {
          const rc = r.amount * 45 * capMult;
          t.unclaimed = Math.min(9999, t.unclaimed);
          s.res[r.res] = Math.min(99999, s.res[r.res]); // страховка
          const key = `_${r.res}`;
          const cur = (s as unknown as Record<string, number>)[key] ?? 0;
          void cur;
          // ресурсные зоны копят в unclaimed отдельным пулом через defense-поле не требуется: упрощённо — в общий пул
          s.res[r.res] = Math.min(99999, s.res[r.res] + r.amount * bonus * (dt / 60) * 0.35);
          void rc; void key;
        }
      }
      // энергия развёртывания: базовая regen + бонус от энергоподстанций
      const eZones = s.terrs.filter((t) => t.owner === s.profile.faction && t.type === 'energy').length;
      s.deployEnergy = Math.min(DEPLOY_ENERGY_MAX, s.deployEnergy + (dt / 22) * (1 + 0.35 * eZones));
      // производство
      s.prod = s.prod.filter((j) => {
        if (j.startedAt + j.duration <= now) {
          s.inv[j.partId] = (s.inv[j.partId] ?? 0) + 1;
          inc(s, 'crafted', 'dailyCraft');
          s.weekly.counters.weekCraft = (s.weekly.counters.weekCraft ?? 0) + 1;
          addEngXp(s, 12); addXp(s, 15);
          pushLog(s, 'econ', `Завод изготовил: ${PART_MAP[j.partId]?.name ?? j.partId}.`);
          if (s.settings.notifProd) qToast(s, 'Производство завершено', 'ok', PART_MAP[j.partId]?.name);
          return false;
        }
        return true;
      });
      // исследования
      if (s.research && s.research.startedAt + s.research.duration <= now) {
        s.researched.push(s.research.id);
        inc(s, 'researchDone', null);
        pushLog(s, 'info', `Исследование завершено: ${RESEARCH_MAP[s.research.id].name}.`);
        qToast(s, 'Исследование завершено', 'ok', RESEARCH_MAP[s.research.id].name);
        s.research = null;
      }
      // ремонт
      s.base.repairs = s.base.repairs.filter((r) => {
        if (r.startedAt + r.duration <= now) {
          const rob = s.robots.find((x) => x.id === r.robotId);
          if (rob) rob.condition = 100;
          inc(s, 'repaired', 'dailyRepair');
          if (s.settings.notifProd) qToast(s, 'Мех отремонтирован', 'ok', rob?.build.name);
          return false;
        }
        return true;
      });
      // апгрейды базы
      s.base.upgrades = s.base.upgrades.filter((u) => {
        if (u.startedAt + u.duration <= now) {
          s.base.modules[u.moduleId] = (s.base.modules[u.moduleId] ?? 1) + 1;
          inc(s, 'upgradesDone', null);
          s.weekly.counters.weekUpgrades = (s.weekly.counters.weekUpgrades ?? 0) + 1;
          if (s.base.modules[u.moduleId] >= 2) s.stats.baseUp2 = 1;
          pushLog(s, 'econ', `Модуль базы улучшен: ${MODULES.find((m) => m.id === u.moduleId)?.name} → ур. ${s.base.modules[u.moduleId]}.`);
          if (s.settings.notifProd) qToast(s, 'Строительство завершено', 'ok', MODULES.find((m) => m.id === u.moduleId)?.name);
          return false;
        }
        return true;
      });
      // события
      s.events = s.events.filter((e) => {
        if (e.expiresAt <= now) {
          const t = s.terrs.find((x) => x.id === e.hexId);
          if (t) t.eventId = null;
          return false;
        }
        return true;
      });
      if (now >= s.eventNext && s.events.length < 3) {
        s.eventNext = now + 80000 + Math.random() * 70000;
        const cand = s.terrs.filter((t) => t.discovered && t.type !== 'water' && !t.eventId);
        if (cand.length) {
          const t = cand[Math.floor(Math.random() * cand.length)];
          const roll = Math.random();
          const kind = roll < 0.35 ? 'anomaly' : roll < 0.6 ? 'wreck' : roll < 0.8 ? 'convoy' : 'invasion';
          t.eventId = kind;
          if (kind === 'invasion' || kind === 'convoy') {
            t.owner = null;
            t.garrison = { power: Math.round(t.garrison.power * 1.35), size: Math.min(3, t.garrison.size + 1) };
          }
          s.events.push({ id: uid(), hexId: t.id, kind, expiresAt: now + 160000 });
          if (s.settings.notifEvents) qToast(s, 'Событие в секторе', 'warn', `${t.name}: ${kind === 'anomaly' ? 'энергетическая аномалия' : kind === 'wreck' ? 'обломки дрона' : kind === 'convoy' ? 'конвой рейдеров' : 'вторжение диких машин'}`);
          pushLog(s, 'alert', `Событие: ${t.name} — ${kind}.`);
        }
      }
      // ИИ фракций
      if (now >= s.aiNext) {
        s.aiNext = now + 42000 + Math.random() * 26000;
        const foes = (['helios', 'azur', 'ferrum'] as FactionId[]).filter((f) => f !== s.profile.faction);
        const f = foes[Math.floor(Math.random() * foes.length)];
        const owned = s.terrs.filter((t) => t.owner === f);
        const neutrals = new Set<string>();
        for (const o of owned) for (const n of neighborIds(o, s.terrs)) if (n.owner === null && n.type !== 'water') neutrals.add(n.id);
        const list = [...neutrals];
        if (list.length && Math.random() < 0.65) {
          const t = s.terrs.find((x) => x.id === list[Math.floor(Math.random() * list.length)])!;
          t.owner = f;
          t.garrison = { power: Math.round(30 * t.tier), size: t.garrison.size };
          if (t.discovered && s.settings.notifCombat) qToast(s, `${FACTIONS[f].short} расширяется`, 'combat', `Захвачена зона «${t.name}»`);
          pushLog(s, 'combat', `${FACTIONS[f].short} берёт под контроль «${t.name}».`);
        }
        // рейд на игрока
        const myHexes = s.terrs.filter((t) => t.owner === s.profile.faction && t.id !== s.base.hexId && (!t.capturedAt || now - t.capturedAt > 90000));
        const shielded = s.base.shieldUntil > now || isNight();
        if (!shielded && now >= s.raidShieldUntil && myHexes.length > 2 && Math.random() < 0.4) {
          s.raidShieldUntil = now + 180000;
          const t = myHexes[Math.floor(Math.random() * myHexes.length)];
          const chance = Math.max(0.05, 0.42 - t.defense * 0.004 - baseDefense(s) * 0.004);
          if (Math.random() < chance) {
            t.owner = f; t.defense = 0;
            pushLog(s, 'alert', `РЕЙД: ${FACTIONS[f].short} отбивает «${t.name}». Укрепляйте зоны!`);
            if (s.settings.notifCombat) qToast(s, 'Территория под атакой!', 'combat', `«${t.name}» потеряна. Рейд ${FACTIONS[f].short}.`);
          } else {
            inc(s, 'defended', null);
            t.defense = Math.max(0, t.defense - 15);
            const sl = s.base.modules.shieldgen ?? 1;
            s.base.shieldUntil = now + 15 * sl * 60000;
            pushLog(s, 'combat', `Гарнизон отбил рейд у «${t.name}». Активирован временный щит.`);
            if (s.settings.notifCombat) qToast(s, 'Рейд отбит', 'ok', `«${t.name}» удержана. Щит ${15 * sl} мин.`);
          }
        }
      }
      // чат альянса
      if (now >= s.chatNext) {
        s.chatNext = now + 45000 + Math.random() * 60000;
        const author = ALLIANCE_MEMBERS[Math.floor(Math.random() * ALLIANCE_MEMBERS.length)].name;
        const text = CHAT_POOL[Math.floor(Math.random() * CHAT_POOL.length)];
        s.alliance.chat = [...s.alliance.chat, { id: uid(), author, text, at: now }].slice(-50);
      }
      // сброс дня
      const today = todayStr();
      if (s.daily.date !== today) {
        s.daily = { date: today, counters: {}, claimed: [] };
        if (s.settings.notifDaily) qToast(s, 'Новые ежедневные задания', 'info', 'Раздел «Задания»');
      }
      // сброс недели
      const wk = weekStr();
      if (s.weekly.week !== wk) s.weekly = { week: wk, counters: {}, claimed: [] };
      // пересчёт сети территорий (редко)
      if (s.profile.faction && (Math.floor(now / 15000) !== Math.floor((now - dt * 1000) / 15000) || s.maxCluster === 0)) {
        s.maxCluster = largestCluster(s, s.profile.faction);
      }
      s.stats.creditsPeak = Math.max(s.stats.creditsPeak ?? 0, s.credits);
      // достижения
      for (const ach of ACHIEVEMENTS) {
        if (!s.achievements.includes(ach.id) && (s.stats[ach.metric] ?? 0) >= ach.target) {
          s.achievements.push(ach.id);
          s.credits += ach.reward;
          qToast(s, `Достижение: ${ach.name}`, 'ok', `+${ach.reward} кредитов`);
        }
      }
      return s;
    }

    case 'SYNC_POS': {
      const dm = a.dm as number;
      s.pos = { x: a.x as number, y: a.y as number };
      s.heading = a.heading as number;
      if (dm > 0) {
        const steps = Math.round(dm / 0.75);
        s.stats.walkM = (s.stats.walkM ?? 0) + dm;
        s.stats.steps = (s.stats.steps ?? 0) + steps;
        s.stats.dailyWalk = (s.stats.dailyWalk ?? 0) + dm;
        s.stats.dailySteps = (s.stats.dailySteps ?? 0) + steps;
        s.weekly.counters.weekWalk = (s.weekly.counters.weekWalk ?? 0) + dm;
        s.deployEnergy = Math.min(DEPLOY_ENERGY_MAX, s.deployEnergy + dm * 0.0035);
      }
      const rr = revealRadius(s);
      for (const t of s.terrs) {
        if (!t.discovered && Math.hypot(t.x - s.pos.x, t.y - s.pos.y) < rr) {
          t.discovered = true;
          inc(s, 'discovered', 'dailyDisc');
          addXp(s, 12);
          s.alliance.contrib += 2;
          pushLog(s, 'info', `Разведана зона «${t.name}».`);
        }
      }
      return s;
    }

    case 'COLLECT': {
      const t = s.terrs.find((x) => x.id === a.hexId) as Territory;
      if (!t || t.owner !== s.profile.faction || t.unclaimed < 1) return state;
      const r = rateFor(t);
      let bonus = 1;
      for (const n of neighborIds(t, s.terrs)) if (n.owner === s.profile.faction && n.type === 'strategic') bonus += 0.15;
      const cr = Math.floor(t.unclaimed * bonus);
      s.credits += cr;
      const resGain = r.res && r.amount ? Math.floor(r.amount * 2 * bonus) : 0;
      if (r.res && resGain) s.res[r.res] += resGain;
      t.unclaimed = 0;
      inc(s, 'incomeCollected', 'dailyIncome');
      addXp(s, 5);
      s.alliance.contrib += 1;
      qToast(s, `+${cr} кр.`, 'ok', resGain && r.res ? `+${resGain} ${r.res === 'metal' ? 'металла' : r.res === 'polymer' ? 'полимеров' : r.res === 'electronics' ? 'электроники' : 'энергии'}` : t.name);
      return s;
    }

    case 'CAPTURE_RESULT': {
      const t = s.terrs.find((x) => x.id === a.hexId) as Territory;
      const win = a.win as boolean;
      const squad = a.squad as { id: string; condition: number }[];
      for (const r of squad) {
        const rob = s.robots.find((x) => x.id === r.id);
        if (rob) rob.condition = Math.round(r.condition);
      }
      s.stats.kills = (s.stats.kills ?? 0) + (a.kills as number);
      addXp(s, (a.kills as number) * 4);
      if (win && t) {
        const loot = lootFor(t);
        s.credits += loot.credits;
        for (const [k, v] of Object.entries(loot.res)) s.res[k as ResKey] += v;
        addXp(s, loot.xp);
        t.owner = s.profile.faction;
        t.defense = 20;
        t.garrison = { power: 25 + s.profile.level * 5, size: 1 };
        t.capturedAt = nowMs();
        t.attackReadyAt = nowMs() + 90000;
        t.eventId = null;
        s.events = s.events.filter((e) => e.hexId !== t.id);
        inc(s, 'captures', 'dailyCaptures');
        inc(s, 'wins', 'dailyWins');
        s.weekly.counters.weekCaptures = (s.weekly.counters.weekCaptures ?? 0) + 1;
        s.weekly.counters.weekWins = (s.weekly.counters.weekWins ?? 0) + 1;
        s.deployEnergy = Math.max(0, s.deployEnergy - ATTACK_ENERGY_COST);
        if (t.type === 'outpost') s.stats.outpostCaptured = 1;
        s.alliance.contrib += 8;
        pushLog(s, 'combat', `Зона «${t.name}» захвачена. Добыча: ${loot.credits} кр.`);
        if (s.settings.notifCombat) qToast(s, 'ПОБЕДА — зона захвачена', 'combat', `«${t.name}» +${loot.credits} кр.`);
      } else {
        inc(s, 'losses', null);
        s.deployEnergy = Math.max(0, s.deployEnergy - ATTACK_ENERGY_COST);
        if (win === false) pushLog(s, 'combat', `Атака на «${t?.name}» отбита противником.`);
      }
      return s;
    }

    case 'REINFORCE': {
      const t = s.terrs.find((x) => x.id === a.hexId) as Territory;
      const cost = 40 * (t?.tier ?? 2);
      if (!t || t.owner !== s.profile.faction || t.defense >= 100 || s.credits < cost) return state;
      s.credits -= cost;
      t.defense = Math.min(100, t.defense + 25);
      inc(s, 'reinforced', 'dailyReinforce');
      pushLog(s, 'econ', `Зона «${t.name}» укреплена (−${cost} кр.).`);
      qToast(s, 'Гарнизон усилен', 'ok', `«${t.name}» оборона ${t.defense}`);
      return s;
    }

    case 'SCAN_LANDMARK': {
      const t = s.terrs.find((x) => x.id === a.hexId) as Territory;
      if (!t || t.type !== 'landmark' || (t.attackReadyAt ?? 0) > nowMs()) return state;
      t.attackReadyAt = nowMs() + 6 * 3600e3;
      s.credits += 50;
      s.stats.landmarks = (s.stats.landmarks ?? 0) + 1;
      addXp(s, 40);
      qToast(s, 'Объект исследован', 'ok', `${t.name}: +50 кр., +40 XP`);
      pushLog(s, 'info', `Исследована достопримечательность «${t.name}».`);
      return s;
    }

    case 'SCAN_EVENT': {
      const e = s.events.find((x) => x.id === a.eventId);
      if (!e) return state;
      const t = s.terrs.find((x) => x.id === e.hexId) as Territory;
      if (e.kind === 'anomaly') {
        const keys: ResKey[] = ['metal', 'polymer', 'electronics', 'energy'];
        const k = keys[Math.floor(Math.random() * keys.length)];
        const v = 25 + Math.floor(Math.random() * 25);
        s.res[k] += v; addXp(s, 25);
        qToast(s, 'Аномалия стабилизирована', 'ok', `+${v} ${k === 'metal' ? 'металла' : k === 'polymer' ? 'полимеров' : k === 'electronics' ? 'электроники' : 'энергоячеек'}`);
      } else {
        s.credits += 120;
        const partPool = ['mb_tracks', 'ut_radar', 'df_composite', 'wp_mg'];
        const p = partPool[Math.floor(Math.random() * partPool.length)];
        s.inv[p] = (s.inv[p] ?? 0) + 1;
        addXp(s, 30);
        qToast(s, 'Обломки собраны', 'ok', `+120 кр., +1 ${PART_MAP[p].name}`);
      }
      inc(s, 'eventsDone', null);
      s.weekly.counters.weekEvents = (s.weekly.counters.weekEvents ?? 0) + 1;
      if (t) t.eventId = null;
      s.events = s.events.filter((x) => x.id !== e.id);
      pushLog(s, 'econ', `Событие завершено: ${t?.name}.`);
      return s;
    }

    case 'CLAIM_WEEKLY_MISSION': {
      const id = a.id as string;
      const def = WEEKLY_POOL.find((m) => m.id === id);
      if (!def || s.weekly.claimed.includes(id)) return state;
      if ((s.weekly.counters[def.metric] ?? 0) < def.target) return state;
      s.weekly.claimed.push(id);
      grant(s, def.reward);
      qToast(s, 'Недельная цель выполнена', 'ok', def.title);
      return s;
    }

    case 'SAVE_SQUAD': {
      const ids = a.ids as string[];
      if (!ids.length) return state;
      if (s.squads.length >= 3) { qToast(s, 'Максимум 3 сохранённых отряда', 'warn'); return s; }
      const name = (a.name as string) || `Отряд ${s.squads.length + 1}`;
      s.squads = [...s.squads, { id: uid(), name, ids }];
      qToast(s, 'Отряд сохранён', 'ok', name);
      return s;
    }

    case 'DELETE_SQUAD': {
      s.squads = s.squads.filter((q) => q.id !== a.id);
      return s;
    }

    case 'START_PRODUCTION': {
      const hexId = a.hexId as string;
      const partId = a.partId as string;
      const t = s.terrs.find((x) => x.id === hexId) as Territory;
      if (!t || t.owner !== s.profile.faction || !t.factoryId) return state;
      if (s.prod.length >= prodSlots(s)) return state;
      const recipe = RECIPES[t.factoryId].find((r) => r.partId === partId);
      if (!recipe) return state;
      if (recipe.req === 'eng3' && s.profile.engLevel < 3) return state;
      if (recipe.req === 'eng4' && s.profile.engLevel < 4) return state;
      if (recipe.req === 'eng5' && s.profile.engLevel < 5) return state;
      if (recipe.req && recipe.req.length <= 3 && s.researched.includes(recipe.req) === false && !recipe.req.startsWith('eng')) return state;
      if (!payRes(s, recipe.input)) { qToast(s, 'Недостаточно ресурсов', 'warn'); return s; }
      const dur = Math.round(recipe.time * 1000 * prodSpeed(s));
      s.prod.push({ id: uid(), hexId, partId, startedAt: nowMs(), duration: dur });
      pushLog(s, 'econ', `Производство запущено: ${PART_MAP[partId].name} (${t.name}).`);
      qToast(s, 'Производство запущено', 'info', PART_MAP[partId].name);
      return s;
    }

    case 'SAVE_ROBOT': {
      const rob = a.robot as Robot;
      const idx = s.robots.findIndex((r) => r.id === rob.id);
      if (idx >= 0) {
        s.robots[idx] = { ...s.robots[idx], build: rob.build };
        qToast(s, 'Конфигурация обновлена', 'ok', rob.build.name);
      } else {
        if (s.robots.length >= maxRobots(s)) { qToast(s, 'Гараж переполнен', 'warn', 'Улучшите модуль «Гараж»'); return s; }
        s.robots.push(rob);
        inc(s, 'built', null);
        addEngXp(s, 25);
        qToast(s, 'Мех собран', 'ok', rob.build.name);
        pushLog(s, 'info', `В гараж поступил мех «${rob.build.name}».`);
      }
      return s;
    }

    case 'DELETE_ROBOT': {
      s.robots = s.robots.filter((r) => r.id !== a.id);
      return s;
    }

    case 'START_RESEARCH': {
      const node = RESEARCH_MAP[a.id as string];
      if (!node || s.research || s.researched.includes(node.id)) return state;
      if (node.requires && !s.researched.includes(node.requires)) return state;
      if (!payRes(s, node.cost)) { qToast(s, 'Недостаточно ресурсов', 'warn'); return s; }
      s.research = { id: node.id, startedAt: nowMs(), duration: Math.round(node.time * 1000 * researchSpeed(s)) };
      pushLog(s, 'info', `Исследование начато: ${node.name}.`);
      qToast(s, 'Исследование начато', 'info', node.name);
      return s;
    }

    case 'UPGRADE_MODULE': {
      const id = a.moduleId as string;
      const lv = s.base.modules[id] ?? 1;
      if (lv >= 5) return state;
      if (id !== 'hq' && lv + 1 > (s.base.modules.hq ?? 1)) { qToast(s, 'Сначала улучшите Штаб', 'warn'); return s; }
      if (s.base.upgrades.length >= 2) { qToast(s, 'Стройка занята', 'warn'); return s; }
      const { cost, time } = moduleCost(id, lv + 1);
      if (!payRes(s, cost)) { qToast(s, 'Недостаточно ресурсов', 'warn'); return s; }
      s.base.upgrades.push({ moduleId: id, startedAt: nowMs(), duration: time * 1000 });
      pushLog(s, 'econ', `Строительство: ${MODULES.find((m) => m.id === id)?.name} → ур. ${lv + 1}.`);
      qToast(s, 'Строительство начато', 'info', MODULES.find((m) => m.id === id)?.name);
      return s;
    }

    case 'START_REPAIR': {
      const rob = s.robots.find((r) => r.id === a.robotId) as Robot;
      if (!rob || rob.condition >= 100) return state;
      if (s.base.repairs.length >= repairSlots(s)) { qToast(s, 'Ремонтные посты заняты', 'warn'); return s; }
      if (s.base.repairs.some((r) => r.robotId === rob.id)) return state;
      const missing = 100 - rob.condition;
      const cost = Math.round(missing * 2.2 * repairCostMult(s));
      if (s.credits < cost) { qToast(s, 'Недостаточно кредитов', 'warn'); return s; }
      s.credits -= cost;
      const dur = Math.round(((missing * 1.4) / repairSpeedMult(s)) * 1000);
      s.base.repairs.push({ robotId: rob.id, startedAt: nowMs(), duration: dur });
      pushLog(s, 'econ', `Ремонт «${rob.build.name}»: −${cost} кр.`);
      qToast(s, 'Ремонт начат', 'info', rob.build.name);
      return s;
    }

    case 'CLAIM_MISSION': {
      const id = a.id as string;
      const def = dailyMissionsFor(s.daily.date).find((m) => m.id === id);
      if (!def || s.daily.claimed.includes(id)) return state;
      if ((s.daily.counters[def.metric] ?? 0) < def.target) return state;
      s.daily.claimed.push(id);
      grant(s, def.reward);
      qToast(s, 'Задание выполнено', 'ok', def.title);
      return s;
    }

    case 'CLAIM_WALK': {
      const id = a.id as string;
      const def = WALK_MILESTONES.find((w) => w.id === id);
      if (!def || s.daily.claimed.includes(id)) return state;
      if (s.stats.walkM < def.m) return state;
      s.daily.claimed.push(id);
      grant(s, def.reward);
      qToast(s, 'Трофей похода получен', 'ok', def.label);
      return s;
    }

    case 'CLAIM_OPS': {
      const step = s.ops.step;
      if (step >= OPS_CHAIN.length || s.ops.claimed.includes(step)) return state;
      const def = OPS_CHAIN[step];
      if ((s.stats[def.metric] ?? 0) < def.target) return state;
      s.ops.claimed.push(step);
      s.ops.step = step + 1;
      if (step + 1 >= OPS_CHAIN.length) s.ops.done = true;
      grant(s, def.reward);
      qToast(s, `Операция: ${def.title}`, 'ok', 'Этап завершён');
      pushLog(s, 'info', `Операция «Первый рубеж»: этап «${def.title}» выполнен.`);
      return s;
    }

    case 'CLAIM_WEEKLY': {
      const owned = s.terrs.filter((t) => t.owner === s.profile.faction).length;
      const total = owned + 9;
      if (s.alliance.weeklyClaimed || total < 14) return state;
      s.alliance.weeklyClaimed = true;
      s.credits += 600; s.res.alloy += 20;
      qToast(s, 'Цель альянса выполнена', 'ok', '+600 кр., +20 сплавов');
      return s;
    }

    case 'SUPPORT': {
      if (nowMs() - s.alliance.lastSupport < 30 * 60000) return state;
      s.alliance.lastSupport = nowMs();
      s.buffs.supportUntil = nowMs() + 5 * 60000;
      qToast(s, 'Поддержка альянса', 'ok', '+10% урон на 5 минут');
      return s;
    }

    case 'CHAT': {
      s.alliance.chat = [...s.alliance.chat, { id: uid(), author: s.profile.name, self: true, text: a.text as string, at: nowMs() }].slice(-50);
      return s;
    }

    case 'RELOCATE_BASE': {
      const t = s.terrs.find((x) => x.id === a.hexId) as Territory;
      if (!t || t.owner !== s.profile.faction || t.id === s.base.hexId) return state;
      if (s.credits < 300) { qToast(s, 'Нужно 300 кредитов', 'warn'); return s; }
      s.credits -= 300;
      s.base.hexId = t.id;
      s.base.shieldUntil = nowMs() + 30 * 60000;
      s.raidShieldUntil = nowMs() + 10 * 60000;
      qToast(s, 'Штаб перенесён', 'ok', `Новая позиция: «${t.name}». Щит 30 мин.`);
      pushLog(s, 'info', `Штаб перенесён в «${t.name}».`);
      return s;
    }

    case 'SET_NAME': s.profile.name = a.name as string; return s;
    case 'SET_SETTINGS': s.settings = { ...s.settings, ...(a.patch as object) }; return s;
    case 'SKIP_ONBOARD': s.onboard.dismissed = true; s.onboard.done = true; return s;
    case 'FINISH_ONBOARD':
      s.onboard.done = true;
      s.credits += 300; s.res.alloy += 10;
      qToast(s, 'Инструктаж завершён', 'ok', '+300 кр., +10 сплавов');
      return s;
    case 'FLUSH_TOASTS': delete s._toasts; return s;
    case 'RESET': localStorage.removeItem(SAVE_KEY); return freshState(s.profile.name || 'Командир', s.profile.faction ?? 'helios');
    default: return state;
  }
}
const nowMs = () => Date.now();

function load(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.v !== 2 || !s.terrs?.length) return null;
    // миграция старых сохранений
    if (typeof s.deployEnergy !== 'number') s.deployEnergy = DEPLOY_ENERGY_MAX;
    if (!Array.isArray(s.squads)) s.squads = [];
    if (!s.weekly) s.weekly = { week: weekStr(), counters: {}, claimed: [] };
    if (typeof s.maxCluster !== 'number') s.maxCluster = 0;
    return s;
  } catch { return null; }
}

interface Ctx {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
}
const GameCtx = createContext<Ctx | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const saved = load();
    if (saved) return saved;
    const boot = freshState('', 'helios');
    boot.profile.faction = null; // заставляем пройти экран выбора фракции
    return boot;
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const saveT = useRef(0);

  useEffect(() => {
    const iv = setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const pending = (state as GameState & { _toasts?: Toast[] })._toasts;
    if (pending?.length) {
      setToasts((t) => [...t, ...pending].slice(-4));
      dispatch({ type: 'FLUSH_TOASTS' });
    }
    const nowT = Date.now();
    if (nowT - saveT.current > 1500) {
      saveT.current = nowT;
      const clean = { ...(state as GameState & { _toasts?: Toast[] }) };
      delete clean._toasts;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(clean)); } catch { /* quota */ }
    }
  }, [state]);

  const toast = (t: Omit<Toast, 'id'>) => setToasts((x) => [...x, { ...t, id: uid() }].slice(-4));
  const dismissToast = (id: string) => setToasts((x) => x.filter((t) => t.id !== id));

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((x) => x.slice(1)), 4200);
    return () => clearTimeout(t);
  }, [toasts]);

  return <GameCtx.Provider value={{ state, dispatch, toasts, toast, dismissToast }}>{children}</GameCtx.Provider>;
}

export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error('no ctx');
  return ctx;
}

export const dailyMissions = (s: GameState) => dailyMissionsFor(s.daily.date);
export const ownedBy = (s: GameState, f: FactionId | null | undefined) => s.terrs.filter((t) => t.owner === f).length;
export const canAttackNow = (t: Territory) => !t.attackReadyAt || Date.now() >= t.attackReadyAt;
export const nearHex = (s: GameState, t: Territory, radius = 165) => Math.hypot(t.x - s.pos.x, t.y - s.pos.y) <= radius;
export const terrById = (s: GameState, id: string) => s.terrs.find((t) => t.id === id);
export { terrAt };
