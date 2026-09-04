import type { Behavior, Build, FactionId } from './types';
import { computeStats, makeDefenderSpecs, PART_MAP } from './data';
import type { Territory } from './types';
import { FACTIONS, RAIDER_COLOR } from './data';

export interface CUnit {
  id: string; side: 0 | 1; name: string; kind: 'robot' | 'turret';
  x: number; y: number; spawnX: number; spawnY: number;
  hp: number; maxHp: number; armor: number; shield: number; maxShield: number; shRegen: number; shTimer: number;
  dmg: number; range: number; speed: number; rof: number; acc: number; aoe: number; repair: number;
  behavior: Behavior; color: string; accent: string; chassis: string; weapon: string;
  cd: number; target: string | null; dead: boolean; flash: number; kills: number;
}
export interface Fx {
  id: number; kind: 'shot' | 'boom' | 'num' | 'heal' | 'muzzle';
  x: number; y: number; x2?: number; y2?: number; t: number; dur: number; color: string; text?: string; size?: number;
}

export const ARENA = { w: 960, h: 540 };

let fxId = 1;
const rnd = Math.random;

export class BattleSim {
  units: CUnit[] = [];
  fx: Fx[] = [];
  time = 0;
  over = false;
  winner: 0 | 1 | -1 = -1;
  energy = 55;
  focusId: string | null = null;
  overdriveUntil = 0;
  obstacles: { x: number; y: number; w: number; h: number }[] = [];
  shake = 0;

  constructor(squad: CUnit[], foes: CUnit[], seed: number) {
    this.units = [...squad, ...foes];
    const r = (() => { let a = seed | 0 || 7; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    for (let i = 0; i < 5; i++) {
      this.obstacles.push({ x: 220 + r() * 520, y: 70 + r() * 380, w: 42 + r() * 46, h: 34 + r() * 30 });
    }
  }

  addFx(f: Omit<Fx, 'id' | 't'>) { this.fx.push({ id: fxId++, t: 0, ...f }); if (this.fx.length > 90) this.fx.shift(); }

  alive(side: 0 | 1) { return this.units.filter((u) => !u.dead && u.side === side); }

  /** перекрывает ли укрытие прямую видимость между точками */
  losBlocked(x1: number, y1: number, x2: number, y2: number): boolean {
    for (const o of this.obstacles) {
      const minX = o.x, maxX = o.x + o.w, minY = o.y, maxY = o.y + o.h;
      let tmin = 0, tmax = 1;
      const dx = x2 - x1, dy = y2 - y1;
      const axes: [number, number, number, number][] = [[x1, dx, minX, maxX], [y1, dy, minY, maxY]];
      let hit = true;
      for (const [p, d, lo, hi] of axes) {
        if (Math.abs(d) < 1e-9) {
          if (p < lo || p > hi) { hit = false; break; }
        } else {
          let t1 = (lo - p) / d, t2 = (hi - p) / d;
          if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
          tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
          if (tmin > tmax) { hit = false; break; }
        }
      }
      if (hit && tmin < 0.98 && tmax > 0.02) return true;
    }
    return false;
  }

  setFocus(id: string | null) { this.focusId = id; }

  tryAbility(kind: 'barrage' | 'repair' | 'overdrive'): boolean {
    if (this.over) return false;
    const cost = kind === 'barrage' ? 42 : kind === 'repair' ? 36 : 30;
    if (this.energy < cost) return false;
    this.energy -= cost;
    if (kind === 'barrage') {
      for (const u of this.alive(1)) {
        this.addFx({ kind: 'boom', x: u.x, y: u.y, dur: 0.5, color: '#f2a93b', size: 26 });
        this.damage(u, 17 + rnd() * 8, null, true);
      }
      this.shake = 0.5;
    } else if (kind === 'repair') {
      for (const u of this.alive(0)) {
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.22);
        this.addFx({ kind: 'heal', x: u.x, y: u.y - 20, dur: 0.8, color: '#4fd58c', text: '+22%' });
      }
    } else {
      this.overdriveUntil = this.time + 6;
      this.addFx({ kind: 'num', x: ARENA.w / 2, y: 90, dur: 1, color: '#35e0c8', text: 'ФОРСАЖ ×1.6' });
    }
    return true;
  }

  private damage(u: CUnit, raw: number, from: CUnit | null, pierce = false) {
    if (u.dead) return;
    let v = raw;
    if (!pierce) v = Math.max(1, v - u.armor * 0.6);
    if (u.shield > 0 && !pierce) {
      const abs = Math.min(u.shield, v);
      u.shield -= abs; v -= abs; u.shTimer = 0;
    }
    if (v > 0) {
      u.hp -= v; u.flash = 0.12;
      this.addFx({ kind: 'num', x: u.x + (rnd() * 20 - 10), y: u.y - 26, dur: 0.7, color: '#ffd9a0', text: `${Math.round(v)}`, size: 11 });
    }
    if (from) this.energy = Math.min(100, this.energy + 0.8);
    if (u.hp <= 0) {
      u.dead = true; u.hp = 0;
      if (from) from.kills++;
      this.addFx({ kind: 'boom', x: u.x, y: u.y, dur: 0.8, color: u.side === 1 ? '#f2a93b' : '#e4574f', size: u.kind === 'turret' ? 46 : 34 });
      this.shake = Math.min(1, this.shake + 0.4);
    }
  }

  private pickTarget(u: CUnit): CUnit | null {
    const foes = this.alive(u.side === 0 ? 1 : 0);
    if (!foes.length) return null;
    if (u.side === 0 && this.focusId) {
      const f = foes.find((x) => x.id === this.focusId && !x.dead);
      if (f) return f;
    }
    if (u.behavior === 'structures') {
      const t = foes.find((f) => f.kind === 'turret');
      if (t) return t;
    }
    let best = foes[0], bd = 1e9;
    for (const f of foes) {
      const d = Math.hypot(f.x - u.x, f.y - u.y) + (f.hp / f.maxHp) * 60;
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  update(dt: number) {
    if (this.over) {
      for (const f of this.fx) f.t += dt;
      this.fx = this.fx.filter((f) => f.t < f.dur);
      this.shake = Math.max(0, this.shake - dt * 2);
      return;
    }
    this.time += dt;
    this.energy = Math.min(100, this.energy + dt * 4.2);
    this.shake = Math.max(0, this.shake - dt * 2);
    const rofMul = this.time < this.overdriveUntil ? 1.6 : 1;

    for (const u of this.units) {
      if (u.dead) continue;
      u.cd -= dt * rofMul; u.flash = Math.max(0, u.flash - dt);
      u.shTimer += dt;
      if (u.shTimer > 3 && u.shield < u.maxShield) u.shield = Math.min(u.maxShield, u.shield + u.shRegen * dt);

      // поддержка лечит
      if (u.repair > 0) {
        const allies = this.alive(u.side).filter((a) => a.id !== u.id && a.hp < a.maxHp);
        if (allies.length) {
          allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
          const a = allies[0];
          const d = Math.hypot(a.x - u.x, a.y - u.y);
          if (d < 200) {
            a.hp = Math.min(a.maxHp, a.hp + u.repair * 1.4 * dt);
            if (rnd() < dt * 3) this.addFx({ kind: 'heal', x: a.x, y: a.y - 22, dur: 0.5, color: '#4fd58c', text: '+' });
          } else if (u.kind === 'robot') this.moveToward(u, a.x, a.y, dt, 0);
          continue;
        }
      }

      const t = this.pickTarget(u);
      if (!t) continue;
      u.target = t.id;
      const dist = Math.hypot(t.x - u.x, t.y - u.y);

      if (u.kind === 'robot') {
        const b = u.behavior;
        if (b === 'kite') {
          if (dist < u.range * 0.72) this.moveToward(u, u.x - (t.x - u.x), u.y - (t.y - u.y), dt, 0);
          else if (dist > u.range * 0.92) this.moveToward(u, t.x, t.y, dt, 0);
        } else if (b === 'defensive') {
          const ds = Math.hypot(u.spawnX - u.x, u.spawnY - u.y);
          if (dist > u.range * 0.9 && ds < 170) this.moveToward(u, t.x, t.y, dt, 0);
        } else if (b === 'support') {
          if (dist > 230) this.moveToward(u, t.x, t.y, dt, 0);
          else if (dist < 150) this.moveToward(u, u.x - (t.x - u.x), u.y - (t.y - u.y), dt, 0);
        } else {
          if (dist > u.range * 0.82) this.moveToward(u, t.x, t.y, dt, 0);
        }
      }

      if (dist <= u.range && u.cd <= 0 && u.rof > 0) {
        u.cd = 1 / u.rof;
        const falloff = 1 - Math.max(0, (dist - u.range * 0.55) / (u.range * 0.9)) * 0.45;
        const blocked = this.losBlocked(u.x, u.y, t.x, t.y);
        const hitChance = Math.min(0.95, Math.max(0.35, (u.acc / 100) * falloff)) * (blocked ? 0.55 : 1);
        this.addFx({ kind: 'muzzle', x: u.x, y: u.y - 8, dur: 0.09, color: u.color });
        this.addFx({ kind: 'shot', x: u.x, y: u.y - 8, x2: t.x + (rnd() * 24 - 12), y2: t.y + (rnd() * 24 - 12), dur: 0.12, color: blocked ? '#8fa3bc' : u.color });
        if (rnd() < hitChance) {
          this.damage(t, u.dmg * (0.85 + rnd() * 0.3) * (blocked ? 0.6 : 1), u);
          if (u.aoe > 0) {
            this.addFx({ kind: 'boom', x: t.x, y: t.y, dur: 0.45, color: '#f2a93b', size: u.aoe });
            for (const f of this.alive(t.side)) {
              if (f.id !== t.id && Math.hypot(f.x - t.x, f.y - t.y) < u.aoe) this.damage(f, u.dmg * 0.4, u);
            }
          }
        }
      }
    }

    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.dur);

    const a0 = this.alive(0).length, a1 = this.alive(1).length;
    if (a0 === 0 || a1 === 0) {
      this.over = true;
      this.winner = a1 === 0 ? 0 : a1 === 0 && a0 === 0 ? -1 : a0 === 0 ? 1 : 0;
    }
  }

  private moveToward(u: CUnit, tx: number, ty: number, dt: number, _min: number) {
    const d = Math.hypot(tx - u.x, ty - u.y);
    if (d < 1) return;
    const step = u.speed * dt;
    u.x += ((tx - u.x) / d) * Math.min(step, d);
    u.y += ((ty - u.y) / d) * Math.min(step, d);
    // выталкивание из укрытий
    const r = 20;
    for (const o of this.obstacles) {
      const cx = Math.max(o.x, Math.min(u.x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(u.y, o.y + o.h));
      const dx = u.x - cx, dy = u.y - cy;
      const dd = Math.hypot(dx, dy);
      if (dd < r) {
        if (dd < 0.001) { u.y = o.y - r; continue; }
        u.x = cx + (dx / dd) * r; u.y = cy + (dy / dd) * r;
      }
    }
    u.x = Math.max(30, Math.min(ARENA.w - 30, u.x));
    u.y = Math.max(40, Math.min(ARENA.h - 40, u.y));
  }
}

/* ---------- сборка юнитов ---------- */
export function unitFromBuild(
  id: string, name: string, build: Build, researched: string[], engLevel: number,
  side: 0 | 1, color: string, accent: string, x: number, y: number, hpScale: number, dmgBonus = 1,
): CUnit {
  const s = computeStats(build, researched, engLevel);
  return {
    id, side, name, kind: 'robot', x, y, spawnX: x, spawnY: y,
    hp: Math.round(s.hp * hpScale), maxHp: Math.round(s.hp * hpScale), armor: s.armor, shield: s.shield,
    maxShield: s.shield, shRegen: s.shieldRegen, shTimer: 99, dmg: Math.round(s.dmg * dmgBonus), range: s.range,
    speed: Math.max(28, s.speed * 1.15), rof: s.rof, acc: s.acc, aoe: s.aoe, repair: s.repair,
    behavior: build.behavior, color, accent, chassis: build.slots.chassis ?? 'ch_vanguard',
    weapon: build.slots.weapon ?? 'wp_gun', cd: 0.6, target: null, dead: false, flash: 0, kills: 0,
  };
}

export function makeDefenderUnits(t: Territory, researched: string[]): CUnit[] {
  const specs = makeDefenderSpecs(t);
  const color = t.owner === null || t.owner === 'raiders' ? RAIDER_COLOR : FACTIONS[t.owner].color;
  const scale = 0.82 + t.tier * 0.07 + (t.eventId ? 0.15 : 0);
  const out: CUnit[] = [];
  specs.forEach((sp, i) => {
    const build: Build = {
      name: sp.name,
      slots: { chassis: sp.chassis, mobility: sp.mobility, reactor: 'rc_100', weapon: sp.weapon, defense: sp.defense, utility: sp.utility },
      behavior: i === 0 ? 'defensive' : 'aggressive',
    };
    const y = ARENA.h / 2 + (i - (specs.length - 1) / 2) * 130;
    out.push(unitFromBuild(`d${i}`, sp.name, build, researched, 3, 1, color, '#2a3648', 830, y, scale, 1));
  });
  if (t.type === 'outpost' || t.tier >= 5) {
    out.push({
      id: 'turret', side: 1, name: 'Турель «Страж»', kind: 'turret', x: 890, y: ARENA.h / 2, spawnX: 890, spawnY: ARENA.h / 2,
      hp: 380 + t.tier * 60, maxHp: 380 + t.tier * 60, armor: 9, shield: 0, maxShield: 0, shRegen: 0, shTimer: 99,
      dmg: 26, range: 285, speed: 0, rof: 0.7, acc: 80, aoe: 0, repair: 0, behavior: 'defensive', color,
      accent: '#2a3648', chassis: 'turret', weapon: 'wp_gun', cd: 1, target: null, dead: false, flash: 0, kills: 0,
    });
  }
  return out;
}

export function squadPositions(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) out.push([110, ARENA.h / 2 + (i - (n - 1) / 2) * 130]);
  return out;
}
