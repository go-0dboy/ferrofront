import { useMemo, useState } from 'react';
import { useGame } from '../game/state';
import {
  PARTS, PART_MAP, CAT_LABEL, computeStats, buildValid, maxRobots, uid, RESEARCH_MAP, fmtDur,
} from '../game/data';
import type { Build, PartCat, Part, Behavior, Robot } from '../game/types';
import { Icon, RobotSVG, Sheet, StatRow, Bar } from '../components/ui';
import { FACTIONS } from '../game/data';

const MOD_LABEL: Record<string, string> = {
  hp: 'Прочность', armor: 'Броня', shield: 'Щит', shieldRegen: 'Реген. щита', dmg: 'Урон', range: 'Дальность',
  speed: 'Скорость', rof: 'Темп огня', acc: 'Точность', energyCap: 'Энергоёмкость', energyRegen: 'Энергоотдача',
  energyUse: 'Энергопотребление', weight: 'Масса', capacity: 'Грузоподъёмность', detect: 'Обнаружение',
  repair: 'Ремонт союзников', aoe: 'Область поражения', stealth: 'Малозаметность',
};
const BEHAVIORS: { id: Behavior; name: string; desc: string }[] = [
  { id: 'aggressive', name: 'Агрессивный', desc: 'Сближается и давит огнём' },
  { id: 'defensive', name: 'Оборонительный', desc: 'Держит позицию у точки высадки' },
  { id: 'support', name: 'Поддержка', desc: 'Дистанция и помощь отряду' },
  { id: 'structures', name: 'По структурам', desc: 'Приоритет — турели и укрепления' },
  { id: 'kite', name: 'Дальний бой', desc: 'Держит максимальную дистанцию' },
];

export default function GarageScreen() {
  const { state, dispatch } = useGame();
  const [selId, setSelId] = useState<string | null>(state.robots[0]?.id ?? null);
  const sel = state.robots.find((r) => r.id === selId) ?? null;
  const [draft, setDraft] = useState<Build>(() => sel ? structuredClone(sel.build) : { name: 'Мех-01', slots: { chassis: null, mobility: null, reactor: null, weapon: null, defense: null, utility: null }, behavior: 'aggressive' });
  const [picker, setPicker] = useState<PartCat | null>(null);
  const [showAll, setShowAll] = useState(false);

  const selectRobot = (r: Robot | null) => {
    setSelId(r?.id ?? null);
    setDraft(r ? structuredClone(r.build) : { name: `Мех-${state.robots.length + 1}`, slots: { chassis: null, mobility: null, reactor: null, weapon: null, defense: null, utility: null }, behavior: 'aggressive' });
    setShowAll(false);
  };

  const usedElsewhere = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of state.robots) {
      if (r.id === selId) continue;
      for (const p of Object.values(r.build.slots)) if (p) m[p] = r.build.name;
    }
    return m;
  }, [state.robots, selId]);

  const stats = useMemo(() => computeStats(draft, state.researched, state.profile.engLevel), [draft, state.researched, state.profile.engLevel]);
  const baseStats = useMemo(() => {
    if (!sel) return null;
    return computeStats(sel.build, state.researched, state.profile.engLevel);
  }, [sel, state.researched, state.profile.engLevel]);
  const delta = (k: keyof typeof stats) => (baseStats && typeof stats[k] === 'number' && typeof baseStats[k] === 'number' ? (stats[k] as number) - (baseStats[k] as number) : undefined);
  const v = buildValid(draft);
  const fcolor = state.profile.faction ? FACTIONS[state.profile.faction].color : '#35e0c8';
  const repairing = (id: string) => state.base.repairs.find((r) => r.robotId === id);

  const save = () => {
    if (!v.ok) return;
    const robot: Robot = sel ? { ...sel, build: { ...draft } } : { id: uid(), build: { ...draft }, condition: 100 };
    dispatch({ type: 'SAVE_ROBOT', robot });
    setSelId(robot.id);
  };

  const partsFor = (cat: PartCat) => PARTS.filter((p) => p.cat === cat);
  const owned = (p: Part) => (state.inv[p.id] ?? 0) > 0;
  const locked = (p: Part) => {
    if (p.req?.research && !state.researched.includes(p.req.research)) return `Нужно: ${RESEARCH_MAP[p.req.research]?.name}`;
    if (p.req?.eng && state.profile.engLevel < p.req.eng) return `Инженерный уровень ${p.req.eng}`;
    return null;
  };

  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar grid-bg">
      <div className="p-3 space-y-3 pb-8">
        {/* ангар */}
        <div className="panel chamfer scanlines relative p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="hud-label">Ангар · {state.robots.length}/{maxRobots(state)}</span>
            <button className="btn-acc chamfer-xs px-3 py-1.5 text-[11px] font-bold flex items-center gap-1" disabled={state.robots.length >= maxRobots(state) && !sel} onClick={() => selectRobot(null)}>
              <Icon name="plus" size={13} /> НОВЫЙ
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {state.robots.map((r) => {
              const st = computeStats(r.build, state.researched, state.profile.engLevel);
              const rep = repairing(r.id);
              return (
                <button key={r.id} onClick={() => selectRobot(r)} className={`shrink-0 w-32 chamfer-sm border p-2 text-left ${selId === r.id ? 'border-acc bg-acc/10' : 'border-line bg-bg2'}`}>
                  <div className="flex justify-center h-20 items-center"><RobotSVG build={r.build} color={fcolor} size={64} animate={false} /></div>
                  <div className="text-[11px] font-bold truncate">{r.build.name}</div>
                  <div className="text-[9px] font-mono text-dim">{st.archetype}</div>
                  <Bar value={rep ? 100 : r.condition} max={100} h={4} color={r.condition > 60 ? '#4fd58c' : r.condition > 30 ? '#f2a93b' : '#e4574f'} className="mt-1" />
                  {rep && <div className="text-[9px] font-mono text-acc mt-0.5">Ремонт {fmtDur((rep.startedAt + rep.duration - Date.now()) / 1000)}</div>}
                </button>
              );
            })}
            {state.robots.length === 0 && (
              <div className="py-3 px-2 space-y-2">
                <div className="text-[11px] text-dim">Пусто. Соберите первого меха из стартовых модулей.</div>
                <button
                  className="btn-ghost chamfer-xs px-3 py-2 text-[10px] font-bold text-acc border-acc/40"
                  onClick={() => setDraft({ name: 'Авангард-1', behavior: 'aggressive', slots: { chassis: 'ch_vanguard', mobility: 'mb_tracks', reactor: 'rc_100', weapon: 'wp_gun', defense: 'df_composite', utility: 'ut_radar' } })}
                >
                  БЫСТРАЯ СБОРКА: ШТУРМОВАЯ МАШИНА
                </button>
              </div>
            )}
          </div>
        </div>

        {/* превью */}
        <div className="panel chamfer scanlines relative p-3">
          <div className="flex gap-3">
            <div className="w-40 shrink-0 flex items-center justify-center bg-bg0/50 border border-line chamfer-sm relative overflow-hidden">
              <div className="absolute inset-0 grid-bg opacity-60" />
              <RobotSVG build={draft} color={fcolor} size={148} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <input type="text" maxLength={16} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full px-2 py-1.5 text-sm font-bold chamfer-xs" />
              <div className="flex items-center gap-2">
                <span className="chamfer-xs px-2 py-1 bg-acc/12 border border-acc/50 text-acc text-[10px] font-mono font-bold">{stats.archetype.toUpperCase()}</span>
                {stats.overloaded && <span className="chamfer-xs px-2 py-1 bg-danger/12 border border-danger/50 text-danger text-[10px] font-mono font-bold blink">ПЕРЕГРУЗ</span>}
              </div>
              <div>
                <div className="flex justify-between hud-label mb-0.5"><span>Масса</span><span className={stats.weight > stats.capacity ? 'text-danger' : 'text-dim'}>{stats.weight}/{stats.capacity}</span></div>
                <Bar value={stats.weight} max={stats.capacity} h={5} color={stats.weight > stats.capacity ? '#e4574f' : '#5fc4e8'} />
              </div>
              <div>
                <div className="flex justify-between hud-label mb-0.5"><span>Энергобаланс</span><span className={stats.energyUse > stats.energyRegen ? 'text-amb' : 'text-ok'}>{stats.energyUse}/{stats.energyRegen}</span></div>
                <Bar value={stats.energyUse} max={Math.max(stats.energyRegen, stats.energyUse)} h={5} color={stats.energyUse > stats.energyRegen ? '#f2a93b' : '#4fd58c'} />
                {stats.energyUse > stats.energyRegen && <div className="text-[9px] text-amb mt-0.5">Дефицит энергии снижает темп огня</div>}
              </div>
              {sel && (
                <div>
                  <div className="flex justify-between hud-label mb-0.5"><span>Состояние</span><span className="text-dim">{sel.condition}%</span></div>
                  <Bar value={sel.condition} max={100} h={5} color={sel.condition > 60 ? '#4fd58c' : sel.condition > 30 ? '#f2a93b' : '#e4574f'} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* слоты */}
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CAT_LABEL) as PartCat[]).map((cat) => {
            const pid = draft.slots[cat];
            const p = pid ? PART_MAP[pid] : null;
            return (
              <button key={cat} onClick={() => setPicker(cat)} className="panel chamfer-sm p-2.5 text-left active:scale-[.98] transition-transform">
                <div className="hud-label mb-1">{CAT_LABEL[cat]}</div>
                {p ? (
                  <>
                    <div className="text-[12px] font-bold text-ink leading-tight">{p.name}</div>
                    <div className="flex gap-0.5 mt-1">
                      {[1, 2, 3].map((i) => <span key={i} className={`w-3 h-1 ${i <= p.tier ? (p.tier === 3 ? 'bg-[#f08fb8]' : p.tier === 2 ? 'bg-[#c9a0f0]' : 'bg-acc') : 'bg-line'}`} />)}
                    </div>
                  </>
                ) : <div className="text-[11px] text-faint">— не установлено —</div>}
              </button>
            );
          })}
        </div>

        {/* характеристики */}
        <div className="panel chamfer scanlines relative p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="hud-label">Боевые характеристики</span>
            <button className={`chamfer-xs px-2 py-1 text-[10px] font-mono font-bold border ${showAll ? 'bg-acc text-bg0 border-acc' : 'bg-bg2 text-dim border-line'}`} onClick={() => setShowAll(!showAll)}>
              {showAll ? 'КРАТКО' : 'ПОДРОБНО'}
            </button>
          </div>
          <StatRow label="Прочность" value={stats.hp} max={800} delta={delta('hp')} />
          <StatRow label="Урон" value={stats.dmg} max={80} delta={delta('dmg')} />
          <StatRow label="Дальность" value={stats.range} max={320} delta={delta('range')} />
          <StatRow label="Скорость" value={stats.speed} max={110} delta={delta('speed')} />
          <StatRow label="Точность" value={stats.acc} max={100} delta={delta('acc')} unit="%" />
          {showAll && (
            <>
              <StatRow label="Броня" value={stats.armor} max={24} delta={delta('armor')} />
              <StatRow label="Щит" value={stats.shield} max={160} delta={delta('shield')} />
              <StatRow label="Темп огня" value={stats.rof * 40} max={110} delta={delta('rof') !== undefined ? delta('rof')! * 40 : undefined} />
              <StatRow label="Обнаружение" value={stats.detect} max={260} delta={delta('detect')} />
              {stats.repair > 0 && <StatRow label="Ремонт" value={stats.repair} max={15} />}
              {stats.aoe > 0 && <StatRow label="Область" value={stats.aoe} max={60} />}
            </>
          )}
        </div>

        {/* поведение */}
        <div className="panel chamfer p-3">
          <div className="hud-label mb-2">Боевой протокол</div>
          <div className="flex gap-1.5 flex-wrap">
            {BEHAVIORS.map((b) => (
              <button key={b.id} onClick={() => setDraft({ ...draft, behavior: b.id })}
                className={`chamfer-xs px-2.5 py-1.5 text-[11px] font-bold border ${draft.behavior === b.id ? 'bg-amb text-bg0 border-amb' : 'bg-bg2 text-dim border-line'}`}>
                {b.name}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-faint mt-1.5">{BEHAVIORS.find((b) => b.id === draft.behavior)?.desc}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-acc chamfer py-3 text-sm" disabled={!v.ok || !draft.name.trim()} onClick={save}>
            {sel ? 'СОХРАНИТЬ' : 'СОБРАТЬ МЕХА'}
          </button>
          <button className="btn-ghost chamfer-sm py-3 text-xs text-danger border-danger/40" disabled={!sel || !!repairing(sel.id)} onClick={() => { if (sel && confirm('Разобрать меха?')) { dispatch({ type: 'DELETE_ROBOT', id: sel.id }); selectRobot(null); } }}>
            РАЗОБРАТЬ
          </button>
        </div>
        {!v.ok && <p className="text-[11px] text-amb text-center">{v.reason}</p>}
        {sel && sel.condition < 100 && !repairing(sel.id) && (
          <button className="btn-ghost chamfer-sm w-full py-2.5 text-xs flex items-center justify-center gap-2" onClick={() => dispatch({ type: 'START_REPAIR', robotId: sel.id })}>
            <Icon name="wrench" size={15} /> В ремонт ({Math.round((100 - sel.condition) * 2.2)} кр.)
          </button>
        )}
      </div>

      {/* подбор модуля */}
      <Sheet open={!!picker} onClose={() => setPicker(null)} title={picker ? `Модуль: ${CAT_LABEL[picker]}` : ''} tall>
        {picker && (
          <div className="space-y-2">
            {draft.slots[picker] && (
              <button className="btn-ghost chamfer-xs w-full py-2 text-[11px] text-dim" onClick={() => { setDraft({ ...draft, slots: { ...draft.slots, [picker]: null } }); }}>
                Снять текущий модуль
              </button>
            )}
            {partsFor(picker).map((p) => {
              const has = owned(p);
              const lock = locked(p);
              const inUse = usedElsewhere[p.id];
              const equipped = draft.slots[picker] === p.id;
              return (
                <div key={p.id} className={`panel-deep chamfer-sm p-3 ${equipped ? 'border-acc' : ''} ${!has || lock ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-2">
                    <span className="w-1 self-stretch" style={{ background: p.tier === 3 ? '#f08fb8' : p.tier === 2 ? '#c9a0f0' : '#5c7089' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold">{p.name}</span>
                        <span className="text-[9px] font-mono text-faint">Т{p.tier} · {p.weight}т</span>
                        {has && <span className="text-[9px] font-mono text-ok">×{state.inv[p.id]}</span>}
                      </div>
                      <p className="text-[10px] text-dim leading-snug mt-0.5">{p.desc}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {Object.entries(p.mods).map(([k, val]) => (
                          <span key={k} className={`chamfer-xs px-1.5 py-0.5 text-[9px] font-mono font-bold ${(val as number) < 0 || k === 'energyUse' || k === 'weight' ? 'bg-amb/12 text-amb' : 'bg-acc/10 text-acc'}`}>
                            {MOD_LABEL[k] ?? k} {(val as number) > 0 && k !== 'weight' ? '+' : ''}{val}
                          </span>
                        ))}
                      </div>
                      {inUse && !equipped && <div className="text-[9px] font-mono text-faint mt-1">Установлен: {inUse}</div>}
                      {lock && <div className="text-[9px] font-mono text-danger mt-1 flex items-center gap-1"><Icon name="lock" size={11} /> {lock}</div>}
                    </div>
                    <button className="btn-acc chamfer-xs px-3 py-2 text-[11px] font-bold shrink-0" disabled={!has || !!lock || equipped || !!inUse} onClick={() => { setDraft({ ...draft, slots: { ...draft.slots, [picker]: p.id } }); setPicker(null); }}>
                      {equipped ? '✓' : 'ВЗЯТЬ'}
                    </button>
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-faint text-center pt-1">Модули изготавливаются на заводах и выдаются за задания. Один модуль — один мех.</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
