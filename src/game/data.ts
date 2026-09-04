import type {
  Faction, FactionId, Part, PartCat, Build, ResKey, RobotStats, Recipe, ResearchNode, MissionDef,
  AchievementDef, Territory, TerrType, OwnerId, GameState,
} from './types';

/* ---------- утилиты ---------- */
export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let uidC = 0;
export const uid = () => `${Date.now().toString(36)}${(uidC++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
export const fmt = (n: number) => Math.floor(n).toLocaleString('ru-RU');
export const fmtK = (n: number) => (Math.abs(n) >= 10000 ? `${(n / 1000).toFixed(1).replace('.', ',')}к` : fmt(n));
export function fmtDur(s: number) {
  s = Math.max(0, Math.ceil(s));
  if (s < 60) return `${s}с`;
  if (s < 3600) return `${Math.floor(s / 60)}м ${s % 60 ? `${s % 60}с` : ''}`.trim();
  return `${Math.floor(s / 3600)}ч ${Math.floor((s % 3600) / 60)}м`;
}
export const todayStr = () => new Date().toISOString().slice(0, 10);
export function weekStr(): string {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}
export function weekEndsIn(): number {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = понедельник
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 7, 0, 0, 0);
  return Math.max(0, end.getTime() - now.getTime());
}
export const ATTACK_ENERGY_COST = 25;
export const DEPLOY_ENERGY_MAX = 100;

/* ---------- фракции ---------- */
export const FACTIONS: Record<FactionId, Faction> = {
  helios: { id: 'helios', name: 'Промсоюз «Гелиос»', short: 'ГЕЛИОС', color: '#f2a93b', soft: 'rgba(242,169,59,0.16)', desc: 'Инженеры-промышленники. Дешёвое производство и крепкие машины.', bonus: 'Производство: +10% скорость' },
  azur: { id: 'azur', name: 'Протокол «Азур»', short: 'АЗУР', color: '#4c9ef5', soft: 'rgba(76,158,245,0.16)', desc: 'Сеть исследователей ИИ. Точная электроника и щитовые поля.', bonus: 'Исследования: +10% скорость' },
  ferrum: { id: 'ferrum', name: 'Пакт «Феррум»', short: 'ФЕРРУМ', color: '#e4574f', soft: 'rgba(228,87,79,0.16)', desc: 'Штурмовые бригады тяжелой техники. Ставка на огневую мощь.', bonus: 'Бой: +8% урон' },
};
export const RAIDER_COLOR = '#9aa7b8';
export const ownerColor = (o: OwnerId) => (o === null ? '#5c6b84' : o === 'raiders' ? RAIDER_COLOR : FACTIONS[o].color);
export const ownerName = (o: OwnerId) => (o === null ? 'Дикие машины' : o === 'raiders' ? 'Рейдеры Пустоши' : FACTIONS[o].short);

/* ---------- ресурсы ---------- */
export const RES_META: Record<ResKey | 'credits', { name: string; short: string; color: string }> = {
  credits: { name: 'Кредиты', short: 'КР', color: '#f2d16b' },
  metal: { name: 'Металл', short: 'МТ', color: '#aeb9c6' },
  polymer: { name: 'Полимеры', short: 'ПЛ', color: '#6fd3a7' },
  electronics: { name: 'Электроника', short: 'ЭЛ', color: '#5fc4e8' },
  energy: { name: 'Энергоячейки', short: 'ЭЯ', color: '#e8c95f' },
  alloy: { name: 'Сплавы', short: 'СП', color: '#c9a0f0' },
  core: { name: 'ИИ-ядра', short: 'ИЯ', color: '#f08fb8' },
};

/* ---------- каталог модулей ---------- */
const P = (p: Part) => p;
export const PARTS: Part[] = [
  // шасси
  P({ id: 'ch_scout', cat: 'chassis', name: 'Рама «Стриж»', tier: 1, weight: 6, mods: { hp: 220, capacity: 26, speed: 12, detect: 30 }, cost: { credits: 120, metal: 50 }, desc: 'Лёгкая разведывательная рама. Быстрая, но хрупкая.' }),
  P({ id: 'ch_vanguard', cat: 'chassis', name: 'Рама «Авангард»', tier: 1, weight: 10, mods: { hp: 330, capacity: 34 }, cost: { credits: 160, metal: 70, polymer: 20 }, desc: 'Универсальный средний каркас штурмовых машин.' }),
  P({ id: 'ch_bastion', cat: 'chassis', name: 'Рама «Бастион»', tier: 2, weight: 16, mods: { hp: 470, capacity: 46, armor: 4, speed: -6 }, cost: { credits: 320, metal: 130, polymer: 40 }, desc: 'Тяжёлый несущий каркас для танковых сборок.' }),
  P({ id: 'ch_phantom', cat: 'chassis', name: 'Рама «Фантом»', tier: 2, weight: 8, mods: { hp: 250, capacity: 30, speed: 10, detect: 25, stealth: 20 }, cost: { credits: 420, metal: 90, electronics: 90 }, desc: 'Малозаметная рама с поглощением излучения.', req: { research: 'm3' } }),
  P({ id: 'ch_citadel', cat: 'chassis', name: 'Рама «Цитадель»', tier: 3, weight: 22, mods: { hp: 640, capacity: 58, armor: 8, speed: -12 }, cost: { credits: 700, metal: 260, alloy: 40 }, desc: 'Осадная сверхтяжёлая платформа.', req: { research: 'p3' } }),
  // мобильность
  P({ id: 'mb_wheels', cat: 'mobility', name: 'Колёсный привод «Сайга»', tier: 1, weight: 4, mods: { speed: 26, acc: -3 }, cost: { credits: 80, metal: 30 }, desc: 'Быстрый ход по твёрдому грунту, страдает точность.' }),
  P({ id: 'mb_tracks', cat: 'mobility', name: 'Гусеницы «Тайга»', tier: 1, weight: 7, mods: { speed: 14, armor: 2 }, cost: { credits: 100, metal: 45 }, desc: 'Надёжный вездеходный ход с дополнительной защитой.' }),
  P({ id: 'mb_legs', cat: 'mobility', name: 'Мехоноги «Краб»', tier: 2, weight: 6, mods: { speed: 20, hp: 25 }, cost: { credits: 240, metal: 70, electronics: 40 }, desc: 'Шагающая платформа: манёвренность на любом рельефе.' }),
  P({ id: 'mb_hover', cat: 'mobility', name: 'Ховер-платформа «Ветер»', tier: 2, weight: 5, mods: { speed: 34, energyUse: 6 }, cost: { credits: 380, electronics: 90, energy: 40 }, desc: 'Антигравитационная подушка. Очень быстро, энергозатратно.', req: { research: 'm2' } }),
  // реакторы
  P({ id: 'rc_100', cat: 'reactor', name: 'Реактор «Искра-100»', tier: 1, weight: 5, mods: { energyCap: 60, energyRegen: 14 }, cost: { credits: 90, metal: 25, energy: 10 }, desc: 'Базовый энергоблок полевых машин.' }),
  P({ id: 'rc_200', cat: 'reactor', name: 'Реактор «Пульсар-200»', tier: 2, weight: 8, mods: { energyCap: 105, energyRegen: 22 }, cost: { credits: 220, metal: 60, energy: 30 }, desc: 'Стабильная энергосистема для средних сборок.' }),
  P({ id: 'rc_300', cat: 'reactor', name: 'Реактор «Квазар-300»', tier: 3, weight: 12, mods: { energyCap: 170, energyRegen: 36 }, cost: { credits: 480, alloy: 25, energy: 60 }, desc: 'Флагманская энергосистема тяжёлых машин.', req: { eng: 4 } }),
  // оружие
  P({ id: 'wp_mg', cat: 'weapon', name: 'Пулемёт «Шёпот»', tier: 1, weight: 4, mods: { dmg: 14, range: 150, rof: 2.2, acc: 66, energyUse: 6 }, cost: { credits: 90, metal: 35 }, desc: 'Скорострельное оружие ближней зоны для разведчиков.' }),
  P({ id: 'wp_gun', cat: 'weapon', name: 'Магнит-пушка «Гроза»', tier: 1, weight: 6, mods: { dmg: 26, range: 175, rof: 1.1, acc: 78, energyUse: 9 }, cost: { credits: 130, metal: 55, electronics: 15 }, desc: 'Надёжное баллистическое орудие среднего боя.' }),
  P({ id: 'wp_plasma', cat: 'weapon', name: 'Плазмоган «Коготь»', tier: 1, weight: 7, mods: { dmg: 34, range: 140, rof: 0.85, acc: 74, energyUse: 13 }, cost: { credits: 170, metal: 40, electronics: 45, energy: 15 }, desc: 'Тяжёлые плазменные заряды в упор и средней дальности.' }),
  P({ id: 'wp_rail', cat: 'weapon', name: 'Рельсотрон «Копьё»', tier: 2, weight: 10, mods: { dmg: 72, range: 300, rof: 0.36, acc: 86, energyUse: 21 }, cost: { credits: 380, alloy: 20, electronics: 90 }, desc: 'Дальнобойный гиперзвуковой снаряд. Слаб в упор.', req: { research: 'w2' } }),
  P({ id: 'wp_rocket', cat: 'weapon', name: 'Ракетница «Шквал»', tier: 2, weight: 12, mods: { dmg: 40, range: 260, rof: 0.5, acc: 58, energyUse: 16, aoe: 46 }, cost: { credits: 340, metal: 90, electronics: 60 }, desc: 'Площадной залп по зоне. Низкая точность.', req: { eng: 3 } }),
  P({ id: 'wp_drone', cat: 'weapon', name: 'Рой «Оса»', tier: 3, weight: 9, mods: { dmg: 22, range: 240, rof: 1.6, acc: 70, energyUse: 18 }, cost: { credits: 560, electronics: 140, core: 1 }, desc: 'Автономные атакующие дроны. Роятся и жалят.', req: { research: 'e3' } }),
  // защита
  P({ id: 'df_composite', cat: 'defense', name: 'Композит «К-3»', tier: 1, weight: 6, mods: { armor: 6 }, cost: { credits: 110, metal: 60, polymer: 25 }, desc: 'Слоистая броня, гасит кинетический урон.' }),
  P({ id: 'df_reactive', cat: 'defense', name: 'Реактивная броня «Гром»', tier: 2, weight: 8, mods: { armor: 10, hp: 45 }, cost: { credits: 300, metal: 110, alloy: 15 }, desc: 'Взрывные панели против тяжёлых снарядов.', req: { research: 'a2' } }),
  P({ id: 'df_shield', cat: 'defense', name: 'Щит «Аура»', tier: 2, weight: 5, mods: { shield: 95, shieldRegen: 8, armor: 2 }, cost: { credits: 350, electronics: 110, energy: 50 }, desc: 'Энергокупол с восстановлением в паузах боя.', req: { research: 'a3' } }),
  P({ id: 'df_nano', cat: 'defense', name: 'Нано-броня «Рой-Щ»', tier: 3, weight: 6, mods: { hp: 130, armor: 4, shieldRegen: 4 }, cost: { credits: 520, alloy: 35, core: 1 }, desc: 'Самовосстанавливающееся покрытие корпуса.', req: { eng: 5 } }),
  // utiles
  P({ id: 'ut_repair', cat: 'utility', name: 'Рем-дрон «Жук»', tier: 1, weight: 4, mods: { repair: 9, speed: -2 }, cost: { credits: 140, electronics: 50, polymer: 20 }, desc: 'Чинит ближайшего повреждённого союзника в бою.' }),
  P({ id: 'ut_radar', cat: 'utility', name: 'Радар «Сова»', tier: 1, weight: 3, mods: { detect: 60, acc: 6 }, cost: { credits: 100, electronics: 45 }, desc: 'Обнаружение целей и поправка огня.' }),
  P({ id: 'ut_target', cat: 'utility', name: 'Целеуказатель «Вектор»', tier: 2, weight: 4, mods: { acc: 12, rof: 0.15, dmg: 6 }, cost: { credits: 260, electronics: 80 }, desc: 'Баллистический вычислитель: точнее и быстрее огонь.' }),
  P({ id: 'ut_capacitor', cat: 'utility', name: 'Конденсатор «Вспышка»', tier: 2, weight: 5, mods: { energyCap: 30, energyRegen: 11 }, cost: { credits: 240, electronics: 70, energy: 25 }, desc: 'Буфер энергии для прожорливых систем.', req: { research: 'e2' } }),
];
export const PART_MAP: Record<string, Part> = Object.fromEntries(PARTS.map((p) => [p.id, p]));
export const CAT_LABEL: Record<PartCat, string> = {
  chassis: 'Шасси', mobility: 'Мобильность', reactor: 'Реактор', weapon: 'Оружие', defense: 'Защита', utility: 'Системы',
};

/* ---------- расчёт характеристик ---------- */
export function computeStats(build: Build, researched: string[], engLevel: number): RobotStats {
  const s: RobotStats = {
    hp: 100, armor: 0, shield: 0, shieldRegen: 0, dmg: 0, range: 0, speed: 30, rof: 0, acc: 60,
    energyCap: 40, energyRegen: 10, energyUse: 4, weight: 0, capacity: 20, detect: 120, repair: 0, aoe: 0, stealth: 0,
    archetype: 'Штурм', overloaded: false,
  };
  const has = (id: string) => researched.includes(id);
  for (const cat of Object.keys(build.slots) as PartCat[]) {
    const pid = build.slots[cat];
    if (!pid) continue;
    const part = PART_MAP[pid];
    if (!part) continue;
    s.weight += part.weight;
    for (const [k, v] of Object.entries(part.mods)) {
      (s as unknown as Record<string, number>)[k] = ((s as unknown as Record<string, number>)[k] ?? 0) + (v as number);
    }
  }
  if (has('w1')) s.acc += 5;
  if (has('w3')) s.dmg = Math.round(s.dmg * 1.08);
  if (has('a1')) s.hp = Math.round(s.hp * 1.08);
  if (has('m1')) s.speed = Math.round(s.speed * 1.08);
  if (has('e1')) s.energyRegen = Math.round(s.energyRegen * 1.15);
  s.overloaded = s.weight > s.capacity;
  if (s.overloaded) s.speed = Math.max(12, Math.round((s.speed * s.capacity) / s.weight));
  if (s.energyUse > s.energyRegen && s.rof > 0) s.rof = Math.round(((s.rof * s.energyRegen) / s.energyUse) * 100) / 100;
  s.hp = Math.round(s.hp + Math.min(engLevel, 10) * 4);
  if (s.repair > 0) s.archetype = 'Поддержка';
  else if (s.hp >= 520 || s.armor >= 12) s.archetype = 'Танк';
  else if (s.range >= 260 && s.speed < 62) s.archetype = 'Артиллерия';
  else if (s.speed >= 72) s.archetype = 'Разведчик';
  else s.archetype = 'Штурм';
  return s;
}
export function buildValid(build: Build): { ok: boolean; reason?: string } {
  if (!build.slots.chassis) return { ok: false, reason: 'Нет шасси — мех не собрать' };
  if (!build.slots.mobility) return { ok: false, reason: 'Нет системы передвижения' };
  if (!build.slots.weapon) return { ok: false, reason: 'Нет оружия' };
  if (!build.slots.reactor) return { ok: false, reason: 'Нет реактора' };
  return { ok: true };
}
export const xpForLevel = (l: number) => Math.round(120 * Math.pow(l, 1.35));

/* ---------- заводы и производство ---------- */
export interface FactoryDef { id: string; name: string; cat: string; desc: string; }
export const FACTORIES: Record<string, FactoryDef> = {
  f_mech: { id: 'f_mech', name: 'Машиностроительный завод', cat: 'Шасси и ход', desc: 'Выпускает рамы и системы передвижения.' },
  f_weapon: { id: 'f_weapon', name: 'Оружейный завод «Заря»', cat: 'Вооружение', desc: 'Ствольные и энергетические системы.' },
  f_electro: { id: 'f_electro', name: 'Лаборатория электроники', cat: 'Системы и сенсоры', desc: 'Радары, дроны, целеуказатели.' },
  f_energy: { id: 'f_energy', name: 'Энергоцех «Пульсар»', cat: 'Реакторы', desc: 'Энергоблоки и конденсаторы.' },
  f_armor: { id: 'f_armor', name: 'Броневой цех «Панцирь»', cat: 'Броня и щиты', desc: 'Защитные модули всех классов.' },
};
export const RECIPES: Record<string, Recipe[]> = {
  f_mech: [
    { partId: 'ch_scout', input: { metal: 60, polymer: 15 }, time: 45 },
    { partId: 'ch_vanguard', input: { metal: 85, polymer: 30 }, time: 70 },
    { partId: 'mb_wheels', input: { metal: 40 }, time: 35 },
    { partId: 'mb_tracks', input: { metal: 55, polymer: 10 }, time: 45 },
    { partId: 'mb_legs', input: { metal: 80, electronics: 45 }, time: 120 },
    { partId: 'ch_bastion', input: { metal: 150, polymer: 50 }, time: 240 },
    { partId: 'ch_phantom', input: { metal: 100, electronics: 110 }, time: 360, req: 'm3' },
    { partId: 'ch_citadel', input: { metal: 300, alloy: 50 }, time: 540, req: 'p3' },
  ],
  f_weapon: [
    { partId: 'wp_mg', input: { metal: 45 }, time: 40 },
    { partId: 'wp_gun', input: { metal: 65, electronics: 20 }, time: 60 },
    { partId: 'wp_plasma', input: { metal: 50, electronics: 55, energy: 20 }, time: 110 },
    { partId: 'wp_rocket', input: { metal: 110, electronics: 70 }, time: 260, req: 'eng3' },
    { partId: 'wp_rail', input: { alloy: 25, electronics: 110 }, time: 420, req: 'w2' },
    { partId: 'wp_drone', input: { electronics: 160, core: 1 }, time: 600, req: 'e3' },
  ],
  f_electro: [
    { partId: 'ut_radar', input: { electronics: 55 }, time: 50 },
    { partId: 'ut_repair', input: { electronics: 60, polymer: 25 }, time: 70 },
    { partId: 'ut_target', input: { electronics: 95 }, time: 160 },
    { partId: 'ut_capacitor', input: { electronics: 85, energy: 30 }, time: 200, req: 'e2' },
  ],
  f_energy: [
    { partId: 'rc_100', input: { metal: 30, energy: 15 }, time: 40 },
    { partId: 'rc_200', input: { metal: 70, energy: 40 }, time: 140 },
    { partId: 'rc_300', input: { alloy: 30, energy: 70 }, time: 380, req: 'eng4' },
  ],
  f_armor: [
    { partId: 'df_composite', input: { metal: 70, polymer: 30 }, time: 55 },
    { partId: 'df_reactive', input: { metal: 130, alloy: 20 }, time: 240, req: 'a2' },
    { partId: 'df_shield', input: { electronics: 130, energy: 60 }, time: 300, req: 'a3' },
    { partId: 'df_nano', input: { alloy: 45, core: 1 }, time: 520, req: 'eng5' },
  ],
};

/* ---------- исследования ---------- */
export const BRANCH_LABEL: Record<ResearchNode['branch'], string> = {
  weapon: 'Оружие', armor: 'Броня', mobility: 'Мобильность', production: 'Производство', energy: 'Энергия',
};
export const RESEARCH: ResearchNode[] = [
  { id: 'w1', branch: 'weapon', tier: 1, name: 'Калибровка стволов', desc: '+5% точность всех мехов.', cost: { credits: 150, metal: 50 }, time: 60 },
  { id: 'w2', branch: 'weapon', tier: 2, name: 'Тяжёлая баллистика', desc: 'Открывает рельсотрон «Копьё».', cost: { credits: 380, metal: 90, electronics: 60 }, time: 180, requires: 'w1' },
  { id: 'w3', branch: 'weapon', tier: 3, name: 'Сверхзаряд', desc: '+8% урон всех мехов.', cost: { credits: 700, alloy: 25, electronics: 100 }, time: 360, requires: 'w2' },
  { id: 'a1', branch: 'armor', tier: 1, name: 'Композитные сплавы', desc: '+8% прочность корпуса.', cost: { credits: 150, metal: 60 }, time: 60 },
  { id: 'a2', branch: 'armor', tier: 2, name: 'Реактивные экраны', desc: 'Открывает броню «Гром».', cost: { credits: 380, metal: 120, polymer: 50 }, time: 180, requires: 'a1' },
  { id: 'a3', branch: 'armor', tier: 3, name: 'Щитовые поля', desc: 'Открывает щит «Аура».', cost: { credits: 720, electronics: 140, energy: 60 }, time: 360, requires: 'a2' },
  { id: 'm1', branch: 'mobility', tier: 1, name: 'Сервоприводы', desc: '+8% скорость хода.', cost: { credits: 150, metal: 40, electronics: 30 }, time: 60 },
  { id: 'm2', branch: 'mobility', tier: 2, name: 'Ховер-технологии', desc: 'Открывает ховер-платформу «Ветер».', cost: { credits: 380, electronics: 100, energy: 40 }, time: 180, requires: 'm1' },
  { id: 'm3', branch: 'mobility', tier: 3, name: 'Фантом-протокол', desc: 'Открывает раму «Фантом», +обнаружение.', cost: { credits: 720, electronics: 150, alloy: 20 }, time: 360, requires: 'm2' },
  { id: 'p1', branch: 'production', tier: 1, name: 'Конвейерная сборка', desc: '−15% время производства.', cost: { credits: 180, metal: 60, polymer: 30 }, time: 75 },
  { id: 'p2', branch: 'production', tier: 2, name: 'Вторая очередь', desc: '+1 слот очереди производства.', cost: { credits: 420, metal: 100, electronics: 70 }, time: 200, requires: 'p1' },
  { id: 'p3', branch: 'production', tier: 3, name: 'Проект «Цитадель»', desc: 'Открывает сверхтяжёлую раму «Цитадель».', cost: { credits: 760, alloy: 35, metal: 200 }, time: 400, requires: 'p2' },
  { id: 'e1', branch: 'energy', tier: 1, name: 'Энергосети', desc: '+15% восстановление энергии.', cost: { credits: 150, energy: 30 }, time: 60 },
  { id: 'e2', branch: 'energy', tier: 2, name: 'Ионные буферы', desc: 'Открывает конденсатор «Вспышка».', cost: { credits: 380, electronics: 90, energy: 50 }, time: 180, requires: 'e1' },
  { id: 'e3', branch: 'energy', tier: 3, name: 'Роевой интеллект', desc: 'Открывает атакующий рой «Оса».', cost: { credits: 780, core: 2, electronics: 150 }, time: 420, requires: 'e2' },
];
export const RESEARCH_MAP: Record<string, ResearchNode> = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));

/* ---------- задания ---------- */
export const DAILY_POOL: MissionDef[] = [
  { id: 'd_walk2', title: 'Пройти 2 км по сектору', metric: 'dailyWalk', target: 2000, reward: { credits: 150, res: { metal: 40 } } },
  { id: 'd_steps5', title: 'Набрать 5 000 шагов', metric: 'dailySteps', target: 5000, reward: { credits: 200, res: { polymer: 30 } } },
  { id: 'd_cap1', title: 'Захватить зону', metric: 'dailyCaptures', target: 1, reward: { credits: 180, res: { electronics: 30 }, xp: 40 } },
  { id: 'd_win1', title: 'Победить в бою', metric: 'dailyWins', target: 1, reward: { credits: 120, res: { energy: 20 } } },
  { id: 'd_craft1', title: 'Изготовить компонент', metric: 'dailyCraft', target: 1, reward: { credits: 100, res: { metal: 25, polymer: 25 } } },
  { id: 'd_income3', title: 'Собрать доход 3 раза', metric: 'dailyIncome', target: 3, reward: { credits: 90, xp: 20 } },
  { id: 'd_disc3', title: 'Открыть 3 новые зоны', metric: 'dailyDisc', target: 3, reward: { credits: 140, xp: 45 } },
  { id: 'd_repair1', title: 'Отремонтировать меха', metric: 'dailyRepair', target: 1, reward: { credits: 80, res: { metal: 20 } } },
  { id: 'd_ability2', title: 'Применить 2 боевые системы', metric: 'dailyAbilities', target: 2, reward: { credits: 80, xp: 25 } },
  { id: 'd_reinf1', title: 'Укрепить территорию', metric: 'dailyReinforce', target: 1, reward: { credits: 100, res: { metal: 30 } } },
];
export const WEEKLY_POOL: MissionDef[] = [
  { id: 'w_walk15', title: 'Пройти 15 км за неделю', metric: 'weekWalk', target: 15000, reward: { credits: 1200, res: { alloy: 10 } } },
  { id: 'w_wins10', title: 'Одержать 10 побед', metric: 'weekWins', target: 10, reward: { credits: 800, res: { energy: 60 } } },
  { id: 'w_cap5', title: 'Захватить 5 зон', metric: 'weekCaptures', target: 5, reward: { credits: 900, res: { electronics: 120 } } },
  { id: 'w_craft10', title: 'Изготовить 10 компонентов', metric: 'weekCraft', target: 10, reward: { credits: 700, res: { metal: 120, polymer: 120 } } },
  { id: 'w_up2', title: 'Улучшить 2 модуля базы', metric: 'weekUpgrades', target: 2, reward: { credits: 500, res: { core: 1 } } },
  { id: 'w_ev3', title: 'Завершить 3 события сектора', metric: 'weekEvents', target: 3, reward: { credits: 400, res: { energy: 50 } } },
];
export const WALK_MILESTONES = [
  { id: 'w1', m: 1000, label: '1 км — первый патруль', reward: { credits: 60 } },
  { id: 'w2', m: 2000, label: '2 км — обход района', reward: { res: { metal: 40, polymer: 40 } } },
  { id: 'w3', m: 5000, label: '5 км — дальний рейд', reward: { res: { energy: 30 }, xp: 60 } },
  { id: 'w4', m: 10000, label: '10 км — разведка сектора', reward: { part: 'rc_200', xp: 120 } },
];
export interface OpsStep { title: string; text: string; metric: string; target: number; reward: { credits?: number; res?: Partial<Record<ResKey, number>>; part?: string } }
export const OPS_CHAIN: OpsStep[] = [
  { title: 'Сигнал из Крайска', text: 'Штаб фиксирует всплеск активности диких машин. Проведите разведку пешком: 500 м по сектору.', metric: 'walkM', target: 500, reward: { credits: 200 } },
  { title: 'Первый рубеж', text: 'Дикие машины удерживают район. Атакуйте нейтральную зону и выиграйте первый бой.', metric: 'wins', target: 1, reward: { credits: 250, res: { metal: 30 } } },
  { title: 'Точка опоры', text: 'Закрепитесь на местности: удерживайте под контролем 2 зоны.', metric: 'captures', target: 2, reward: { credits: 300, res: { metal: 40, polymer: 20 } } },
  { title: 'Кузница', text: 'Восстановите производственную цепочку — изготовьте 2 компонента на заводах.', metric: 'crafted', target: 2, reward: { part: 'rc_200' } },
  { title: 'Сеть разведки', text: 'Карта сектора полна белых пятен. Откройте 8 зон.', metric: 'discovered', target: 8, reward: { credits: 350, res: { electronics: 40 } } },
  { title: 'Бастион', text: 'Укрепите штаб: улучшите любой модуль базы до 2 уровня.', metric: 'baseUp2', target: 1, reward: { res: { alloy: 15 } } },
  { title: 'Тяжёлая поступь', text: 'Пакт «Феррум» стягивает силы. Одержите 5 побед в полевых боях.', metric: 'wins', target: 5, reward: { credits: 500, part: 'df_shield' } },
  { title: 'Сердце сектора', text: 'Финал операции: захватите укреплённый форт — любую зону типа «Форт».', metric: 'outpostCaptured', target: 1, reward: { credits: 800, res: { core: 2 } } },
];
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a_first_blood', name: 'Боевое крещение', desc: 'Первая победа в бою', metric: 'wins', target: 1, reward: 100 },
  { id: 'a_warlord', name: 'Полевой командир', desc: '10 побед', metric: 'wins', target: 10, reward: 400 },
  { id: 'a_claimer', name: 'Знаменосец', desc: 'Захватить 10 зон', metric: 'captures', target: 10, reward: 500 },
  { id: 'a_engineer', name: 'Главный инженер', desc: 'Собрать 3 мехов', metric: 'built', target: 3, reward: 300 },
  { id: 'a_scout', name: 'Следопыт', desc: 'Открыть 15 зон', metric: 'discovered', target: 15, reward: 350 },
  { id: 'a_runner', name: 'Марафонец', desc: 'Пройти 10 км', metric: 'walkM', target: 10000, reward: 300 },
  { id: 'a_defender', name: 'Часовой', desc: 'Отбить 3 атаки', metric: 'defended', target: 3, reward: 250 },
  { id: 'a_hunter', name: 'Охотник за аномалиями', desc: 'Завершить 3 события', metric: 'eventsDone', target: 3, reward: 300 },
  { id: 'a_rich', name: 'Магнат сектора', desc: 'Накопить 3 000 кредитов', metric: 'creditsPeak', target: 3000, reward: 200 },
  { id: 'a_scholar', name: 'Учёный совет', desc: 'Завершить 3 исследования', metric: 'researchDone', target: 3, reward: 400 },
];

/* ---------- база ---------- */
export interface ModuleDef { id: string; name: string; desc: string; effect: (lv: number) => string; icon: string; }
export const MODULES: ModuleDef[] = [
  { id: 'hq', name: 'Штаб', desc: 'Ядро базы. Ограничивает уровень остальных модулей.', effect: (l) => `Предел модулей: ур. ${l}`, icon: 'hq' },
  { id: 'garage', name: 'Гараж мехов', desc: 'Ангары для машин и ремонтные посты.', effect: (l) => `Мехов: ${2 + l} · Ремонт: ${l} слот`, icon: 'robot' },
  { id: 'storage', name: 'Склад', desc: 'Хранилище собираемого дохода территорий.', effect: (l) => `Лимит дохода: ×${(1 + 0.5 * (l - 1)).toFixed(1)}`, icon: 'box' },
  { id: 'generator', name: 'Генератор', desc: 'Питание ремонтных систем.', effect: (l) => `Скорость ремонта: +${20 * (l - 1)}%`, icon: 'bolt' },
  { id: 'turrets', name: 'Турели обороны', desc: 'Защищают от рейдов и диверсий.', effect: (l) => `Оборона базы: ${20 * l}`, icon: 'turret' },
  { id: 'radar', name: 'Радар', desc: 'Расширяет зону обнаружения на карте.', effect: (l) => `Радиус обзора: ${340 + 70 * l} м`, icon: 'radar' },
  { id: 'lab', name: 'Лаборатория', desc: 'Ускоряет исследовательские работы.', effect: (l) => `Исследования: −${10 * (l - 1)}%`, icon: 'flask' },
  { id: 'workshop', name: 'Мастерская', desc: 'Удешевляет полевой ремонт мехов.', effect: (l) => `Ремонт: −${12 * (l - 1)}% цена`, icon: 'wrench' },
  { id: 'shieldgen', name: 'Щитовой генератор', desc: 'Активирует защитное поле после атаки.', effect: (l) => `Щит после рейда: ${15 * l} мин`, icon: 'shield' },
];
export const moduleCost = (id: string, nextLv: number) => {
  const k = Math.pow(nextLv, 1.6);
  const base: Partial<Record<ResKey | 'credits', number>> =
    id === 'hq' ? { credits: 220, metal: 80, polymer: 40 }
    : id === 'turrets' ? { credits: 160, metal: 90, electronics: 30 }
    : id === 'lab' ? { credits: 180, electronics: 80, polymer: 30 }
    : { credits: 140, metal: 60, polymer: 30 };
  const out: Partial<Record<ResKey | 'credits', number>> = {};
  for (const [kk, v] of Object.entries(base)) out[kk as ResKey | 'credits'] = Math.round((v as number) * k);
  return { cost: out, time: Math.round(40 * Math.pow(nextLv, 1.5)) };
};
export const maxRobots = (s: GameState) => 2 + (s.base.modules.garage ?? 1);
export const repairSlots = (s: GameState) => s.base.modules.garage ?? 1;
export const revealRadius = (s: GameState) => 340 + 70 * (s.base.modules.radar ?? 1);
export const incomeCapMult = (s: GameState) => 1 + 0.5 * ((s.base.modules.storage ?? 1) - 1);
export const researchSpeed = (s: GameState) => 1 - 0.1 * ((s.base.modules.lab ?? 1) - 1) - (s.profile.faction === 'azur' ? 0.1 : 0);
export const prodSpeed = (s: GameState) => 0.85 ** (s.researched.includes('p1') ? 1 : 0) * (s.profile.faction === 'helios' ? 0.9 : 1);
export const prodSlots = (s: GameState) => 1 + (s.researched.includes('p2') ? 1 : 0);
export const repairCostMult = (s: GameState) => Math.max(0.4, 1 - 0.12 * ((s.base.modules.workshop ?? 1) - 1));
export const repairSpeedMult = (s: GameState) => 1 + 0.2 * ((s.base.modules.generator ?? 1) - 1);
export const baseDefense = (s: GameState) => 20 * (s.base.modules.turrets ?? 1);

/* ---------- генерация мира ---------- */
export const WORLD = { w: 2400, h: 2400, cx: 1200, cy: 1200, hexR: 150 };
const SQ3 = Math.sqrt(3);
export const hexCenter = (q: number, r: number) => ({
  x: WORLD.cx + WORLD.hexR * 1.5 * q,
  y: WORLD.cy + WORLD.hexR * SQ3 * (r + q / 2),
});
export const hexRing = (q: number, r: number) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
export function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, R: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    const px = x + R * Math.cos(a), py = y + R * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
const NEIGHBOR_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const neighborIds = (t: Territory, all: Territory[]) => {
  const set = new Set(all.map((h) => `${h.q},${h.r}`));
  return NEIGHBOR_DIRS.map(([dq, dr]) => `${t.q + dq},${t.r + dr}`).filter((k) => set.has(k))
    .map((k) => all.find((h) => `${h.q},${h.r}` === k) as Territory).filter(Boolean);
};

const NAMES = [
  'кв. Механиков', 'пл. Индустрии', 'парк «Заря»', 'Технодолина', 'Гавань Складов', 'мост Восточный',
  'кв. Конструкторов', 'наб. Сигналов', 'холм Радио', 'старый Завод', 'двор Транспортный', 'массив «Кристалл»',
  'ул. Литейная', 'кв. Энергетиков', 'пл. Прогресса', 'тупик Грузовой', 'кв. Сварщиков', 'б-р Изобретателей',
  'роща Полимерная', 'кв. Связистов', 'пл. Пусковая', 'кв. Моторный', 'ул. Релейная', 'кв. Крановый',
  'парк «Отражение»', 'наб. Рудная', 'кв. Доменный', 'пл. Сборочная', 'кв. Оптиков', 'ул. Кабельная',
  'кв. Портовый', 'пл. Авиаторов', 'кв. Турбинный', 'ул. Магнитная', 'кв. Геологов', 'пл. Химиков',
  'кв. Шлюзовой', 'б-р Мехатроники', 'кв. Кузнечный', 'ул. Бетонная', 'кв. Аппаратный', 'пл. Радиотехников',
  'кв. Сплавной', 'ул. Гидравлическая', 'кв. Арматурный', 'пл. Токарей', 'кв. Приборный', 'ул. Котельная',
  'кв. Силиконовый', 'пл. Старателей', 'кв. Буровой', 'ул. Конвейерная', 'кв. Электродный', 'пл. Испытателей',
];
const SPECIAL: Record<string, { type: TerrType; name?: string; factoryId?: string }> = {
  '-3,1': { type: 'factory', name: 'Машиностроительный завод', factoryId: 'f_mech' },
  '0,-3': { type: 'factory', name: 'Оружейный завод «Заря»', factoryId: 'f_weapon' },
  '3,-1': { type: 'factory', name: 'Лаборатория электроники', factoryId: 'f_electro' },
  '-1,4': { type: 'factory', name: 'Энергоцех «Пульсар»', factoryId: 'f_energy' },
  '2,-4': { type: 'factory', name: 'Броневой цех «Панцирь»', factoryId: 'f_armor' },
  '0,-1': { type: 'strategic', name: 'Комм-вышка «Заря»' },
  '-2,3': { type: 'strategic', name: 'Транспортный узел «Юг»' },
  '1,0': { type: 'landmark', name: 'Монумент «Прогресс»' },
  '-2,0': { type: 'landmark', name: 'Музей машин' },
  '4,-1': { type: 'landmark', name: 'Обсерватория «Око»' },
  '-4,2': { type: 'outpost', name: 'Форт «Рубеж»' },
  '2,2': { type: 'outpost', name: 'Аванпост «Восток»' },
  '1,-4': { type: 'metal' }, '−3,4': { type: 'metal' },
  '-1,2': { type: 'polymer' }, '3,1': { type: 'polymer' },
  '2,-2': { type: 'electronics' }, '-4,4': { type: 'electronics' },
  '0,2': { type: 'energy' }, '-1,-2': { type: 'energy' },
};
// исправление опечатки ключа
SPECIAL['-3,4'] = { type: 'metal' };
delete SPECIAL['−3,4'];

const HOMES: Record<FactionId, string[]> = {
  helios: ['-3,2', '-2,1'],
  ferrum: ['1,-3', '0,-2'],
  azur: ['3,-1', '4,-2'],
};
// если дом фракции совпал со спец-зоной, используем ближайшую замену
HOMES.azur = ['4,-2', '2,-1'];

export interface CityGeometry { blocks: { x: number; y: number; w: number; h: number; s: number }[]; roads: { x1: number; y1: number; x2: number; y2: number }[]; parks: { x: number; y: number; pts: [number, number][] }[]; water: [number, number][]; }

export function generateWorld(seed: number): { terrs: Territory[]; geo: CityGeometry } {
  const rnd = mulberry32(seed);
  const terrs: Territory[] = [];
  let nameI = 0;
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      if (Math.abs(q + r) > 4) continue;
      const ring = hexRing(q, r);
      if (ring === 4 && rnd() < 0.28) continue;
      const c = hexCenter(q, r);
      terrs.push({
        id: `${q},${r}`, q, r, x: c.x, y: c.y, name: NAMES[nameI++ % NAMES.length], type: 'district',
        tier: 2, owner: null, garrison: { power: 0, size: 1 }, defense: 0, unclaimed: 0, discovered: false, eventId: null,
      });
    }
  }
  // река: полоса по диагонали
  const riverA = { x: 420, y: 2200 }, riverB = { x: 2150, y: 330 };
  const distToRiver = (x: number, y: number) => {
    const dx = riverB.x - riverA.x, dy = riverB.y - riverA.y;
    const t = Math.max(0, Math.min(1, ((x - riverA.x) * dx + (y - riverA.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (riverA.x + t * dx), y - (riverA.y + t * dy));
  };
  const parkSpots = [{ x: 830, y: 1530 }, { x: 1560, y: 950 }];
  for (const t of terrs) {
    const key = t.id;
    if (SPECIAL[key]) {
      t.type = SPECIAL[key].type;
      if (SPECIAL[key].name) t.name = SPECIAL[key].name!;
      if (SPECIAL[key].factoryId) t.factoryId = SPECIAL[key].factoryId;
    } else if (distToRiver(t.x, t.y) < 135) t.type = 'water';
    else if (parkSpots.some((p) => Math.hypot(p.x - t.x, p.y - t.y) < 190)) t.type = 'park';
  }
  // владельцы
  const specialSet = new Set(Object.keys(SPECIAL));
  const byKey = new Map(terrs.map((t) => [t.id, t]));
  const assignable = terrs.filter((t) => t.type !== 'water' && !specialSet.has(t.id));
  const markOwned = (key: string, o: OwnerId) => { const t = byKey.get(key); if (t && t.type !== 'water') t.owner = o; };
  (Object.keys(HOMES) as FactionId[]).forEach((f) => HOMES[f].forEach((k) => markOwned(k, f)));
  const free = () => assignable.filter((t) => t.owner === null && !HOMES.helios.concat(HOMES.ferrum, HOMES.azur).includes(t.id));
  const takeNearest = (o: OwnerId, ax: number, ay: number, n: number) => {
    free().sort((a, b) => Math.hypot(a.x - ax, a.y - ay) - Math.hypot(b.x - ax, b.y - ay)).slice(0, n).forEach((t) => (t.owner = o));
  };
  takeNearest('helios', 620, 1280, 4);
  takeNearest('ferrum', 1330, 560, 4);
  takeNearest('azur', 1900, 1180, 4);
  markOwned('-4,2', 'raiders'); markOwned('2,2', 'raiders');
  const ctr = byKey.get('0,0');
  if (ctr) takeNearest('raiders', ctr.x, ctr.y, 3);
  // гарнизоны и тиры
  for (const t of terrs) {
    if (t.type === 'water') { t.tier = 0; continue; }
    const ring = hexRing(t.q, t.r);
    let tier = ring <= 1 ? 2 : ring === 2 ? 3 : 3 + (rnd() < 0.45 ? 1 : 0);
    if (t.type === 'factory') tier = Math.min(5, tier + 1);
    if (t.type === 'outpost') tier = Math.min(5, tier + 1);
    if (t.type === 'strategic') tier = Math.min(5, tier + 1);
    if (t.type === 'landmark' || t.type === 'park') tier = Math.max(1, tier - 1);
    t.tier = tier;
    const basePow = t.owner === null || t.owner === 'raiders' ? 42 : 34;
    t.garrison = { power: Math.round(basePow * tier + rnd() * 26), size: Math.min(3, 1 + Math.floor(tier / 2)) + (t.type === 'outpost' ? 1 : 0) };
  }
  // геометрия города
  const blocks: CityGeometry['blocks'] = [];
  for (let gx = 100; gx < WORLD.w - 100; gx += 160) {
    for (let gy = 100; gy < WORLD.h - 100; gy += 160) {
      if (rnd() < 0.25) continue;
      const n = 2 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const w = 26 + rnd() * 62, h = 26 + rnd() * 62;
        blocks.push({ x: gx + rnd() * (140 - w), y: gy + rnd() * (140 - h), w, h, s: 0.5 + rnd() * 0.5 });
      }
    }
  }
  const roads: CityGeometry['roads'] = [];
  for (let x = 140; x < WORLD.w; x += 230) roads.push({ x1: x + rnd() * 30, y1: 0, x2: x + rnd() * 30, y2: WORLD.h });
  for (let y = 140; y < WORLD.h; y += 230) roads.push({ x1: 0, y1: y + rnd() * 30, x2: WORLD.w, y2: y + rnd() * 30 });
  const parks = parkSpots.map((p) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const rr = 165 + rnd() * 55;
      pts.push([p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr]);
    }
    return { ...p, pts };
  });
  const water: [number, number][] = [];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    water.push([riverA.x + (riverB.x - riverA.x) * t + 95, riverA.y + (riverB.y - riverA.y) * t + 70]);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    water.push([riverA.x + (riverB.x - riverA.x) * t - 95, riverA.y + (riverB.y - riverA.y) * t - 70]);
  }
  return { terrs, geo: { blocks, roads, parks, water } };
}

export function terrAt(x: number, y: number, terrs: Territory[]): Territory | null {
  let best: Territory | null = null, bd = 1e9;
  for (const t of terrs) {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < bd) { bd = d; best = t; }
  }
  return bd < WORLD.hexR * 1.02 ? best : null;
}

export const rateFor = (t: Territory): { credits: number; res?: ResKey; amount?: number } => {
  switch (t.type) {
    case 'metal': return { credits: 2, res: 'metal', amount: 5 };
    case 'polymer': return { credits: 2, res: 'polymer', amount: 5 };
    case 'electronics': return { credits: 2, res: 'electronics', amount: 4 };
    case 'energy': return { credits: 2, res: 'energy', amount: 4 };
    case 'factory': return { credits: 10 };
    case 'strategic': return { credits: 6 };
    case 'landmark': return { credits: 3 };
    case 'outpost': return { credits: 14 };
    case 'park': return { credits: 4, res: 'polymer', amount: 1 };
    default: return { credits: 8 };
  }
};
export const TYPE_LABEL: Record<TerrType, string> = {
  district: 'Район', metal: 'Металлобаза', polymer: 'Полимерный комплекс', electronics: 'Электронный хаб',
  energy: 'Энергоподстанция', factory: 'Завод', strategic: 'Стратегическая точка', landmark: 'Достопримечательность',
  outpost: 'Форт', park: 'Парк', water: 'Акватория',
};

/* ---------- противники и добыча ---------- */
export interface UnitSpec {
  name: string; chassis: string; weapon: string; mobility: string; defense: string | null; utility: string | null;
  turret?: boolean;
}
const ENEMY_NAMES = ['Цербер', 'Гюрза', 'Сапсан', 'Гром-7', 'Кречет', 'Барс', 'Рысь', 'Кондор', 'Штырь', 'Кувалда', 'Тайфун', 'Молот'];
export function makeDefenderSpecs(t: Territory): UnitSpec[] {
  const rnd = mulberry32(t.x * 7 + t.y * 13 + t.tier);
  const tier = t.tier + (t.eventId ? 1 : 0);
  const specs: UnitSpec[] = [];
  const pool = tier >= 4
    ? { ch: ['ch_bastion', 'ch_phantom', 'ch_vanguard'], wp: ['wp_plasma', 'wp_rail', 'wp_rocket'], mb: ['mb_legs', 'mb_tracks', 'mb_hover'], df: ['df_reactive', 'df_composite'], ut: ['ut_target', 'ut_radar'] }
    : tier === 3
      ? { ch: ['ch_vanguard', 'ch_bastion', 'ch_scout'], wp: ['wp_gun', 'wp_plasma', 'wp_mg'], mb: ['mb_tracks', 'mb_wheels'], df: ['df_composite', null], ut: ['ut_radar', null] }
      : { ch: ['ch_scout', 'ch_vanguard'], wp: ['wp_mg', 'wp_gun'], mb: ['mb_wheels', 'mb_tracks'], df: [null], ut: [null] };
  const size = Math.min(3, t.garrison.size);
  for (let i = 0; i < size; i++) {
    specs.push({
      name: `${ENEMY_NAMES[Math.floor(rnd() * ENEMY_NAMES.length)]}-${i + 1}`,
      chassis: pool.ch[Math.floor(rnd() * pool.ch.length)],
      weapon: pool.wp[Math.floor(rnd() * pool.wp.length)],
      mobility: pool.mb[Math.floor(rnd() * pool.mb.length)],
      defense: pool.df[Math.floor(rnd() * pool.df.length)] as string | null,
      utility: pool.ut[Math.floor(rnd() * pool.ut.length)] as string | null,
    });
  }
  return specs;
}
export function lootFor(t: Territory): { credits: number; res: Partial<Record<ResKey, number>>; xp: number } {
  const k = t.eventId ? 1.6 : 1;
  const res: Partial<Record<ResKey, number>> = {};
  const add = (r: ResKey, v: number) => (res[r] = (res[r] ?? 0) + Math.round(v * k));
  if (t.type === 'metal') add('metal', 45); else if (t.type === 'polymer') add('polymer', 45);
  else if (t.type === 'electronics') add('electronics', 38); else if (t.type === 'energy') add('energy', 38);
  else if (t.type === 'factory') { add('metal', 25); add('polymer', 25); }
  else if (t.type === 'park') add('polymer', 30);
  if (t.type === 'outpost' || t.tier >= 4) { add('alloy', 8); if (t.tier >= 5) add('core', 1); }
  if (t.tier >= 3) add('metal', 15);
  return { credits: Math.round(60 * t.tier * k), res, xp: Math.round(25 * t.tier * k) };
}

/* ---------- альянс ---------- */
export const ALLIANCE_MEMBERS = [
  { name: 'кмд. Волкова', power: 1240, online: true },
  { name: 'инж. Соколов', power: 980, online: true },
  { name: 'разв. Ким', power: 870, online: false },
  { name: 'штурм. Гроза-12', power: 1530, online: true },
  { name: 'тех. Мельник', power: 720, online: false },
  { name: 'опер. Лада', power: 655, online: true },
  { name: 'кап. Штиль', power: 1105, online: false },
];
export const CHAT_POOL = [
  'Кто прикроет восточный завод? Феррум стягивает силы.',
  'Собрал «Копьё» на гусеницах — рекомендую против фортов.',
  'У Транспортного узла аномалия, нужен напарник.',
  'Отдаю излишки полимеров за электронику, пишите.',
  'Дикие машины снова у Форта «Рубеж», держим оборону.',
  'Радар 3 уровня окупается: вся западная дуга видна.',
  'Плюс один завод в копилку альянса. Хорошо работаем.',
  'Не атакуйте в одиночку аванпосты, зовите поддержку.',
  'Щитовой генератор спас базу ночью. Качайте его.',
  'Видел конвой рейдеров у парка, добыча богатая.',
  'У кого свободный рем-дрон? Поделитесь чертежом.',
  'Сегодня прошел 8 км — сектор открылся на треть.',
  'Феррум потерял два района на севере. Давим дальше.',
  'Напоминаю: ночью действует перемирие, база под щитом.',
];

/* ---------- стартовый набор ---------- */
export const STARTER_INV: Record<string, number> = {
  ch_scout: 1, ch_vanguard: 1, mb_wheels: 1, mb_tracks: 1, rc_100: 2, wp_gun: 1, wp_mg: 1,
  df_composite: 1, ut_radar: 1,
};
