import { useState } from 'react';
import { useGame, networkBonus } from '../game/state';
import {
  MODULES, moduleCost, baseDefense, revealRadius, maxRobots, repairSlots, fmt, fmtDur, RES_META,
} from '../game/data';
import type { ResKey } from '../game/types';
import { Icon, Bar, Sheet } from '../components/ui';

/** позиции модулей на визуальной схеме базы (в процентах контейнера) */
const POS: Record<string, { x: number; y: number; big?: boolean }> = {
  hq: { x: 50, y: 46, big: true },
  garage: { x: 22, y: 26 },
  storage: { x: 78, y: 26 },
  generator: { x: 22, y: 66 },
  turrets: { x: 78, y: 66 },
  radar: { x: 50, y: 12 },
  lab: { x: 12, y: 46 },
  workshop: { x: 88, y: 46 },
  shieldgen: { x: 50, y: 82 },
};

export default function BaseScreen() {
  const { state, dispatch } = useGame();
  const [selMod, setSelMod] = useState<string | null>(null);
  const baseHex = state.terrs.find((t) => t.id === state.base.hexId);
  const night = (() => { const h = new Date().getHours(); return h >= 23 || h < 7; })();
  const shieldLeft = state.base.shieldUntil - Date.now();
  const repairable = state.robots.filter((r) => r.condition < 100 && !state.base.repairs.some((j) => j.robotId === r.id));
  const mod = selMod ? MODULES.find((m) => m.id === selMod) : null;
  const sel = mod ? { def: mod, lv: state.base.modules[mod.id] ?? 1, up: state.base.upgrades.find((u) => u.moduleId === mod.id) } : null;
  const net = networkBonus(state.maxCluster);

  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar grid-bg">
      <div className="p-3 space-y-3 pb-8">
        {/* заголовок */}
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 chamfer-sm bg-amb/15 border border-amb/50 flex items-center justify-center text-amb"><Icon name="hq" size={22} /></span>
          <div className="flex-1 min-w-0">
            <div className="font-[family-name:var(--font-disp)] text-sm tracking-wide truncate">ШТАБ · {baseHex?.name ?? '—'}</div>
            <div className="text-[10px] font-mono text-dim">Оборона {baseDefense(state)} · Обзор {revealRadius(state)} м · Ангар {state.robots.length}/{maxRobots(state)}</div>
          </div>
          <span className={`chamfer-xs px-2 py-1.5 text-[10px] font-mono font-bold border ${night || shieldLeft > 0 ? 'text-ok border-ok/50 bg-ok/10' : 'text-danger border-danger/50 bg-danger/10 blink'}`}>
            {night ? 'НОЧНОЙ ЩИТ' : shieldLeft > 0 ? `ЩИТ ${fmtDur(shieldLeft / 1000)}` : 'БЕЗ ЩИТА'}
          </span>
        </div>

        {/* визуальная схема базы */}
        <div className="panel chamfer scanlines relative overflow-hidden" style={{ height: 330 }}>
          <div className="absolute inset-0 grid-bg opacity-70" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(53,224,200,0.07) 0%, transparent 60%)' }} />
          {/* соединительные линии */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {MODULES.filter((m) => m.id !== 'hq').map((m) => (
              <line key={m.id} x1={POS.hq.x} y1={POS.hq.y} x2={POS[m.id].x} y2={POS[m.id].y} stroke="#2f4364" strokeWidth="0.35" strokeDasharray="1.6 1.6" />
            ))}
          </svg>
          {(shieldLeft > 0 || night) && (
            <div className="absolute rounded-full pointer-events-none anim-glow" style={{ left: '50%', top: '46%', width: '86%', aspectRatio: '1', transform: 'translate(-50%,-50%)', border: '1.5px solid rgba(79,213,140,0.4)' }} />
          )}
          {MODULES.map((m) => {
            const lv = state.base.modules[m.id] ?? 1;
            const up = state.base.upgrades.find((u) => u.moduleId === m.id);
            const p = POS[m.id];
            const sz = p.big ? 84 : 68;
            return (
              <button key={m.id} onClick={() => setSelMod(m.id)} className="absolute -translate-x-1/2 -translate-y-1/2 active:scale-95 transition-transform"
                style={{ left: `${p.x}%`, top: `${p.y}%`, width: sz }}>
                <div className={`chamfer-sm border relative flex flex-col items-center justify-center ${p.big ? 'bg-[#241d0c] border-amb/70' : 'bg-bg2 border-line2'} ${up ? 'border-acc' : ''}`}
                  style={{ height: sz, boxShadow: p.big ? '0 0 26px -6px rgba(242,169,59,0.5)' : up ? '0 0 18px -6px rgba(53,224,200,0.6)' : '0 4px 14px -6px rgba(0,0,0,0.8)' }}>
                  <Icon name={m.icon} size={p.big ? 26 : 20} className={p.big ? 'text-amb' : 'text-acc'} />
                  <span className="text-[8px] font-bold mt-0.5 leading-none">{m.name.split(' ')[0].toUpperCase()}</span>
                  <span className="flex gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i} className="w-1.5 h-1.5" style={{ background: i <= lv ? (p.big ? '#f2a93b' : '#35e0c8') : '#223148', clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' }} />
                    ))}
                  </span>
                  {up && (
                    <span className="absolute bottom-1 left-1.5 right-1.5">
                      <Bar value={(Date.now() - up.startedAt) / up.duration} max={1} h={3} color="#35e0c8" />
                    </span>
                  )}
                  {p.big && <span className="absolute -top-2 left-1/2 -translate-x-1/2 chamfer-xs bg-amb text-bg0 px-1.5 text-[8px] font-mono font-bold">УР.{lv}</span>}
                </div>
              </button>
            );
          })}
          <div className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] font-mono text-faint">Нажмите на модуль для улучшения</div>
        </div>

        {/* сеть территорий */}
        <div className="panel chamfer p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="hud-label">Сеть территорий</span>
            <span className="text-[10px] font-mono text-acc font-bold">{net > 0 ? `+${Math.round(net * 100)}% к доходу` : 'без бонуса'}</span>
          </div>
          <div className="flex items-center gap-2">
            {[3, 5, 10].map((th, i) => {
              const on = state.maxCluster >= th;
              return (
                <div key={th} className="flex-1 text-center">
                  <div className={`mx-auto w-7 h-7 chamfer-xs border flex items-center justify-center text-[10px] font-mono font-bold ${on ? 'bg-acc/15 border-acc text-acc' : 'bg-bg2 border-line text-faint'}`}>{th}</div>
                  <div className="text-[8px] font-mono text-faint mt-0.5">+{[5, 10, 15][i]}%</div>
                </div>
              );
            })}
            <div className="flex-1 text-center">
              <div className="mx-auto w-7 h-7 chamfer-xs bg-amb/15 border border-amb/60 text-amb flex items-center justify-center text-[10px] font-mono font-bold">{state.maxCluster}</div>
              <div className="text-[8px] font-mono text-faint mt-0.5">связано</div>
            </div>
          </div>
          <p className="text-[9px] text-faint mt-1.5">Соседние зоны под вашим контролем дают бонус производства. Разрозненные владения бонуса не дают.</p>
        </div>

        {/* ремонтная служба */}
        <div className="hud-label px-1">Ремонтная служба · {state.base.repairs.length}/{repairSlots(state)} постов</div>
        {state.base.repairs.length > 0 && (
          <div className="space-y-1.5">
            {state.base.repairs.map((j) => {
              const r = state.robots.find((x) => x.id === j.robotId);
              return (
                <div key={j.robotId} className="panel-deep chamfer-xs p-2.5">
                  <div className="flex justify-between text-[11px] font-bold mb-1">
                    <span>{r?.build.name ?? 'Мех'}</span>
                    <span className="font-mono text-acc">{fmtDur((j.startedAt + j.duration - Date.now()) / 1000)}</span>
                  </div>
                  <Bar value={(Date.now() - j.startedAt) / j.duration} max={1} h={5} color="#4fd58c" />
                </div>
              );
            })}
          </div>
        )}
        {repairable.length > 0 && (
          <div className="space-y-1.5">
            {repairable.map((r) => {
              const cost = Math.round((100 - r.condition) * 2.2);
              return (
                <div key={r.id} className="panel-deep chamfer-xs p-2.5 flex items-center gap-2">
                  <span className="flex-1 text-[12px] font-bold">{r.build.name} <span className="font-mono text-[10px] text-dim">· {r.condition}%</span></span>
                  <Bar value={r.condition} max={100} h={5} color={r.condition > 30 ? '#f2a93b' : '#e4574f'} className="w-20" />
                  <button className="btn-acc chamfer-xs px-2.5 py-1.5 text-[10px] font-bold" disabled={state.credits < cost || state.base.repairs.length >= repairSlots(state)} onClick={() => dispatch({ type: 'START_REPAIR', robotId: r.id })}>
                    РЕМОНТ · {cost} кр.
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {repairable.length === 0 && state.base.repairs.length === 0 && (
          <div className="panel-deep chamfer-xs p-3 text-[11px] text-dim flex items-center gap-2"><Icon name="check" size={15} className="text-ok" /> Вся техника в строю</div>
        )}

        <div className="panel-deep chamfer-sm p-3 space-y-1.5 text-[11px] text-dim leading-snug">
          <p>· Склад увеличивает лимит накопленного дохода территорий — собирайте его регулярно.</p>
          <p>· Турели снижают шанс потери зон от рейдов. Укрепление зон на карте тоже работает.</p>
          <p>· Ночью (23:00–07:00) действует перемирие — база неприступна. После отражённого рейда включается аварийный щит.</p>
        </div>
      </div>

      {/* карточка модуля */}
      <Sheet open={!!sel} onClose={() => setSelMod(null)} title={sel?.def.name ?? ''}>
        {sel && (() => {
          const gated = sel.def.id !== 'hq' && sel.lv + 1 > (state.base.modules.hq ?? 1);
          const { cost, time } = moduleCost(sel.def.id, sel.lv + 1);
          const canPay = (cost.credits ?? 0) <= state.credits && Object.entries(cost).every(([k, v]) => k === 'credits' || state.res[k as ResKey] >= (v ?? 0));
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 chamfer-sm bg-bg2 border border-line2 flex items-center justify-center text-acc"><Icon name={sel.def.icon} size={24} /></span>
                <div className="flex-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => <span key={i} className={`w-3 h-3 ${i <= sel.lv ? 'bg-amb' : 'bg-line'}`} style={{ clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' }} />)}
                  </div>
                  <div className="text-[10px] font-mono text-dim mt-1">Уровень {sel.lv}/5</div>
                </div>
              </div>
              <p className="text-[12px] text-dim leading-snug">{sel.def.desc}</p>
              <div className="panel-deep chamfer-xs p-2.5 text-[12px] font-mono text-acc">{sel.def.effect(sel.lv)}</div>
              {sel.up ? (
                <div>
                  <Bar value={(Date.now() - sel.up.startedAt) / sel.up.duration} max={1} h={7} color="#f2a93b" />
                  <div className="flex justify-between text-[10px] font-mono mt-1">
                    <span className="text-amb">Строительство идёт</span>
                    <span className="text-amb">{fmtDur((sel.up.startedAt + sel.up.duration - Date.now()) / 1000)}</span>
                  </div>
                </div>
              ) : sel.lv < 5 ? (
                <>
                  <div className="panel-deep chamfer-xs p-2.5">
                    <div className="hud-label mb-1">Уровень {sel.lv + 1} даст</div>
                    <div className="text-[12px] font-mono text-ok">{sel.def.effect(sel.lv + 1)}</div>
                    <div className="hud-label mt-2 mb-1">Цена</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(cost).map(([k, v]) => (
                        <span key={k} className={`chamfer-xs px-2 py-1 text-[10px] font-mono font-bold border ${k === 'credits' ? (state.credits >= (v ?? 0) ? 'border-ok/50 text-ok' : 'border-danger/50 text-danger') : state.res[k as ResKey] >= (v ?? 0) ? 'border-ok/50 text-ok' : 'border-danger/50 text-danger'}`}>
                          {fmt(v ?? 0)} {k === 'credits' ? 'кр.' : RES_META[k as ResKey].short}
                        </span>
                      ))}
                      <span className="chamfer-xs px-2 py-1 text-[10px] font-mono text-dim border border-line">{fmtDur(time)}</span>
                    </div>
                  </div>
                  <button className="btn-acc chamfer w-full py-3.5 text-sm" disabled={gated || !canPay || state.base.upgrades.length >= 2} onClick={() => { dispatch({ type: 'UPGRADE_MODULE', moduleId: sel.def.id }); setSelMod(null); }}>
                    {gated ? 'СНАЧАЛА УЛУЧШИТЕ ШТАБ' : state.base.upgrades.length >= 2 ? 'СТРОЙКА ЗАНЯТА (2/2)' : 'ПОСТРОИТЬ'}
                  </button>
                </>
              ) : (
                <div className="text-center text-[11px] font-mono text-faint py-2">МАКСИМАЛЬНЫЙ УРОВЕНЬ</div>
              )}
            </div>
          );
        })()}
      </Sheet>
    </div>
  );
}
