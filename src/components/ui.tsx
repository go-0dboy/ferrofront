import React, { useEffect } from 'react';
import type { Build } from '../game/types';
import { useGame, Toast } from '../game/state';

/* ---------- иконки ---------- */
const PATHS: Record<string, React.ReactNode> = {
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>,
  robot: <><rect x="5" y="8" width="14" height="10" rx="2" /><path d="M12 8V5M9 5h6M8 21v-3M16 21v-3" /><circle cx="9.5" cy="13" r="1.2" fill="currentColor" stroke="none" /><circle cx="14.5" cy="13" r="1.2" fill="currentColor" stroke="none" /><path d="M2 12v3M22 12v3" /></>,
  hq: <><path d="M4 21V9l8-5 8 5v12" /><path d="M9 21v-6h6v6M2 21h20" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 15.2c1.9.7 3.1 2.2 3.5 4.8" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  center: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />,
  shield: <path d="M12 2 4.5 5v6c0 5 3.2 8.8 7.5 11 4.3-2.2 7.5-6 7.5-11V5L12 2z" />,
  wrench: <path d="M14.5 6.5a4 4 0 0 0-5.4 5L3 17.6V21h3.4l6.1-6.1a4 4 0 0 0 5-5.4L14 13l-3-3 3.5-3.5z" />,
  radar: <><circle cx="12" cy="12" r="9" /><path d="M12 12 18 6" /><path d="M12 3a9 9 0 0 1 9 9" opacity=".4" /></>,
  flask: <><path d="M10 2v6L4 20a1.5 1.5 0 0 0 1.4 2h13.2A1.5 1.5 0 0 0 20 20L14 8V2" /><path d="M8 2h8M7 15h10" /></>,
  box: <><path d="M3 8l9-5 9 5v8l-9 5-9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  turret: <><path d="M6 21h12M8 21v-4h8v4" /><rect x="9" y="9" width="6" height="8" rx="1.5" /><path d="M12 9V3M9 3h6" /></>,
  factory: <><path d="M3 21V9l6 4V9l6 4V4h6v17H3z" /><path d="M7 17h2M12 17h2M17 17h2" /></>,
  star: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6L12 16.8 6.6 19.7l1.1-6L3.2 9.4l6.1-.8L12 3z" />,
  sword: <><path d="M14 4 20 4v6L9 21l-5-5L14 4z" opacity="0" /><path d="M19 5 8.5 15.5M15 4.5 19.5 9M6 14l4 4M4.5 19.5 8 16M3 21l2.5-2.5" /></>,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></>,
  play: <path d="M7 4.5 19 12 7 19.5v-15z" />,
  chevU: <path d="m5 15 7-7 7 7" />,
  chevD: <path d="m5 9 7 7 7-7" />,
  chevR: <path d="m9 5 7 7-7 7" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  skull: <><path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 5 3.5 6v4h9v-4c2-1 3.5-3 3.5-6a8 8 0 0 0-8-8z" /><circle cx="9" cy="11" r="1.6" fill="currentColor" stroke="none" /><circle cx="15" cy="11" r="1.6" fill="currentColor" stroke="none" /><path d="M10 21v-2M14 21v-2" /></>,
  medal: <><circle cx="12" cy="9" r="5" /><path d="m8.5 13-2 8 5.5-3 5.5 3-2-8" /></>,
  flag: <path d="M5 21V4c4-2 7 2 14 0v10c-7 2-10-2-14 0" />,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" opacity=".5" /></>,
  eye: <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 10.5V17M12 7.2v.3" /></>,
  send: <path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7z" />,
  crown: <path d="m3 8 4.5 4L12 5l4.5 7L21 8l-1.5 11h-15L3 8z" />,
  walk: <><circle cx="13" cy="4.5" r="2" /><path d="M12.5 8.5 10 13l2 3v5M10 13l-3 8M12.5 8.5 15 11l3 1M12 16l3.5 5" /></>,
  cube: <><path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7L12 2.5z" /><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10" /></>,
  cam: <><path d="M4 8h3l2-3h6l2 3h3v12H4V8z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" /><path d="M5 12v9h14v-9M12 8v13M12 8s-4.5.5-5.5-2C5.7 3.9 8 2.5 9.5 3.5 11 4.5 12 8 12 8zm0 0s4.5.5 5.5-2c.8-2.1-1.5-3.5-3-2.5C13 4.5 12 8 12 8z" /></>,
};
export function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {PATHS[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

/* ---------- ресурсный чип ---------- */
export function ResChip({ k, v, small }: { k: string; v: number; small?: boolean }) {
  const meta: Record<string, { short: string; color: string }> = {
    credits: { short: 'КР', color: '#f2d16b' }, metal: { short: 'МТ', color: '#aeb9c6' }, polymer: { short: 'ПЛ', color: '#6fd3a7' },
    electronics: { short: 'ЭЛ', color: '#5fc4e8' }, energy: { short: 'ЭЯ', color: '#e8c95f' }, alloy: { short: 'СП', color: '#c9a0f0' }, core: { short: 'ИЯ', color: '#f08fb8' },
  };
  const m = meta[k] ?? meta.credits;
  return (
    <span className={`inline-flex items-center gap-1.5 ${small ? 'px-1.5 py-0.5' : 'px-2 py-1'} bg-bg2 border border-line chamfer-xs`}>
      <span className="font-mono font-bold" style={{ color: m.color, fontSize: small ? 9 : 10 }}>{m.short}</span>
      <span className={`font-mono font-semibold text-ink ${small ? 'text-[11px]' : 'text-xs'}`}>{Math.floor(v).toLocaleString('ru-RU')}</span>
    </span>
  );
}

/* ---------- прогресс-бар ---------- */
export function Bar({ value, max, color = '#35e0c8', h = 6, className = '' }: { value: number; max: number; color?: string; h?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`w-full bg-bg0 border border-line/60 ${className}`} style={{ height: h }}>
      <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}55` }} />
    </div>
  );
}

/* ---------- статы с дельтой ---------- */
export function StatRow({ label, value, max, delta, unit = '' }: { label: string; value: number; max: number; delta?: number; unit?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="hud-label w-24 shrink-0 !text-[9px]">{label}</span>
      <Bar value={value} max={max} className="flex-1" color={delta !== undefined && delta < 0 ? '#e4574f' : delta !== undefined && delta > 0 ? '#4fd58c' : '#35e0c8'} />
      <span className="font-mono text-[11px] font-semibold w-12 text-right text-ink">
        {Math.round(value)}{unit}
        {delta !== undefined && delta !== 0 && (
          <span className={delta > 0 ? 'text-ok' : 'text-danger'}> {delta > 0 ? '+' : ''}{Math.round(delta)}</span>
        )}
      </span>
    </div>
  );
}

/* ---------- нижняя панель ---------- */
export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; tall?: boolean }) {
  useEffect(() => {
    const h = (e: TouchEvent) => { if (open) e.stopPropagation(); };
    document.addEventListener('touchmove', h, { passive: false });
    return () => document.removeEventListener('touchmove', h);
  }, [open]);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55 anim-fade" />
      <div
        className={`relative panel chamfer scanlines anim-up ${tall ? 'h-[82%]' : 'max-h-[62%]'} w-full overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-acc inline-block" />
            <span className="font-[family-name:var(--font-disp)] text-sm tracking-wide text-ink">{title}</span>
          </div>
          <button onClick={onClose} className="btn-ghost chamfer-xs p-2 text-dim" aria-label="Закрыть"><Icon name="x" size={16} /></button>
        </div>
        <div className="overflow-y-auto no-scrollbar flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------- тосты ---------- */
export function ToastHost() {
  const { toasts, dismissToast } = useGame();
  return (
    <div className="absolute top-2 left-2 right-2 z-[70] flex flex-col gap-2 pointer-events-none safe-top">
      {toasts.map((t: Toast) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`anim-toast pointer-events-auto text-left panel chamfer-sm px-3 py-2.5 flex items-center gap-3 border-l-2 ${
            t.kind === 'ok' ? 'border-l-ok' : t.kind === 'warn' ? 'border-l-amb' : t.kind === 'combat' ? 'border-l-danger' : 'border-l-acc'
          }`}
        >
          <span className={t.kind === 'ok' ? 'text-ok' : t.kind === 'warn' ? 'text-amb' : t.kind === 'combat' ? 'text-danger' : 'text-acc'}>
            <Icon name={t.kind === 'ok' ? 'check' : t.kind === 'warn' ? 'info' : t.kind === 'combat' ? 'sword' : 'info'} size={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-ink leading-tight">{t.title}</span>
            {t.sub && <span className="block text-[11px] text-dim truncate">{t.sub}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------- SVG-рендер меха ---------- */
export function RobotSVG({ build, color, size = 190, animate = true }: { build: Build; color: string; size?: number; animate?: boolean }) {
  const ch = build.slots.chassis;
  const mb = build.slots.mobility;
  const wp = build.slots.weapon;
  const df = build.slots.defense;
  const ut = build.slots.utility;
  const steel = '#2c3a4f', dark = '#1c2635', light = '#44587a';
  const wide = ch === 'ch_bastion' || ch === 'ch_citadel';
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 200 224" className={animate && mb === 'mb_hover' ? 'anim-float' : ''}>
      <ellipse cx="100" cy="208" rx={wide ? 62 : 48} ry="9" fill="#000" opacity=".45" />
      {/* мобильность */}
      {mb === 'mb_wheels' && (
        <g>
          <circle cx="72" cy="176" r="17" fill={dark} stroke={light} strokeWidth="3" />
          <circle cx="128" cy="176" r="17" fill={dark} stroke={light} strokeWidth="3" />
          <circle cx="72" cy="176" r="6" fill={color} /><circle cx="128" cy="176" r="6" fill={color} />
          <rect x="66" y="158" width="68" height="12" rx="4" fill={steel} />
        </g>
      )}
      {mb === 'mb_tracks' && (
        <g>
          <rect x="54" y="162" width="92" height="28" rx="14" fill={dark} stroke={light} strokeWidth="3" />
          <circle cx="74" cy="176" r="7" fill={steel} stroke={light} /><circle cx="100" cy="176" r="7" fill={steel} stroke={light} /><circle cx="126" cy="176" r="7" fill={steel} stroke={light} />
        </g>
      )}
      {mb === 'mb_legs' && (
        <g stroke={light} strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M85 152 70 172 62 196" /><path d="M115 152 130 172 138 196" />
          <path d="M92 152 86 176 82 198" opacity=".7" /><path d="M108 152 114 176 118 198" opacity=".7" />
          <circle cx="70" cy="172" r="4" fill={color} stroke="none" /><circle cx="130" cy="172" r="4" fill={color} stroke="none" />
        </g>
      )}
      {mb === 'mb_hover' && (
        <g>
          <ellipse cx="100" cy="186" rx="46" ry="11" fill={color} opacity=".22" />
          <ellipse cx="100" cy="182" rx="34" ry="7" fill={color} opacity=".4" />
          <path d="M70 168h60l-8 10H78z" fill={steel} stroke={light} />
        </g>
      )}
      {!mb && <rect x="70" y="168" width="60" height="8" fill={dark} opacity=".5" />}
      {/* шасси */}
      {ch === 'ch_scout' && (
        <g>
          <rect x="80" y="94" width="40" height="58" rx="9" fill={steel} stroke={light} strokeWidth="2" />
          <rect x="87" y="72" width="26" height="24" rx="6" fill={dark} stroke={light} strokeWidth="2" />
          <rect x="91" y="79" width="18" height="7" rx="2" fill={color} />
          <rect x="84" y="104" width="32" height="4" fill={color} opacity=".7" />
        </g>
      )}
      {ch === 'ch_vanguard' && (
        <g>
          <rect x="70" y="88" width="60" height="64" rx="10" fill={steel} stroke={light} strokeWidth="2" />
          <rect x="60" y="94" width="12" height="28" rx="4" fill={dark} stroke={light} /><rect x="128" y="94" width="12" height="28" rx="4" fill={dark} stroke={light} />
          <rect x="83" y="66" width="34" height="26" rx="7" fill={dark} stroke={light} strokeWidth="2" />
          <rect x="89" y="74" width="22" height="8" rx="2" fill={color} />
          <rect x="76" y="100" width="48" height="5" fill={color} opacity=".7" />
        </g>
      )}
      {ch === 'ch_bastion' && (
        <g>
          <rect x="62" y="84" width="76" height="70" rx="12" fill={steel} stroke={light} strokeWidth="2.5" />
          <rect x="50" y="90" width="16" height="36" rx="5" fill={dark} stroke={light} /><rect x="134" y="90" width="16" height="36" rx="5" fill={dark} stroke={light} />
          <rect x="84" y="62" width="32" height="26" rx="7" fill={dark} stroke={light} strokeWidth="2" />
          <rect x="90" y="70" width="20" height="8" rx="2" fill={color} />
          <path d="M70 100h60M70 116h60" stroke={color} strokeWidth="3" opacity=".65" />
        </g>
      )}
      {ch === 'ch_phantom' && (
        <g>
          <polygon points="100,86 138,104 130,152 70,152 62,104" fill={steel} stroke={light} strokeWidth="2" />
          <polygon points="90,64 110,64 118,88 82,88" fill={dark} stroke={light} strokeWidth="2" />
          <rect x="90" y="72" width="20" height="6" rx="2" fill={color} />
          <path d="M78 108 122 100M78 122 122 114" stroke={color} strokeWidth="2.5" opacity=".7" />
        </g>
      )}
      {ch === 'ch_citadel' && (
        <g>
          <rect x="56" y="80" width="88" height="76" rx="12" fill={steel} stroke={light} strokeWidth="3" />
          <rect x="44" y="88" width="18" height="44" rx="6" fill={dark} stroke={light} strokeWidth="2" /><rect x="138" y="88" width="18" height="44" rx="6" fill={dark} stroke={light} strokeWidth="2" />
          <rect x="82" y="56" width="36" height="28" rx="7" fill={dark} stroke={light} strokeWidth="2" />
          <rect x="89" y="64" width="22" height="9" rx="2" fill={color} />
          <path d="M64 96h72M64 114h72M64 132h72" stroke={color} strokeWidth="3" opacity=".6" />
        </g>
      )}
      {!ch && (
        <g opacity=".55">
          <rect x="72" y="90" width="56" height="62" rx="10" fill="none" stroke={light} strokeWidth="2" strokeDasharray="6 5" />
          <rect x="86" y="68" width="28" height="24" rx="6" fill="none" stroke={light} strokeWidth="2" strokeDasharray="6 5" />
        </g>
      )}
      {/* оружие */}
      {wp === 'wp_mg' && <g><rect x="128" y="100" width="30" height="4" fill={light} /><rect x="128" y="108" width="30" height="4" fill={light} /><rect x="124" y="96" width="8" height="20" rx="2" fill={dark} stroke={light} /></g>}
      {wp === 'wp_gun' && <g><rect x="126" y="98" width="38" height="9" rx="2" fill={dark} stroke={light} strokeWidth="2" /><rect x="164" y="96" width="7" height="13" fill={color} /></g>}
      {wp === 'wp_plasma' && <g><rect x="126" y="96" width="28" height="13" rx="4" fill={dark} stroke={light} strokeWidth="2" /><circle cx="160" cy="102" r="10" fill={color} opacity=".28" /><circle cx="160" cy="102" r="6" fill={color} /></g>}
      {wp === 'wp_rail' && <g><rect x="122" y="97" width="58" height="5" fill={light} /><rect x="122" y="104" width="58" height="3" fill={light} /><rect x="122" y="92" width="12" height="18" rx="2" fill={dark} stroke={light} /><rect x="178" y="95" width="5" height="9" fill={color} /></g>}
      {wp === 'wp_rocket' && <g><rect x="124" y="86" width="32" height="28" rx="4" fill={dark} stroke={light} strokeWidth="2" /><circle cx="133" cy="94" r="3.4" fill={color} /><circle cx="147" cy="94" r="3.4" fill={color} /><circle cx="133" cy="106" r="3.4" fill={color} /><circle cx="147" cy="106" r="3.4" fill={color} /></g>}
      {wp === 'wp_drone' && <g><rect x="126" y="92" width="22" height="20" rx="4" fill={dark} stroke={light} strokeWidth="2" /><g className={animate ? 'anim-float' : ''}><circle cx="162" cy="84" r="6" fill={steel} stroke={color} /><circle cx="174" cy="104" r="6" fill={steel} stroke={color} /></g></g>}
      {/* защита */}
      {df === 'df_composite' && <path d="M74 96l52 22M74 110l52 22M74 124l52 22" stroke={light} strokeWidth="2.5" opacity=".8" />}
      {df === 'df_reactive' && <g fill={light} opacity=".85"><rect x="72" y="94" width="12" height="8" /><rect x="90" y="94" width="12" height="8" /><rect x="108" y="94" width="12" height="8" /><rect x="72" y="130" width="12" height="8" /><rect x="90" y="130" width="12" height="8" /><rect x="108" y="130" width="12" height="8" /></g>}
      {df === 'df_shield' && (
        <g>
          <ellipse cx="100" cy="118" rx="64" ry="62" fill={color} opacity=".07" />
          <ellipse cx="100" cy="118" rx="64" ry="62" fill="none" stroke={color} strokeWidth="2" strokeDasharray="10 8" opacity=".55" style={animate ? { transformOrigin: '100px 118px', animation: 'spinSlow 9s linear infinite' } : undefined} />
        </g>
      )}
      {df === 'df_nano' && <path d="M100 98l16 9v18l-16 9-16-9v-18z" fill={color} opacity=".22" stroke={color} strokeWidth="1.5" />}
      {/* системы */}
      {ut === 'ut_repair' && <g className={animate ? 'anim-float' : ''}><circle cx="44" cy="92" r="11" fill={dark} stroke={color} strokeWidth="2" /><path d="M44 86v12M38 92h12" stroke={color} strokeWidth="2.5" /><path d="M55 100 78 108" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" /></g>}
      {ut === 'ut_radar' && <g><path d="M100 62V46" stroke={light} strokeWidth="3" /><g style={animate ? { transformOrigin: '100px 44px', animation: 'spinSlow 3s linear infinite' } : undefined}><path d="M86 44a14 14 0 0 1 28 0z" fill={dark} stroke={color} strokeWidth="2" /><circle cx="100" cy="44" r="3" fill={color} /></g></g>}
      {ut === 'ut_target' && <g><circle cx="100" cy="52" r="8" fill="none" stroke={color} strokeWidth="2" /><circle cx="100" cy="52" r="2.5" fill={color} className={animate ? 'blink' : ''} /><path d="M100 60v8" stroke={light} strokeWidth="2.5" /></g>}
      {ut === 'ut_capacitor' && <g><rect x="52" y="98" width="9" height="22" rx="2" fill={dark} stroke={light} /><rect x="54.5" y="102" width="4" height="6" fill={color} /><rect x="54.5" y="111" width="4" height="6" fill={color} /></g>}
    </svg>
  );
}

/* ---------- пустое состояние ---------- */
export function Empty({ text, icon = 'info' }: { text: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-dim">
      <Icon name={icon} size={28} className="opacity-50" />
      <span className="text-xs">{text}</span>
    </div>
  );
}
