import { useEffect, useRef, useState } from 'react';
import { useGame, ownedBy } from '../game/state';
import { FACTIONS, ALLIANCE_MEMBERS, fmt, fmtDur, ownerColor } from '../game/data';
import { Icon, Bar } from '../components/ui';
import { useNet } from '../net/net';

export default function AllianceScreen() {
  const { state, dispatch } = useGame();
  const net = useNet();
  const [msg, setMsg] = useState('');
  const [stage, setStage] = useState<'idle' | 'host' | 'guest'>('idle');
  const [joinCode, setJoinCode] = useState('');
  const [answerIn, setAnswerIn] = useState('');
  const [myAnswer, setMyAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const chatEnd = useRef<HTMLDivElement>(null);

  const copy = (text: string, tag: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(tag); setTimeout(() => setCopied(''), 1500); }).catch(() => undefined);
  };
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

        {/* P2P-комната */}
        <div className="panel chamfer scanlines relative p-3 border-l-2 border-l-acc">
          <div className="flex items-center justify-between mb-2">
            <span className="hud-label !text-acc flex items-center gap-1.5"><Icon name="radar" size={13} /> P2P-комната · WebRTC</span>
            <span className={`chamfer-xs px-2 py-0.5 text-[9px] font-mono font-bold border ${net.status === 'connected' ? 'text-ok border-ok/50 bg-ok/10' : net.status === 'error' ? 'text-danger border-danger/50' : 'text-dim border-line'}`}>
              {net.status === 'connected' ? `КАНАЛ ЕСТЬ · ${net.peers.length + 1}` : net.status === 'hosting' ? 'ХОСТ' : net.status === 'joining' ? 'ПОДКЛ…' : net.status === 'error' ? 'СБОЙ' : 'ОФЛАЙН-СОЛО'}
            </span>
          </div>
          {net.error && <p className="text-[10px] text-danger mb-2">{net.error}</p>}

          {stage === 'idle' && net.status !== 'connected' && (
            <div className="space-y-2">
              <p className="text-[10px] text-dim leading-snug">Прямое соединение между телефонами без сервера: обменяйтесь кодами через любой мессенджер — и захваты, чат и события синхронизируются в реальном времени.</p>
              <button className="btn-acc chamfer-sm w-full py-3 text-xs" disabled={busy} onClick={async () => { setBusy(true); try { await net.host(); setStage('host'); } finally { setBusy(false); } }}>
                СОЗДАТЬ КОМНАТУ (ХОСТ)
              </button>
              <div className="flex gap-2">
                <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Код приглашения…" className="flex-1 px-2.5 py-2 text-[11px] font-mono chamfer-xs" />
                <button className="btn-ghost chamfer-xs px-3 text-[11px] font-bold" disabled={!joinCode.trim() || busy} onClick={async () => {
                  setBusy(true);
                  try { const ans = await net.join(joinCode); setMyAnswer(ans); setStage('guest'); } catch { /* err shown via net.error */ } finally { setBusy(false); }
                }}>ВОЙТИ</button>
              </div>
            </div>
          )}

          {stage === 'host' && net.status !== 'connected' && (
            <div className="space-y-2">
              <div>
                <div className="hud-label mb-1">1 · Отправьте код-приглашение</div>
                <div className="flex gap-1.5">
                  <code className="flex-1 text-[9px] font-mono text-acc bg-bg0/70 border border-line chamfer-xs px-2 py-2 break-all max-h-14 overflow-y-auto no-scrollbar">{net.invite || 'генерация…'}</code>
                  <button className="btn-ghost chamfer-xs px-2.5 text-[10px] font-bold shrink-0" disabled={!net.invite} onClick={() => copy(net.invite, 'inv')}>{copied === 'inv' ? '✓' : 'КОПИР.'}</button>
                </div>
              </div>
              <div>
                <div className="hud-label mb-1">2 · Вставьте код-ответ игрока</div>
                <div className="flex gap-1.5">
                  <input type="text" value={answerIn} onChange={(e) => setAnswerIn(e.target.value)} placeholder="Код-ответ…" className="flex-1 px-2.5 py-2 text-[10px] font-mono chamfer-xs" />
                  <button className="btn-acc chamfer-xs px-3 text-[10px] font-bold" disabled={!answerIn.trim() || busy} onClick={async () => { setBusy(true); try { await net.accept(answerIn); setAnswerIn(''); } catch { /* shown */ } finally { setBusy(false); } }}>ПРИНЯТЬ</button>
                </div>
              </div>
              <p className="text-[9px] text-faint">Каждому новому игроку — отдельный код-приглашение (кнопка ниже). Соединение идёт напрямую, STUN — публичный.</p>
            </div>
          )}

          {stage === 'guest' && net.status !== 'connected' && myAnswer && (
            <div className="space-y-2">
              <div className="hud-label mb-1">Отправьте код-ответ хосту</div>
              <div className="flex gap-1.5">
                <code className="flex-1 text-[9px] font-mono text-amb bg-bg0/70 border border-line chamfer-xs px-2 py-2 break-all max-h-14 overflow-y-auto no-scrollbar">{myAnswer}</code>
                <button className="btn-ghost chamfer-xs px-2.5 text-[10px] font-bold shrink-0" onClick={() => copy(myAnswer, 'ans')}>{copied === 'ans' ? '✓' : 'КОПИР.'}</button>
              </div>
              <p className="text-[10px] text-dim blink">Ожидание подтверждения хоста…</p>
            </div>
          )}

          {net.status === 'connected' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <span className="chamfer-xs px-2 py-1 text-[10px] font-bold bg-acc/12 border border-acc/40 text-acc">вы · {state.profile.name}</span>
                {net.peers.map((p) => (
                  <span key={p.id} className="chamfer-xs px-2 py-1 text-[10px] font-bold bg-bg2 border border-line2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-ok" /> {p.name} · ур.{p.level}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-dim leading-snug">Канал открыт: захваты зон и сообщения канала связи синхронизируются напрямую. Хост ретранслирует события всем участникам.</p>
              {net.isHost && <button className="btn-ghost chamfer-xs w-full py-2 text-[10px] font-bold" disabled={busy} onClick={async () => { setBusy(true); try { await net.host(); } finally { setBusy(false); } }}>+ КОД ДЛЯ ЕЩЁ ОДНОГО ИГРОКА</button>}
            </div>
          )}

          {stage !== 'idle' && net.status !== 'connected' && (
            <button className="btn-ghost chamfer-xs w-full py-2 text-[10px] text-danger border-danger/40 mt-1" onClick={() => { net.reset(); setStage('idle'); setMyAnswer(''); setAnswerIn(''); }}>РАЗОРВАТЬ КАНАЛ</button>
          )}
        </div>

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
          <input type="text" value={msg} maxLength={120} placeholder={net.status === 'connected' ? 'Сообщение батальону и P2P-каналу…' : 'Сообщение батальону…'} className="flex-1 px-3 py-2.5 chamfer-sm text-[13px]"
            onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && msg.trim()) { dispatch({ type: 'CHAT', text: msg.trim() }); if (net.status === 'connected') net.chat(msg.trim()); setMsg(''); } }} />
          <button className="btn-acc chamfer-sm px-4" disabled={!msg.trim()} onClick={() => { dispatch({ type: 'CHAT', text: msg.trim() }); if (net.status === 'connected') net.chat(msg.trim()); setMsg(''); }} aria-label="Отправить">
            <Icon name="send" size={17} />
          </button>
        </div>
        <p className="text-[9px] font-mono text-faint text-center">Точные позиции бойцов скрыты: видны только зоны, вклады и активность. Так задумано.</p>
      </div>
    </div>
  );
}
void ownerColor;
