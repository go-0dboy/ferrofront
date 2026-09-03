import { useState } from 'react';
import { useGame } from '../game/state';
import {
  FACTIONS, RESEARCH, BRANCH_LABEL, RESEARCH_MAP, ACHIEVEMENTS, fmt, fmtDur, RES_META, xpForLevel, mulberry32,
} from '../game/data';
import type { ResKey } from '../game/types';
import { Icon, Bar } from '../components/ui';

const LB_CATS = [
  { id: 'discovered', name: 'Разведчик' }, { id: 'crafted', name: 'Инженер' }, { id: 'captures', name: 'Стратег' },
  { id: 'wins', name: 'Истребитель' }, { id: 'defended', name: 'Защитник' }, { id: 'upgradesDone', name: 'Строитель' },
  { id: 'contrib', name: 'Альянс' },
];
const LB_NAMES = ['кмд. Волкова', 'штурм. Гроза-12', 'разв. Ким', 'кап. Штиль', 'инж. Соколов', 'опер. Лада', 'тех. Мельник', 'гв. Гранит', 'серж. Ока', 'пил. Вьюга'];

export default function ProfileScreen() {
  const { state, dispatch } = useGame();
  const [lb, setLb] = useState('discovered');
  const [openRules, setOpenRules] = useState(false);
  const f = state.profile.faction ? FACTIONS[state.profile.faction] : FACTIONS.helios;
  const engNeed = Math.round(90 * Math.pow(state.profile.engLevel, 1.4));

  const ranks = [
    { name: 'Разведчик', v: state.stats.discovered ?? 0, unit: 'зон', icon: 'eye' },
    { name: 'Инженер', v: (state.stats.crafted ?? 0) + (state.stats.built ?? 0), unit: 'изд.', icon: 'wrench' },
    { name: 'Стратег', v: state.stats.captures ?? 0, unit: 'зон', icon: 'flag' },
    { name: 'Истребитель', v: state.stats.wins ?? 0, unit: 'побед', icon: 'sword' },
    { name: 'Защитник', v: state.stats.defended ?? 0, unit: 'отбито', icon: 'shield' },
    { name: 'Строитель', v: state.stats.upgradesDone ?? 0, unit: 'мод.', icon: 'hq' },
  ];

  const board = (() => {
    const rnd = mulberry32(42);
    const mine = lb === 'contrib' ? state.alliance.contrib : state.stats[lb] ?? 0;
    const rows = LB_NAMES.map((n, i) => ({ name: n, v: Math.max(1, Math.round((120 - i * 9) * (0.6 + rnd()) * (lb === 'contrib' ? 3 : 1))), self: false }));
    rows.push({ name: `${state.profile.name} (вы)`, v: mine, self: true });
    return rows.sort((a, b) => b.v - a.v);
  })();

  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar grid-bg">
      <div className="p-3 space-y-3 pb-8">
        <div className="panel chamfer scanlines relative p-3">
          <div className="flex items-center gap-3">
            <span className="w-14 h-14 chamfer-sm flex items-center justify-center font-[family-name:var(--font-disp)] text-2xl" style={{ background: f.soft, border: `1px solid ${f.color}`, color: f.color }}>
              {state.profile.name.slice(0, 1).toUpperCase() || 'К'}
            </span>
            <div className="flex-1 min-w-0">
              <input type="text" maxLength={16} value={state.profile.name} onChange={(e) => dispatch({ type: 'SET_NAME', name: e.target.value })} className="px-2 py-1 text-sm font-bold w-full chamfer-xs" />
              <div className="text-[10px] font-mono text-dim mt-0.5">{f.name} · в секторе с {new Date(state.startedAt).toLocaleDateString('ru-RU')}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1"><span className="text-acc font-bold">УР. {state.profile.level} КОМАНДИР</span><span className="text-dim">{fmt(state.profile.xp)}/{fmt(xpForLevel(state.profile.level))}</span></div>
              <Bar value={state.profile.xp} max={xpForLevel(state.profile.level)} h={6} color="#35e0c8" />
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1"><span className="text-amb font-bold">УР. {state.profile.engLevel} ИНЖЕНЕР</span><span className="text-dim">{fmt(state.profile.engXp)}/{fmt(engNeed)}</span></div>
              <Bar value={state.profile.engXp} max={engNeed} h={6} color="#f2a93b" />
            </div>
          </div>
        </div>

        <div className="hud-label px-1">Полевые ранги</div>
        <div className="grid grid-cols-3 gap-2">
          {ranks.map((r) => (
            <div key={r.name} className="panel-deep chamfer-xs p-2 text-center">
              <Icon name={r.icon} size={16} className="mx-auto text-acc" />
              <div className="font-mono text-sm font-bold mt-0.5">{fmt(r.v)}</div>
              <div className="text-[8px] font-mono text-faint uppercase tracking-wider">{r.name} · {r.unit}</div>
            </div>
          ))}
        </div>

        {state.research && (
          <div className="panel chamfer p-3 border-l-2 border-l-acc">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-bold flex items-center gap-2"><Icon name="flask" size={15} className="text-acc" /> {RESEARCH_MAP[state.research.id].name}</span>
              <span className="font-mono text-[11px] text-acc">{fmtDur((state.research.startedAt + state.research.duration - Date.now()) / 1000)}</span>
            </div>
            <Bar value={(Date.now() - state.research.startedAt) / state.research.duration} max={1} h={6} color="#35e0c8" />
          </div>
        )}
        <div className="hud-label px-1">Дерево исследований</div>
        <div className="space-y-2">
          {(['weapon', 'armor', 'mobility', 'production', 'energy'] as const).map((br) => (
            <div key={br} className="panel chamfer-sm p-2.5">
              <div className="hud-label mb-1.5">{BRANCH_LABEL[br]}</div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {RESEARCH.filter((r) => r.branch === br).map((r) => {
                  const done = state.researched.includes(r.id);
                  const active = state.research?.id === r.id;
                  const locked = !!r.requires && !state.researched.includes(r.requires);
                  const canPay = (r.cost.credits ?? 0) <= state.credits && Object.entries(r.cost).every(([k, v]) => k === 'credits' || state.res[k as ResKey] >= (v ?? 0));
                  return (
                    <button key={r.id} disabled={done || locked || active || !!state.research} onClick={() => dispatch({ type: 'START_RESEARCH', id: r.id })}
                      className={`shrink-0 w-40 chamfer-xs border p-2 text-left ${done ? 'border-ok/60 bg-ok/8' : active ? 'border-acc/70 bg-acc/10' : locked ? 'border-line opacity-50' : canPay ? 'border-line2 bg-bg2 active:scale-[.98]' : 'border-line opacity-70'}`}>
                      <div className="flex items-center gap-1.5">
                        {done ? <Icon name="check" size={12} className="text-ok" /> : locked ? <Icon name="lock" size={12} className="text-faint" /> : <span className="w-3 h-3 border border-line2 flex items-center justify-center text-[8px] font-mono text-dim">{r.tier}</span>}
                        <span className="text-[11px] font-bold leading-tight">{r.name}</span>
                      </div>
                      <div className="text-[9px] text-dim leading-snug mt-1">{r.desc}</div>
                      {!done && <div className="text-[9px] font-mono text-amb mt-1">{Object.entries(r.cost).map(([k, v]) => `${v} ${k === 'credits' ? 'кр' : RES_META[k as ResKey].short}`).join(' ')} · {fmtDur(r.time)}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="hud-label px-1">Рейтинги сектора · {LB_CATS.find((c) => c.id === lb)?.name}</div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {LB_CATS.map((c) => (
            <button key={c.id} onClick={() => setLb(c.id)} className={`shrink-0 chamfer-xs px-2.5 py-1.5 text-[10px] font-bold border ${lb === c.id ? 'bg-acc text-bg0 border-acc' : 'bg-bg2 text-dim border-line'}`}>{c.name}</button>
          ))}
        </div>
        <div className="panel chamfer divide-y divide-line/60">
          {board.map((r, i) => (
            <div key={r.name} className={`flex items-center gap-2.5 px-3 py-1.5 ${r.self ? 'bg-acc/8' : ''}`}>
              <span className={`w-6 text-center font-mono text-[11px] font-bold ${i === 0 ? 'text-amb' : i < 3 ? 'text-acc' : 'text-faint'}`}>{i + 1}</span>
              {i < 3 && <Icon name="crown" size={13} className={i === 0 ? 'text-amb' : 'text-faint'} />}
              <span className={`text-[12px] flex-1 truncate ${r.self ? 'font-bold text-acc' : ''}`}>{r.name}</span>
              <span className="font-mono text-[11px] font-bold">{fmt(r.v)}</span>
            </div>
          ))}
        </div>

        <div className="hud-label px-1">Достижения · {state.achievements.length}/{ACHIEVEMENTS.length}</div>
        <div className="grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const done = state.achievements.includes(a.id);
            const val = a.metric === 'creditsPeak' ? state.stats.creditsPeak ?? 0 : a.metric === 'contrib' ? state.alliance.contrib : state.stats[a.metric] ?? 0;
            return (
              <div key={a.id} className={`panel-deep chamfer-xs p-2.5 ${done ? 'border-amb/50' : 'opacity-70'}`}>
                <div className="flex items-center gap-2">
                  <Icon name="medal" size={16} className={done ? 'text-amb' : 'text-faint'} />
                  <span className="text-[11px] font-bold leading-tight">{a.name}</span>
                </div>
                <div className="text-[9px] text-dim mt-0.5">{a.desc}</div>
                <Bar value={Math.min(a.target, val)} max={a.target} h={4} color={done ? '#f2a93b' : '#5c7089'} className="mt-1.5" />
                <div className="text-[9px] font-mono text-faint mt-0.5">{fmt(Math.min(a.target, val))}/{fmt(a.target)} · +{a.reward} кр.</div>
              </div>
            );
          })}
        </div>

        <div className="hud-label px-1">Журнал сектора</div>
        <div className="panel chamfer divide-y divide-line/50 max-h-60 overflow-y-auto no-scrollbar">
          {state.log.slice(0, 25).map((l) => (
            <div key={l.id} className="px-3 py-1.5 flex gap-2 items-start">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${l.kind === 'combat' ? 'bg-danger' : l.kind === 'alert' ? 'bg-amb' : l.kind === 'econ' ? 'bg-acc' : 'bg-faint'}`} />
              <span className="text-[11px] text-dim leading-snug flex-1">{l.text}</span>
              <span className="text-[8px] font-mono text-faint shrink-0">{new Date(l.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>

        <div className="hud-label px-1">Настройки</div>
        <div className="panel chamfer divide-y divide-line/60">
          {([
            ['notifProd', 'Производство и стройка'], ['notifCombat', 'Бои и рейды'], ['notifEvents', 'События сектора'], ['notifDaily', 'Ежедневные задания'],
          ] as const).map(([k, label]) => (
            <button key={k} className="w-full flex items-center justify-between px-3 py-2.5" onClick={() => dispatch({ type: 'SET_SETTINGS', patch: { [k]: !state.settings[k] } })}>
              <span className="text-[12px]">{label}</span>
              <span className={`w-10 h-5 chamfer-xs border relative ${state.settings[k] ? 'bg-acc/25 border-acc' : 'bg-bg2 border-line'}`}>
                <span className={`absolute top-0.5 w-4 h-4 transition-all ${state.settings[k] ? 'left-5 bg-acc' : 'left-0.5 bg-faint'}`} />
              </span>
            </button>
          ))}
          <button className="w-full flex items-center justify-between px-3 py-2.5" onClick={() => dispatch({ type: 'SET_SETTINGS', patch: { gps: !state.settings.gps } })}>
            <span className="text-[12px]">Реальный GPS (вместо симуляции)</span>
            <span className={`w-10 h-5 chamfer-xs border relative ${state.settings.gps ? 'bg-acc/25 border-acc' : 'bg-bg2 border-line'}`}>
              <span className={`absolute top-0.5 w-4 h-4 transition-all ${state.settings.gps ? 'left-5 bg-acc' : 'left-0.5 bg-faint'}`} />
            </span>
          </button>
        </div>

        <button className="btn-ghost chamfer-sm w-full py-2.5 text-xs flex items-center justify-center gap-2" onClick={() => setOpenRules(!openRules)}>
          <Icon name="info" size={15} className="text-acc" /> Правила сектора и безопасность
        </button>
        {openRules && (
          <div className="panel-deep chamfer-sm p-3 space-y-2 text-[11px] text-dim leading-snug anim-up">
            <p><b className="text-ink">Безопасность прежде всего.</b> Не играйте за рулём, не пересекайте проезжую часть ради зоны, не заходите на закрытые и частные территории. Зоны у дорог и опасных объектов глушатся автоматически.</p>
            <p><b className="text-ink">Честная война.</b> Ночное перемирие, щиты после рейдов, лимит атак на одну зону (90 с), защита новичков и сезонные сбросы карты не дают сильным безнаказанно давить слабых.</p>
            <p><b className="text-ink">Приватность.</b> Другие видят только ваши зоны, базу и вклад — точная позиция никогда не передаётся. Штаб не обязан быть у дома: переносите его куда угодно.</p>
            <p><b className="text-ink">Без pay-to-win.</b> Боевые модули добываются игрой. Платными будут только облики мехов, эффекты и сезонные украшения.</p>
          </div>
        )}

        <button className="chamfer-sm w-full py-2.5 text-xs text-danger border border-danger/40 bg-danger/8" onClick={() => { if (confirm('Полный сброс сектора? Прогресс будет потерян.')) dispatch({ type: 'RESET' }); }}>
          СБРОСИТЬ ПРОГРЕСС
        </button>
        <p className="text-center text-[9px] font-mono text-faint">ФЕРРОФРОНТ · альфа 0.4.1 · сектор Крайск-7</p>
      </div>
    </div>
  );
}
