import { useGame } from '../game/state';
import {
  MODULES, moduleCost, baseDefense, revealRadius, maxRobots, repairSlots, fmt, fmtDur, RES_META,
} from '../game/data';
import type { ResKey } from '../game/types';
import { Icon, Bar } from '../components/ui';

export default function BaseScreen() {
  const { state, dispatch } = useGame();
  const baseHex = state.terrs.find((t) => t.id === state.base.hexId);
  const night = (() => { const h = new Date().getHours(); return h >= 23 || h < 7; })();
  const shieldLeft = state.base.shieldUntil - Date.now();
  const repairable = state.robots.filter((r) => r.condition < 100 && !state.base.repairs.some((j) => j.robotId === r.id));

  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar grid-bg">
      <div className="p-3 space-y-3 pb-8">
        <div className="panel chamfer scanlines relative p-3">
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
          <p className="text-[10px] text-faint mt-2 leading-snug">
            Ночью (23:00–07:00) действует перемирие — база неприступна. После отражённого рейда включается аварийный щит. Разрушенный штаб можно перенести на любую свою зону за 300 кр.
          </p>
        </div>

        <div className="hud-label px-1">Ремонтная служба · {state.base.repairs.length}/{repairSlots(state)} постов</div>
        {state.base.repairs.length > 0 && (
          <div className="space-y-1.5">
            {state.base.repairs.map((j) => {
              const r = state.robots.find((x) => x.id === j.robotId);
              const p = Math.min(1, (Date.now() - j.startedAt) / j.duration);
              return (
                <div key={j.robotId} className="panel-deep chamfer-xs p-2.5">
                  <div className="flex justify-between text-[11px] font-bold mb-1">
                    <span>{r?.build.name ?? 'Мех'}</span>
                    <span className="font-mono text-acc">{fmtDur((j.startedAt + j.duration - Date.now()) / 1000)}</span>
                  </div>
                  <Bar value={p} max={1} h={5} color="#4fd58c" />
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

        <div className="hud-label px-1">Модули базы</div>
        <div className="grid grid-cols-2 gap-2">
          {MODULES.map((m) => {
            const lv = state.base.modules[m.id] ?? 1;
            const up = state.base.upgrades.find((u) => u.moduleId === m.id);
            const gated = m.id !== 'hq' && lv + 1 > (state.base.modules.hq ?? 1);
            const { cost, time } = moduleCost(m.id, lv + 1);
            const canPay = (cost.credits ?? 0) <= state.credits && Object.entries(cost).every(([k, v]) => k === 'credits' || state.res[k as ResKey] >= (v ?? 0));
            return (
              <div key={m.id} className={`panel chamfer-sm p-2.5 ${m.id === 'hq' ? 'col-span-2 border-amb/50' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-7 h-7 chamfer-xs bg-bg2 border border-line flex items-center justify-center text-acc"><Icon name={m.icon} size={15} /></span>
                  <span className="text-[12px] font-bold flex-1">{m.name}</span>
                  <span className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => <span key={i} className={`w-2 h-2 ${i <= lv ? 'bg-amb' : 'bg-line'}`} style={{ clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' }} />)}
                  </span>
                </div>
                <div className="text-[10px] text-dim leading-snug min-h-6">{m.desc}</div>
                <div className="text-[10px] font-mono text-acc mt-0.5">{m.effect(lv)}</div>
                {up ? (
                  <div className="mt-1.5">
                    <Bar value={(Date.now() - up.startedAt) / up.duration} max={1} h={5} color="#f2a93b" />
                    <div className="text-[9px] font-mono text-amb mt-0.5">Стройка: {fmtDur((up.startedAt + up.duration - Date.now()) / 1000)}</div>
                  </div>
                ) : lv < 5 ? (
                  <button className="btn-ghost chamfer-xs w-full mt-1.5 py-1.5 text-[10px] font-bold disabled:opacity-40" disabled={gated || !canPay || state.base.upgrades.length >= 2}
                    onClick={() => dispatch({ type: 'UPGRADE_MODULE', moduleId: m.id })}>
                    {gated ? 'НУЖЕН ШТАБ ВЫШЕ' : `УР.${lv + 1} · ${Object.entries(cost).map(([k, v]) => `${fmt(v as number)} ${k === 'credits' ? 'кр' : RES_META[k as ResKey].short}`).join(' ')} · ${fmtDur(time)}`}
                  </button>
                ) : <div className="text-[9px] font-mono text-faint mt-1.5">МАКС. УРОВЕНЬ</div>}
              </div>
            );
          })}
        </div>
        <div className="hud-label px-1">Памятка командира</div>
        <div className="panel-deep chamfer-sm p-3 space-y-1.5 text-[11px] text-dim leading-snug">
          <p>· Склад увеличивает лимит накопленного дохода территорий — собирайте его регулярно.</p>
          <p>· Турели снижают шанс потери зон от рейдов. Укрепление зон на карте тоже работает.</p>
          <p>· Радар расширяет разведку: открывайте зоны для XP, заданий и событий.</p>
        </div>
      </div>
    </div>
  );
}
