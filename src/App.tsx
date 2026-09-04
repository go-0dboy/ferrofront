import { useCallback, useEffect, useRef, useState } from 'react';
import { GameProvider, useGame } from './game/state';
import { SensorsProvider } from './game/sensors';
import { NetProvider, useNet } from './net/net';
import { FACTIONS, fmt, fmtDur, xpForLevel, RES_META, DEPLOY_ENERGY_MAX, WORLD } from './game/data';
import type { FactionId, ResKey } from './game/types';
import { Icon, ResChip, Sheet, Bar } from './components/ui';
import MapScreen from './screens/MapScreen';
import GarageScreen from './screens/GarageScreen';
import BaseScreen from './screens/BaseScreen';
import MissionsScreen from './screens/MissionsScreen';
import AllianceScreen from './screens/AllianceScreen';
import ProfileScreen from './screens/ProfileScreen';
import BattleScreen from './screens/BattleScreen';
import { ToastHost } from './components/ui';

type Tab = 'map' | 'garage' | 'base' | 'missions' | 'alliance' | 'profile';
const TABS: { id: Tab; name: string; icon: string }[] = [
  { id: 'map', name: 'Карта', icon: 'map' },
  { id: 'garage', name: 'Мехи', icon: 'robot' },
  { id: 'base', name: 'База', icon: 'hq' },
  { id: 'missions', name: 'Задания', icon: 'target' },
  { id: 'alliance', name: 'Альянс', icon: 'users' },
  { id: 'profile', name: 'Профиль', icon: 'user' },
];

function CreateScreen() {
  const { dispatch } = useGame();
  const [name, setName] = useState('Командир-7');
  const [fac, setFac] = useState<FactionId>('helios');
  return (
    <div className="absolute inset-0 overflow-y-auto no-scrollbar grid-bg flex flex-col">
      <div className="p-4 pt-8 safe-top">
        <div className="flex items-center gap-3">
          <svg width="52" height="52" viewBox="0 0 48 48">
            <path d="M24 3 42 13.5v21L24 45 6 34.5v-21L24 3z" fill="none" stroke="#35e0c8" strokeWidth="2.5" />
            <path d="M26 12 17 26h6l-2 10 10-15h-6l1-9z" fill="#f2a93b" />
          </svg>
          <div>
            <div className="font-[family-name:var(--font-disp)] text-3xl leading-none tracking-wide">ФЕРРОФРОНТ</div>
            <div className="hud-label mt-1">Сектор Крайск-7 · тактическая сеть</div>
          </div>
        </div>
        <p className="text-[12px] text-dim leading-snug mt-4">
          Город поделён на зоны. Разведывайте районы пешком, захватывайте заводы, собирайте мехов из модулей и держите оборону вместе с альянсом. Ваша улица — теперь линия фронта.
        </p>
        <div className="mt-5 space-y-3">
          <div>
            <div className="hud-label mb-1.5">Позывной</div>
            <input type="text" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-3 text-sm font-bold chamfer-sm" />
          </div>
          <div>
            <div className="hud-label mb-1.5">Фракция</div>
            <div className="space-y-2">
              {(Object.keys(FACTIONS) as FactionId[]).map((id) => {
                const f = FACTIONS[id];
                const on = fac === id;
                return (
                  <button key={id} onClick={() => setFac(id)} className={`w-full text-left chamfer-sm border p-3 transition-all ${on ? 'bg-bg3' : 'bg-bg1 border-line opacity-80'}`} style={on ? { borderColor: f.color, boxShadow: `0 0 22px -6px ${f.color}88` } : undefined}>
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 chamfer-xs flex items-center justify-center font-[family-name:var(--font-disp)]" style={{ background: f.soft, border: `1px solid ${f.color}`, color: f.color }}>{f.short.slice(0, 2)}</span>
                      <div className="flex-1">
                        <div className="text-[13px] font-bold">{f.name}</div>
                        <div className="text-[10px] text-dim leading-snug">{f.desc}</div>
                      </div>
                      {on && <Icon name="check" size={18} className="text-ok shrink-0" />}
                    </div>
                    <div className="text-[10px] font-mono mt-1.5" style={{ color: f.color }}>{f.bonus}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <button className="btn-acc chamfer w-full py-4 text-base tracking-widest" disabled={!name.trim()} onClick={() => dispatch({ type: 'NEW_GAME', name: name.trim(), faction: fac })}>
            ВЫСАДКА В СЕКТОР
          </button>
          <p className="text-[9px] font-mono text-faint text-center leading-relaxed">Играйте осмотрительно: реальные дороги и закрытые территории — не часть игры. Позиция видна только вам.</p>
        </div>
      </div>
    </div>
  );
}

const ONBOARD_STEPS = [
  { text: 'Пройдите 300 м — освойте джойстик и режимы скорости.', check: (s: ReturnType<typeof useGame>['state']) => (s.stats.walkM ?? 0) >= 300, tab: 'map' as Tab, btn: 'К карте' },
  { text: 'Приблизьтесь к тёмным зонам и разведайте 10 территорий.', check: (s: ReturnType<typeof useGame>['state']) => (s.stats.discovered ?? 0) >= 10, tab: 'map' as Tab, btn: 'К карте' },
  { text: 'Соберите первого меха из стартовых модулей в гараже.', check: (s: ReturnType<typeof useGame>['state']) => s.robots.length >= 1, tab: 'garage' as Tab, btn: 'В гараж' },
  { text: 'Выиграйте бой: подойдите к чужой зоне и нажмите «Атаковать».', check: (s: ReturnType<typeof useGame>['state']) => (s.stats.wins ?? 0) >= 1, tab: 'map' as Tab, btn: 'К карте' },
  { text: 'Захватите зону и соберите первый доход (кнопка на карте).', check: (s: ReturnType<typeof useGame>['state']) => (s.stats.captures ?? 0) >= 1 && (s.stats.incomeCollected ?? 0) >= 1, tab: 'map' as Tab, btn: 'К карте' },
  { text: 'Возьмите завод и запустите производство модуля.', check: (s: ReturnType<typeof useGame>['state']) => (s.stats.crafted ?? 0) >= 1 || (s.prod.length ?? 0) >= 1, tab: 'map' as Tab, btn: 'К карте' },
  { text: 'Улучшите любой модуль базы.', check: (s: ReturnType<typeof useGame>['state']) => (s.stats.upgradesDone ?? 0) >= 1, tab: 'base' as Tab, btn: 'На базу' },
];

function OnboardCard({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { state, dispatch } = useGame();
  const [open, setOpen] = useState(true);
  const step = ONBOARD_STEPS.find((s) => !s.check(state));
  const idx = step ? ONBOARD_STEPS.indexOf(step) : ONBOARD_STEPS.length;
  useEffect(() => { if (!step && !state.onboard.done) dispatch({ type: 'FINISH_ONBOARD' }); }, [step, state.onboard.done, dispatch]);
  if (state.onboard.done) return null;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="absolute left-2 top-16 z-30 chamfer-xs bg-amb text-bg0 px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 anim-in">
        <Icon name="flag" size={12} /> ИНСТРУКТАЖ {idx}/7
      </button>
    );
  }
  return (
    <div className="absolute left-2 right-2 top-16 z-30 panel chamfer-sm border-l-2 border-l-amb anim-up">
      <div className="flex items-center gap-2 px-3 pt-2">
        <Icon name="flag" size={14} className="text-amb" />
        <span className="hud-label !text-amb flex-1">Боевой инструктаж · {idx + 1}/7</span>
        <button className="text-[9px] font-mono text-faint underline" onClick={() => dispatch({ type: 'SKIP_ONBOARD' })}>пропустить</button>
        <button onClick={() => setOpen(false)} className="text-faint"><Icon name="x" size={13} /></button>
      </div>
      <div className="px-3 py-2 flex items-center gap-2">
        <p className="text-[11px] text-ink leading-snug flex-1">{step?.text ?? 'Готово!'}</p>
        {step && (
          <button className="btn-warn chamfer-xs px-2.5 py-1.5 text-[10px] font-bold shrink-0" onClick={() => { setTab(step.tab); setOpen(false); }}>{step.btn}</button>
        )}
      </div>
      <div className="px-3 pb-2"><Bar value={idx} max={7} h={4} color="#f2a93b" /></div>
    </div>
  );
}

function Splash({ done }: { done: boolean }) {
  return (
    <div className={`absolute inset-0 z-50 bg-bg0 flex flex-col items-center justify-center transition-opacity duration-500 ${done ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className="grid-bg absolute inset-0 opacity-40" />
      <svg width="84" height="84" viewBox="0 0 48 48" className="anim-float relative">
        <path d="M24 3 42 13.5v21L24 45 6 34.5v-21L24 3z" fill="none" stroke="#35e0c8" strokeWidth="2" strokeDasharray="4 3" style={{ animation: 'dashMove 1.2s linear infinite' }} />
        <path d="M26 12 17 26h6l-2 10 10-15h-6l1-9z" fill="#f2a93b" />
      </svg>
      <div className="font-[family-name:var(--font-disp)] text-2xl tracking-[0.2em] mt-3 relative">ФЕРРОФРОНТ</div>
      <div className="hud-label mt-1 relative">тактическая сеть · сектор Крайск-7</div>
      <div className="w-44 h-1 bg-bg3 mt-5 relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-acc" style={{ animation: 'bootbar 1.3s ease-in-out forwards' }} />
      </div>
      <div className="text-[9px] font-mono text-faint mt-2 relative blink">подключение к командной сети…</div>
      <style>{`@keyframes bootbar { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  );
}

/** провайдеры сессии: датчики + P2P, привязанные к игровому состоянию */
function SessionProviders({ children }: { children: React.ReactNode }) {
  const { state, dispatch } = useGame();
  const stateRef = useRef(state); stateRef.current = state;
  const gpsAnchor = useRef<{ lat: number; lon: number; x: number; y: number; lastLat: number; lastLon: number } | null>(null);

  const onSteps = useCallback((count: number) => dispatch({ type: 'SENSOR_STEPS', count }), [dispatch]);
  const onHeading = useCallback((deg: number) => dispatch({ type: 'SET_HEADING', deg }), [dispatch]);
  const onGpsMove = useCallback((lat: number, lon: number) => {
    const st = stateRef.current;
    if (!gpsAnchor.current) {
      gpsAnchor.current = { lat, lon, x: st.pos.x, y: st.pos.y, lastLat: lat, lastLon: lon };
      return;
    }
    const a = gpsAnchor.current;
    const cosL = Math.cos((lat * Math.PI) / 180);
    const x = Math.max(50, Math.min(WORLD.w - 50, a.x + (lon - a.lon) * 111320 * cosL));
    const y = Math.max(50, Math.min(WORLD.h - 50, a.y - (lat - a.lat) * 110540));
    const dx = (lon - a.lastLon) * 111320 * cosL;
    const dy = (lat - a.lastLat) * 110540;
    const dm = Math.hypot(dx, dy);
    a.lastLat = lat; a.lastLon = lon;
    if (dm > 0.8 && dm < 400) {
      dispatch({ type: 'SYNC_POS', x, y, heading: Math.atan2(-dy, dx), dm });
    }
  }, [dispatch]);
  const onNetChat = useCallback((m: { name?: string; text?: string }) => dispatch({ type: 'NET_CHAT', author: m.name ?? 'Гость', text: m.text ?? '' }), [dispatch]);
  const onNetCapture = useCallback((m: { hexId?: string; name?: string; faction?: string; level?: number }) =>
    dispatch({ type: 'NET_CAPTURE', hexId: m.hexId, name: m.name, faction: m.faction, level: m.level }), [dispatch]);

  return (
    <SensorsProvider cb={{ onSteps, onHeading, onGpsMove }}>
      <NetProvider
        self={{ name: state.profile.name || 'Командир', faction: state.profile.faction ?? 'helios', level: state.profile.level }}
        onChat={onNetChat}
        onCapture={onNetCapture}
      >
        {children}
      </NetProvider>
    </SensorsProvider>
  );
}

function Shell() {
  const { state, dispatch } = useGame();
  const net = useNet();
  const [tab, setTab] = useState<Tab>('map');
  const [battleHex, setBattleHex] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [boot, setBoot] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setBoot(false), 1500);
    return () => clearTimeout(t);
  }, []);

  // трансляция своих захватов в P2P-комнату
  const prevCaptures = useRef(state.stats.captures ?? 0);
  useEffect(() => {
    const cur = state.stats.captures ?? 0;
    if (cur > prevCaptures.current && net.status === 'connected') {
      const t = [...state.terrs].filter((x) => x.capturedAt).sort((a, b) => (b.capturedAt ?? 0) - (a.capturedAt ?? 0))[0];
      if (t) net.capture(t.id, t.name);
    }
    prevCaptures.current = cur;
  }, [state.stats.captures, state.terrs, net]);

  if (!state.profile.faction) {
    return (
      <div className="h-full relative">
        <CreateScreen />
        <ToastHost />
        <Splash done={!boot} />
      </div>
    );
  }

  const f = FACTIONS[state.profile.faction];
  const resKeys: (ResKey | 'credits')[] = ['credits', 'metal', 'polymer', 'electronics', 'energy', 'alloy', 'core'];

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* верхний HUD */}
      <div className="shrink-0 panel-deep border-b border-line px-2 pt-2 pb-1.5 safe-top z-20 relative">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 shrink-0 chamfer-xs flex items-center justify-center font-[family-name:var(--font-disp)] text-[13px]" style={{ background: f.soft, border: `1px solid ${f.color}`, color: f.color }}>
            {f.short.slice(0, 2)}
          </span>
          <div className="w-24 shrink-0 space-y-1">
            <div>
              <div className="flex justify-between text-[9px] font-mono leading-none mb-0.5">
                <span className="text-acc font-bold">УР.{state.profile.level}</span>
                <span className="text-faint">{Math.round((state.profile.xp / xpForLevel(state.profile.level)) * 100)}%</span>
              </div>
              <Bar value={state.profile.xp} max={xpForLevel(state.profile.level)} h={4} color="#35e0c8" />
            </div>
            <div>
              <div className="flex justify-between text-[8px] font-mono leading-none mb-0.5">
                <span className="text-amb font-bold flex items-center gap-0.5"><Icon name="bolt" size={8} />РАЗВЁРТ.</span>
                <span className="text-faint">{Math.round(state.deployEnergy)}</span>
              </div>
              <Bar value={state.deployEnergy} max={DEPLOY_ENERGY_MAX} h={4} color="#f2a93b" />
            </div>
          </div>
          <div className="flex-1 flex gap-1 overflow-x-auto no-scrollbar items-center">
            {resKeys.map((k) => (
              <ResChip key={k} k={k} v={k === 'credits' ? state.credits : state.res[k]} small />
            ))}
          </div>
          <button className="btn-ghost chamfer-xs p-1.5 relative shrink-0" onClick={() => setLogOpen(true)} aria-label="Журнал">
            <Icon name="bell" size={16} className="text-dim" />
            {state.log.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amb rounded-full blink" />}
          </button>
        </div>
      </div>

      {/* экраны */}
      <div className="flex-1 relative">
        <div className="absolute inset-0" style={{ display: tab === 'map' ? 'block' : 'none' }}>
          <MapScreen onAttack={(id) => setBattleHex(id)} />
        </div>
        {tab === 'garage' && <GarageScreen />}
        {tab === 'base' && <BaseScreen />}
        {tab === 'missions' && <MissionsScreen />}
        {tab === 'alliance' && <AllianceScreen />}
        {tab === 'profile' && <ProfileScreen />}
        {tab === 'map' && <OnboardCard tab={tab} setTab={setTab} />}
      </div>

      {/* нижняя навигация */}
      <div className="shrink-0 panel-deep border-t border-line z-20 relative">
        <div className="grid grid-cols-6 safe-bottom">
          {TABS.map((t) => {
            const on = tab === t.id;
            const alert = t.id === 'missions' && !state.onboard.done;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className="relative py-2 flex flex-col items-center gap-0.5 active:scale-95 transition-transform">
                <span className={`relative ${on ? 'text-acc' : 'text-faint'}`}>
                  <Icon name={t.icon} size={21} />
                  {on && <span className="absolute -bottom-1.5 left-1/2 -ml-2 w-4 h-0.5 bg-acc" />}
                  {alert && <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 bg-amb rounded-full blink" />}
                </span>
                <span className={`text-[9px] font-bold ${on ? 'text-acc' : 'text-faint'}`}>{t.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* бой */}
      {battleHex && <BattleScreen key={battleHex} hexId={battleHex} onClose={() => setBattleHex(null)} />}

      {/* журнал */}
      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Журнал сектора" tall>
        <div className="space-y-1">
          {state.log.map((l) => (
            <div key={l.id} className="flex gap-2 items-start py-1 border-b border-line/40">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${l.kind === 'combat' ? 'bg-danger' : l.kind === 'alert' ? 'bg-amb' : l.kind === 'econ' ? 'bg-acc' : 'bg-faint'}`} />
              <span className="text-[12px] text-dim leading-snug flex-1">{l.text}</span>
              <span className="text-[9px] font-mono text-faint shrink-0">{new Date(l.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      </Sheet>
      <ToastHost />
      <Splash done={!boot} />
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <SessionProviders>
        <Shell />
      </SessionProviders>
    </GameProvider>
  );
}
void fmt; void fmtDur; void RES_META;
