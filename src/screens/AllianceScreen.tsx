import { useEffect, useRef, useState } from 'react';
import { useGame, ownedBy } from '../game/state';
import { FACTIONS, ALLIANCE_MEMBERS, fmt, fmtDur, ownerColor } from '../game/data';
import { Icon, Bar } from '../components/ui';

export default function AllianceScreen() {
  const { state, dispatch } = useGame();
  const [msg, setMsg] = useState('');
  const chatEnd = useRef<HTMLDivElement>(null);
  const f = state.profile.faction ? FACTIONS[state.profile.faction] : FACTIONS.helios;
  const mine = ownedBy(state, state.profile.faction);
  const total = mine + 9;
  const supportLeft = state.alliance.lastSupport + 30 * 60000 - Date.now();

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [state.alliance.chat.length]);

  const members = [
    { name: `${state.profile.name} (вы)`, power: 400 + state.profile.level * 120, online: true, contrib: state.alliance.contrib, self: true },
    ...ALLIANCE_MEMBERS.map((m, i) => ({ ...m, contrib: 340 - i * 37 + Math.floor(state.alliance.contrib / 4) })),
  ].sort((a, b) => b.contrib - a.contrib);

  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar grid-bg">
      <div className="p-3 space-y-3 pb-8">
        <div className="panel chamfer scanlines relative p-3" style={{ borderColor: `${f.color}55` }}>
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 chamfer-sm flex items-center justify-center font-[family-name:var(--font-disp)] text-lg" style={{ background: f.soft, border: `1px solid ${f.color}`, color: f.color }}>
              {f.short.slice(0, 2)}
            </span>
            <div className="flex-1">
              <div className="font-[family-name:var(--font-disp)] text-base tracking-wide">{f.name}</div>
              <div className="text-[10px] font-mono text-dim">Батальон связи «{f.short}-2» · 8 бойцов · {mine} зон под контролем</div>
            </div>
          </div>
          <p className="text-[10px] text-dim mt-2 leading-snug">{f.desc} Бонус фракции: <span className="text-acc">{f.bonus}</span>.</p>
        </div>

        <div className="panel chamfer p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="hud-label">Цель недели: 14 зон альянса</span>
            <span className="font-mono text-[11px] font-bold text-amb">{total}/14</span>
          </div>
          <Bar value={total} max={14} h={7} color="#f2a93b" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[9px] font-mono text-amb">Награда: 600 кр. + 20 сплавов</span>
            <button className="btn-warn chamfer-xs px-3 py-2 text-[10px] font-bold" disabled={total < 14 || state.alliance.weeklyClaimed} onClick={() => dispatch({ type: 'CLAIM_WEEKLY' })}>
              {state.alliance.weeklyClaimed ? 'ПОЛУЧЕНО' : total < 14 ? 'ЗАХВАТЫВАЙТЕ ЗОНЫ' : 'ЗАБРАТЬ'}
            </button>
          </div>
        </div>

        <button className="btn-ghost chamfer-sm w-full py-3 text-xs flex items-center justify-center gap-2" disabled={supportLeft > 0} onClick={() => dispatch({ type: 'SUPPORT' })}>
          <Icon name="users" size={16} className="text-acc" />
          {state.buffs.supportUntil > Date.now() ? `ПОДДЕРЖКА АКТИВНА ${fmtDur((state.buffs.supportUntil - Date.now()) / 1000)}` : supportLeft > 0 ? `ПОДДЕРЖКА ЧЕРЕЗ ${fmtDur(supportLeft / 1000)}` : 'ЗАПРОСИТЬ ОГНЕВУЮ ПОДДЕРЖКУ (+10% урон, 5 мин)'}
        </button>

        <div className="hud-label px-1">Состав батальона</div>
        <div className="panel chamfer divide-y divide-line/60">
          {members.map((m) => (
            <div key={m.name} className={`flex items-center gap-2.5 px-3 py-2 ${'self' in m && m.self ? 'bg-acc/5' : ''}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${m.online ? 'bg-ok' : 'bg-faint'}`} />
              <span className="text-[12px] font-bold flex-1 truncate">{m.name}</span>
              <span className="text-[9px] font-mono text-dim">мощь {fmt(m.power)}</span>
              <span className="text-[10px] font-mono font-bold text-amb w-14 text-right">{fmt(m.contrib)} очк.</span>
            </div>
          ))}
        </div>

        <div className="hud-label px-1">Территории батальона</div>
        <div className="flex flex-wrap gap-1.5">
          {state.terrs.filter((t) => t.owner === state.profile.faction).slice(0, 12).map((t) => (
            <span key={t.id} className="chamfer-xs px-2 py-1 text-[10px] font-bold border" style={{ borderColor: `${f.color}55`, color: f.color, background: f.soft }}>{t.name}</span>
          ))}
          {mine === 0 && <span className="text-[11px] text-dim">Пока нет зон — захватите первую на карте.</span>}
        </div>

        <div className="hud-label px-1">Канал связи</div>
        <div className="panel chamfer p-2.5 space-y-2 max-h-72 overflow-y-auto no-scrollbar">
          {state.alliance.chat.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.self ? 'flex-row-reverse' : ''}`}>
              <span className="w-7 h-7 shrink-0 chamfer-xs bg-bg2 border border-line flex items-center justify-center text-[10px] font-bold" style={{ color: m.self ? f.color : '#8fa3bc' }}>
                {m.author.slice(0, 1).toUpperCase()}
              </span>
              <div className={`max-w-[78%] chamfer-xs px-2.5 py-1.5 ${m.self ? 'bg-acc/12 border border-acc/30' : 'bg-bg2 border border-line'}`}>
                <div className="text-[9px] font-mono text-faint">{m.author}</div>
                <div className="text-[12px] leading-snug">{m.text}</div>
              </div>
            </div>
          ))}
          <div ref={chatEnd} />
        </div>
        <div className="flex gap-2 sticky bottom-2">
          <input type="text" value={msg} maxLength={120} placeholder="Сообщение батальону…" className="flex-1 px-3 py-2.5 chamfer-sm text-[13px]"
            onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && msg.trim()) { dispatch({ type: 'CHAT', text: msg.trim() }); setMsg(''); } }} />
          <button className="btn-acc chamfer-sm px-4" disabled={!msg.trim()} onClick={() => { dispatch({ type: 'CHAT', text: msg.trim() }); setMsg(''); }} aria-label="Отправить">
            <Icon name="send" size={17} />
          </button>
        </div>
        <p className="text-[9px] font-mono text-faint text-center">Точные позиции бойцов скрыты: видны только зоны, вклады и активность. Так задумано.</p>
      </div>
    </div>
  );
}
void ownerColor;
