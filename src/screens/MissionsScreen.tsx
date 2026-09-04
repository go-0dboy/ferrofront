import { useState } from 'react';
import { useGame, dailyMissions } from '../game/state';
import { WALK_MILESTONES, WEEKLY_POOL, OPS_CHAIN, fmt, fmtDur, RES_META, weekEndsIn } from '../game/data';
import type { ResKey } from '../game/types';
import { Icon, Bar } from '../components/ui';

function Reward({ r }: { r: { credits?: number; res?: Partial<Record<ResKey, number>>; xp?: number; part?: string; label?: string } }) {
  return (
    <span className="text-[9px] font-mono text-amb">
      {[r.credits ? `${r.credits} кр.` : '', r.xp ? `${r.xp} XP` : '', ...(r.res ? Object.entries(r.res).map(([k, v]) => `${v} ${RES_META[k as ResKey]?.short}`) : []), r.part ? 'модуль' : '', r.label ?? ''].filter(Boolean).join(' · ')}
    </span>
  );
}

export default function MissionsScreen() {
  const { state, dispatch } = useGame();
  const [tab, setTab] = useState<'daily' | 'weekly' | 'ops' | 'walk'>('daily');
  const dailies = dailyMissions(state);
  const ops = state.ops.done ? null : OPS_CHAIN[state.ops.step];
  const opsVal = ops ? Math.min(ops.target, state.stats[ops.metric] ?? 0) : 0;
  const landmarks = state.terrs.filter((t) => t.type === 'landmark');

  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar grid-bg">
      <div className="p-3 space-y-3 pb-8">
        <div className="flex gap-1.5">
          {([['daily', 'День'], ['weekly', 'Неделя'], ['ops', 'Операция'], ['walk', 'Походы']] as const).map(([id, name]) => (
            <button key={id} onClick={() => setTab(id)} className={`chamfer-sm px-3 py-2 text-[11px] font-bold flex-1 ${tab === id ? 'btn-acc' : 'btn-ghost'}`}>{name}</button>
          ))}
        </div>

        {tab === 'weekly' && (
          <div className="space-y-2">
            <div className="panel chamfer scanlines relative p-3 border-l-2 border-l-acc">
              <div className="flex items-center justify-between">
                <span className="hud-label !text-acc">Недельные цели сектора</span>
                <span className="text-[10px] font-mono text-dim">сброс через {fmtDur(weekEndsIn() / 1000)}</span>
              </div>
              <p className="text-[10px] text-dim mt-1 leading-snug">Крупные награды за устойчивую игру: редкие материалы и кредиты. Выполнять всё не обязательно.</p>
            </div>
            {WEEKLY_POOL.map((m) => {
              const val = Math.min(m.target, state.weekly.counters[m.metric] ?? 0);
              const claimed = state.weekly.claimed.includes(m.id);
              const done = val >= m.target;
              return (
                <div key={m.id} className={`panel chamfer-sm p-3 ${claimed ? 'opacity-55' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 shrink-0 chamfer-xs border flex items-center justify-center ${done ? 'border-acc/60 text-acc bg-acc/10' : 'border-line text-faint bg-bg2'}`}>
                      <Icon name={m.metric.includes('Walk') ? 'walk' : m.metric.includes('Wins') ? 'sword' : m.metric.includes('Captures') ? 'flag' : m.metric.includes('Craft') ? 'factory' : m.metric.includes('Upgrades') ? 'hq' : 'star'} size={15} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold truncate">{m.title}</div>
                      <Reward r={m.reward} />
                    </div>
                    <button className={`chamfer-xs px-3 py-2 text-[10px] font-bold ${claimed ? 'btn-ghost' : done ? 'btn-acc' : 'btn-ghost opacity-60'}`} disabled={!done || claimed}
                      onClick={() => dispatch({ type: 'CLAIM_WEEKLY_MISSION', id: m.id })}>
                      {claimed ? '✓' : 'ВЗЯТЬ'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Bar value={val} max={m.target} h={5} color={done ? '#35e0c8' : '#4c9ef5'} className="flex-1" />
                    <span className="font-mono text-[10px] text-dim w-20 text-right">{fmt(val)}/{fmt(m.target)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'daily' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="hud-label">Боевая смена · сброс в полночь</span>
              <span className="text-[10px] font-mono text-dim">{state.daily.claimed.length}/5 получено</span>
            </div>
            {dailies.map((m) => {
              const val = Math.min(m.target, state.daily.counters[m.metric] ?? 0);
              const claimed = state.daily.claimed.includes(m.id);
              const done = val >= m.target;
              return (
                <div key={m.id} className={`panel chamfer-sm p-3 ${claimed ? 'opacity-55' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 shrink-0 chamfer-xs border flex items-center justify-center ${done ? 'border-ok/60 text-ok bg-ok/10' : 'border-line text-faint bg-bg2'}`}>
                      <Icon name={m.metric.includes('Walk') || m.metric.includes('Steps') ? 'walk' : m.metric.includes('Capture') ? 'flag' : m.metric.includes('Win') ? 'sword' : m.metric.includes('Craft') ? 'factory' : m.metric.includes('Disc') ? 'eye' : 'target'} size={15} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold truncate">{m.title}</div>
                      <Reward r={m.reward} />
                    </div>
                    <button className={`chamfer-xs px-3 py-2 text-[10px] font-bold ${claimed ? 'btn-ghost' : done ? 'btn-acc' : 'btn-ghost opacity-60'}`} disabled={!done || claimed}
                      onClick={() => dispatch({ type: 'CLAIM_MISSION', id: m.id })}>
                      {claimed ? '✓' : 'ВЗЯТЬ'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Bar value={val} max={m.target} h={5} color={done ? '#4fd58c' : '#35e0c8'} className="flex-1" />
                    <span className="font-mono text-[10px] text-dim w-16 text-right">{fmt(val)}/{fmt(m.target)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'ops' && (
          <div className="space-y-2">
            <div className="panel chamfer scanlines relative p-3 border-l-2 border-l-amb">
              <div className="hud-label mb-1">Операция «Первый рубеж» · этап {Math.min(state.ops.step + 1, OPS_CHAIN.length)}/{OPS_CHAIN.length}</div>
              {ops ? (
                <>
                  <div className="font-[family-name:var(--font-disp)] text-base tracking-wide">{ops.title}</div>
                  <p className="text-[11px] text-dim leading-snug mt-1">{ops.text}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Bar value={opsVal} max={ops.target} h={6} color="#f2a93b" className="flex-1" />
                    <span className="font-mono text-[10px] text-amb">{fmt(opsVal)}/{fmt(ops.target)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Reward r={ops.reward} />
                    <button className="btn-warn chamfer-xs px-4 py-2 text-[11px] font-bold" disabled={opsVal < ops.target} onClick={() => dispatch({ type: 'CLAIM_OPS' })}>
                      {opsVal < ops.target ? 'ВЫПОЛНЯЕТСЯ' : 'ЗАВЕРШИТЬ ЭТАП'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-3">
                  <div className="font-[family-name:var(--font-disp)] text-ok text-lg">ОПЕРАЦИЯ ЗАВЕРШЕНА</div>
                  <p className="text-[11px] text-dim mt-1">Сектор закреплён за альянсом. Впереди — война за заводы.</p>
                </div>
              )}
            </div>
            <div className="hud-label px-1">Хроника операции</div>
            {OPS_CHAIN.map((s, i) => (
              <div key={s.title} className={`flex items-center gap-2.5 px-2 py-1.5 ${i === state.ops.step && !state.ops.done ? 'panel chamfer-xs' : ''}`}>
                <span className={`w-5 h-5 shrink-0 flex items-center justify-center text-[10px] font-mono font-bold border ${i < state.ops.step || state.ops.done ? 'bg-ok/15 border-ok/60 text-ok' : i === state.ops.step ? 'border-amb text-amb blink' : 'border-line text-faint'}`}>
                  {i < state.ops.step || state.ops.done ? '✓' : i + 1}
                </span>
                <span className={`text-[11px] ${i <= state.ops.step || state.ops.done ? 'text-ink font-bold' : 'text-faint'}`}>{s.title}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'walk' && (
          <div className="space-y-3">
            <div className="panel chamfer scanlines relative p-3">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 chamfer-sm bg-acc/12 border border-acc/50 flex items-center justify-center text-acc"><Icon name="walk" size={22} /></span>
                <div>
                  <div className="font-mono text-xl font-bold leading-none">{fmt(state.stats.walkM)} м</div>
                  <div className="text-[10px] font-mono text-dim mt-0.5">{fmt(state.stats.steps)} шагов всего · сегодня {fmt(state.stats.dailyWalk ?? 0)} м</div>
                </div>
              </div>
              <p className="text-[10px] text-faint mt-2 leading-snug">Ходьба и разведка кормят фронт: трофеи выдаются за пройденные километры. Играйте внимательно к реальной обстановке — дороги и закрытые территории не игровые препятствия.</p>
            </div>
            <div className="hud-label px-1">Трофеи походов</div>
            {WALK_MILESTONES.map((w) => {
              const done = state.stats.walkM >= w.m;
              const claimed = state.daily.claimed.includes(w.id);
              return (
                <div key={w.id} className={`panel chamfer-sm p-2.5 flex items-center gap-2.5 ${claimed ? 'opacity-55' : ''}`}>
                  <span className={`w-8 h-8 shrink-0 chamfer-xs border flex items-center justify-center ${done ? 'border-acc/60 text-acc bg-acc/10' : 'border-line text-faint bg-bg2'}`}><Icon name="gift" size={15} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold">{w.label}</div>
                    <Reward r={w.reward} />
                    <Bar value={Math.min(w.m, state.stats.walkM)} max={w.m} h={4} color="#35e0c8" className="mt-1" />
                  </div>
                  <button className={`chamfer-xs px-3 py-2 text-[10px] font-bold shrink-0 ${claimed ? 'btn-ghost' : done ? 'btn-acc' : 'btn-ghost opacity-60'}`} disabled={!done || claimed}
                    onClick={() => dispatch({ type: 'CLAIM_WALK', id: w.id })}>{claimed ? '✓' : 'ВЗЯТЬ'}</button>
                </div>
              );
            })}
            <div className="hud-label px-1">Разведмаршрут: достопримечательности</div>
            {landmarks.map((t) => (
              <div key={t.id} className="panel-deep chamfer-xs p-2.5 flex items-center gap-2.5">
                <span className="w-8 h-8 shrink-0 chamfer-xs border border-amb/50 text-amb bg-amb/10 flex items-center justify-center"><Icon name="star" size={15} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold truncate">{t.name}</div>
                  <div className="text-[10px] font-mono text-dim">{t.discovered ? `Открыто · ${fmt(Math.hypot(t.x - state.pos.x, t.y - state.pos.y))} м до цели` : 'Зона не разведана'}</div>
                </div>
                {t.discovered && <span className="text-[9px] font-mono text-ok">+50 кр за осмотр</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
