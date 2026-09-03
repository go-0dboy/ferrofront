import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../game/state';
import { FACTIONS, lootFor, ownerName, ownerColor, TYPE_LABEL, fmt, RES_META, prodSpeed } from '../game/data';
import type { ResKey, Robot, Territory } from '../game/types';
import { BattleSim, makeDefenderUnits, unitFromBuild, squadPositions, ARENA, CUnit } from '../game/battle';
import { Icon, Bar, RobotSVG } from '../components/ui';

type Phase = 'deploy' | 'fight' | 'result';

export default function BattleScreen({ hexId, onClose }: { hexId: string; onClose: () => void }) {
  const { state, dispatch, toast } = useGame();
  const hex = state.terrs.find((t) => t.id === hexId) as Territory;
  const [phase, setPhase] = useState<Phase>('deploy');
  const [picked, setPicked] = useState<string[]>(() => state.robots.filter((r) => r.condition >= 30).slice(0, 3).map((r) => r.id));
  const [speed, setSpeed] = useState(1);
  const [ar, setAr] = useState(false);
  const [arCalib, setArCalib] = useState(false);
  const [arErr, setArErr] = useState('');
  const simRef = useRef<BattleSim | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speedRef = useRef(1);
  const doneRef = useRef(false);
  const [resultTick, setResultTick] = useState(0);
  const [, setFocusTick] = useState(0);

  speedRef.current = speed;
  const faction = state.profile.faction ? FACTIONS[state.profile.faction] : FACTIONS.helios;
  const squad = useMemo(() => state.robots.filter((r) => picked.includes(r.id)), [state.robots, picked]);
  const loot = useMemo(() => lootFor(hex), [hex]);
  const sim = simRef.current;

  const startAr = async () => {
    if (ar) { setAr(false); streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; return; }
    setArErr(''); setArCalib(true);
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = st;
      if (videoRef.current) { videoRef.current.srcObject = st; await videoRef.current.play().catch(() => undefined); }
      setTimeout(() => { setArCalib(false); setAr(true); }, 1400);
    } catch {
      setArCalib(false);
      setArErr('Камера недоступна — использую тактический режим');
      toast({ title: 'AR недоступен', sub: 'Бой пройдёт в тактическом режиме', kind: 'warn' });
    }
  };
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => {
    if (phase === 'fight' && ar && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => undefined);
    }
  }, [phase, ar]);

  const startFight = () => {
    const pos = squadPositions(squad.length);
    const dmgBonus = (state.buffs.supportUntil > Date.now() ? 1.1 : 1) * (state.profile.faction === 'ferrum' ? 1.08 : 1);
    const units = squad.map((r, i) => unitFromBuild(r.id, r.build.name, r.build, state.researched, state.profile.engLevel, 0, faction.color, '#3d506b', pos[i][0], pos[i][1], Math.max(0.3, r.condition / 100), dmgBonus));
    const foes = makeDefenderUnits(hex, state.researched);
    simRef.current = new BattleSim(units, foes, Math.round(hex.x + hex.y));
    doneRef.current = false;
    setPhase('fight');
  };

  /* бой */
  useEffect(() => {
    if (phase !== 'fight') return;
    let raf = 0; let last = performance.now(); let endT = 0; let lastUi = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const s = simRef.current; const cv = canvasRef.current; const wrap = wrapRef.current;
      if (!s || !cv || !wrap) return;
      s.update(dt * speedRef.current);
      if (now - lastUi > 180) { lastUi = now; setResultTick((x) => x + 1); }
      if (s.over && !endT) endT = now + 1000;
      if (s.over && endT && now > endT && !doneRef.current) { doneRef.current = true; setPhase('result'); }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = wrap.clientWidth, H = wrap.clientHeight;
      if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
      const ctx = cv.getContext('2d'); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const sc = Math.min(W / ARENA.w, H / ARENA.h);
      const ox = (W - ARENA.w * sc) / 2, oy = (H - ARENA.h * sc) / 2;
      ctx.translate(ox + (Math.random() - 0.5) * s.shake * 8, oy + (Math.random() - 0.5) * s.shake * 8);
      ctx.scale(sc, sc);

      if (!arRef.current) {
        ctx.fillStyle = '#0c1220'; ctx.fillRect(-20, -20, ARENA.w + 40, ARENA.h + 40);
        ctx.strokeStyle = 'rgba(53,224,200,0.07)'; ctx.lineWidth = 1;
        for (let x = 0; x <= ARENA.w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA.h); ctx.stroke(); }
        for (let y = 0; y <= ARENA.h; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA.w, y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(242,169,59,0.4)'; ctx.lineWidth = 4; ctx.setLineDash([24, 16]);
        ctx.strokeRect(8, 8, ARENA.w - 16, ARENA.h - 16); ctx.setLineDash([]);
      } else {
        ctx.fillStyle = 'rgba(53,224,200,0.05)';
        ctx.beginPath(); ctx.ellipse(ARENA.w / 2, ARENA.h / 2 + 90, ARENA.w / 2.4, 150, 0, 0, Math.PI * 2); ctx.fill();
      }
      for (const o of s.obstacles) {
        ctx.fillStyle = arRef.current ? 'rgba(20,28,42,0.5)' : '#151f30';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = 'rgba(68,88,122,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h);
      }
      // юниты
      for (const u of s.units) {
        if (u.dead) continue;
        ctx.save(); ctx.translate(u.x, u.y);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.ellipse(0, u.kind === 'turret' ? 16 : 14, u.kind === 'turret' ? 26 : 20, 7, 0, 0, Math.PI * 2); ctx.fill();
        if (u.kind === 'turret') {
          ctx.fillStyle = '#1c2635'; ctx.strokeStyle = u.color; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = u.color; ctx.fillRect(-3, -30, 6, 22);
          ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        } else {
          const wide = u.chassis === 'ch_bastion' || u.chassis === 'ch_citadel';
          const w = wide ? 30 : u.chassis === 'ch_scout' ? 18 : 24;
          const h = wide ? 30 : 24;
          ctx.fillStyle = u.flash > 0 ? '#ffffff' : '#22304a';
          ctx.strokeStyle = u.color; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2 - 6, w, h, 5); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#141d2c';
          ctx.beginPath(); ctx.roundRect(-w / 4, -h / 2 - 14, w / 2, 10, 3); ctx.fill(); ctx.stroke();
          ctx.fillStyle = u.color;
          ctx.fillRect(-w / 4 + 2, -h / 2 - 12, w / 2 - 4, 4);
          // оружие
          ctx.strokeStyle = '#44587a'; ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.moveTo(w / 2 - 2, -4); ctx.lineTo(w / 2 + 12, -6); ctx.stroke();
          if (u.repair > 0) { ctx.strokeStyle = '#4fd58c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -h / 2 - 20, 5, 0, Math.PI * 2); ctx.moveTo(-4, -h / 2 - 20); ctx.lineTo(4, -h / 2 - 20); ctx.stroke(); }
        }
        // фокус
        if (s.focusId === u.id) {
          ctx.strokeStyle = '#f2a93b'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
          ctx.beginPath(); ctx.arc(0, -4, 30, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        // бары
        const bw = u.kind === 'turret' ? 44 : 36;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw / 2, -34, bw, 5);
        ctx.fillStyle = u.side === 0 ? '#4fd58c' : '#e4574f';
        ctx.fillRect(-bw / 2, -34, bw * (u.hp / u.maxHp), 5);
        if (u.maxShield > 0) {
          ctx.fillStyle = '#5fc4e8';
          ctx.fillRect(-bw / 2, -39, bw * (u.shield / u.maxShield), 3);
        }
        ctx.font = '700 10px "JetBrains Mono"'; ctx.textAlign = 'center';
        ctx.fillStyle = u.side === 0 ? '#cfe9dd' : '#f0c9c6';
        ctx.fillText(u.name, 0, u.kind === 'turret' ? 34 : 28);
        ctx.restore();
      }
      // эффекты
      for (const f of s.fx) {
        const p = f.t / f.dur;
        if (f.kind === 'shot' && f.x2 !== undefined && f.y2 !== undefined) {
          ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.globalAlpha = 1 - p;
          ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + (f.x2 - f.x) * Math.min(1, p * 2.4), f.y + (f.y2 - f.y) * Math.min(1, p * 2.4)); ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.kind === 'muzzle') {
          ctx.fillStyle = '#ffd9a0'; ctx.globalAlpha = 1 - p;
          ctx.beginPath(); ctx.arc(f.x, f.y, 6 * (1 - p), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        } else if (f.kind === 'boom') {
          const r = (f.size ?? 30) * (0.4 + p * 0.8);
          ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.globalAlpha = 1 - p;
          ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = f.color; ctx.globalAlpha = (1 - p) * 0.35;
          ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.6, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        } else if (f.kind === 'num' || f.kind === 'heal') {
          ctx.font = `800 ${f.size ?? 13}px "JetBrains Mono"`; ctx.textAlign = 'center';
          ctx.globalAlpha = 1 - p;
          ctx.fillStyle = f.color;
          ctx.fillText(f.text ?? '', f.x, f.y - p * 26);
          ctx.globalAlpha = 1;
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const arRef = useRef(false);
  arRef.current = ar;

  const tapCanvas = (e: React.PointerEvent) => {
    const cv = canvasRef.current; const s = simRef.current;
    if (!cv || !s) return;
    const rect = cv.getBoundingClientRect();
    const sc = Math.min(rect.width / ARENA.w, rect.height / ARENA.h);
    const ox = (rect.width - ARENA.w * sc) / 2, oy = (rect.height - ARENA.h * sc) / 2;
    const wx = (e.clientX - rect.left - ox) / sc, wy = (e.clientY - rect.top - oy) / sc;
    let best: CUnit | null = null; let bd = 60;
    for (const u of s.units) {
      if (u.dead || u.side !== 1) continue;
      const d = Math.hypot(u.x - wx, u.y - wy);
      if (d < bd) { bd = d; best = u; }
    }
    s.setFocus(best ? best.id : null);
    setFocusTick((x) => x + 1);
  };

  const finish = (retreat: boolean) => {
    const s = simRef.current; if (!s || doneRef2.current) return;
    doneRef2.current = true;
    const squadAfter = s.units.filter((u) => u.side === 0).map((u) => ({ id: u.id, condition: Math.max(0, Math.round((u.hp / u.maxHp) * 100 * (retreat ? 0.5 + 0.5 : 1))) }));
    const win = !retreat && s.winner === 0;
    dispatch({ type: 'CAPTURE_RESULT', hexId, win, squad: squadAfter, kills: s.units.filter((u) => u.side === 0).reduce((a, u) => a + u.kills, 0) });
    onClose();
  };
  const doneRef2 = useRef(false);

  const power = squad.reduce((a, r) => { const st = unitPower(r); return a + st; }, 0);
  const enemyPower = hex.garrison.power * (hex.eventId ? 1.35 : 1);

  if (!hex) return null;

  return (
    <div className="absolute inset-0 z-50 bg-bg0 flex flex-col anim-fade">
      {/* заголовок */}
      <div className="shrink-0 panel-deep border-b border-line px-3 pt-3 pb-2 safe-top flex items-center gap-2">
        <button onClick={() => (phase === 'fight' ? finish(true) : onClose())} className="btn-ghost chamfer-xs p-2 text-dim"><Icon name="x" size={16} /></button>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-[family-name:var(--font-disp)] tracking-wide truncate">{hex.name}</div>
          <div className="text-[9px] font-mono text-dim">{TYPE_LABEL[hex.type]} · {ownerName(hex.owner)} · УР.{hex.tier}</div>
        </div>
        {phase === 'fight' && (
          <div className="flex gap-1">
            {[1, 2, 4].map((sp) => (
              <button key={sp} onClick={() => setSpeed(sp)} className={`chamfer-xs px-2 py-1 text-[10px] font-mono font-bold border ${speed === sp ? 'bg-acc text-bg0 border-acc' : 'bg-bg2 text-dim border-line'}`}>×{sp}</button>
            ))}
          </div>
        )}
      </div>

      {phase === 'deploy' && (
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3">
          <div className="panel chamfer scanlines relative p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="hud-label mb-1">Цель: гарнизон {hex.garrison.size} юн. · мощь {Math.round(enemyPower)}</div>
                <div className="flex gap-1.5 items-center">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: ownerColor(hex.owner) }} />
                  <span className="text-[12px] font-bold">{ownerName(hex.owner)}</span>
                  {hex.eventId && <span className="text-[10px] font-mono text-danger blink">УСИЛЕН СОБЫТИЕМ</span>}
                </div>
              </div>
              <button className={`chamfer-sm px-3 py-2.5 text-[11px] font-bold border flex items-center gap-1.5 ${ar ? 'bg-acc text-bg0 border-acc' : 'btn-ghost'}`} onClick={startAr}>
                <Icon name="cam" size={15} /> AR
              </button>
            </div>
            {arCalib && <div className="mt-2 text-[10px] font-mono text-acc blink">Калибровка поверхности…</div>}
            {arErr && <div className="mt-2 text-[10px] font-mono text-amb">{arErr}</div>}
            {ar && <div className="mt-2 text-[10px] font-mono text-ok">AR-режим активен: наведите камеру на ровную поверхность</div>}
            <div className="mt-2 flex items-center gap-2">
              <span className="hud-label">Баланс сил</span>
              <div className="flex-1 h-2 bg-bg0 border border-line flex">
                <div className="h-full" style={{ width: `${(power / Math.max(1, power + enemyPower)) * 100}%`, background: faction.color }} />
                <div className="h-full flex-1" style={{ background: ownerColor(hex.owner) }} />
              </div>
            </div>
          </div>
          <div className="hud-label">Отряд (до 3 машин, состояние ≥30%)</div>
          {state.robots.length === 0 && <div className="panel-deep chamfer-sm p-4 text-center text-[12px] text-dim">Нет боеспособных мехов — соберите их в гараже.</div>}
          {state.robots.map((r) => {
            const on = picked.includes(r.id);
            const weak = r.condition < 30;
            return (
              <button key={r.id} disabled={weak || (!on && picked.length >= 3)} onClick={() => setPicked(on ? picked.filter((x) => x !== r.id) : [...picked, r.id])}
                className={`w-full panel chamfer-sm p-2.5 flex items-center gap-3 text-left border ${on ? 'border-acc' : ''} ${weak ? 'opacity-45' : ''}`}>
                <span className={`w-5 h-5 shrink-0 chamfer-xs border flex items-center justify-center ${on ? 'bg-acc border-acc text-bg0' : 'border-line2'}`}>{on && <Icon name="check" size={13} />}</span>
                <RobotSVG build={r.build} color={faction.color} size={52} animate={false} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-bold truncate">{r.build.name}</span>
                  <span className="block text-[9px] font-mono text-dim">{r.build.behavior === 'aggressive' ? 'Агрессивный' : r.build.behavior === 'defensive' ? 'Оборона' : r.build.behavior === 'support' ? 'Поддержка' : r.build.behavior === 'structures' ? 'По структурам' : 'Дальний бой'}</span>
                  <Bar value={r.condition} max={100} h={4} color={r.condition > 60 ? '#4fd58c' : r.condition > 30 ? '#f2a93b' : '#e4574f'} className="mt-1" />
                </span>
                <span className="font-mono text-[11px] font-bold text-dim">{r.condition}%</span>
              </button>
            );
          })}
          <button className="btn-warn chamfer w-full py-4 text-base tracking-widest" disabled={picked.length === 0} onClick={startFight}>
            В БОЙ
          </button>
          <p className="text-[10px] text-faint text-center">Поражённые машины потребуют ремонта в базе. Победа передаёт зону вашему альянсу.</p>
        </div>
      )}

      {phase !== 'deploy' && (
        <div ref={wrapRef} className="flex-1 relative overflow-hidden" style={{ touchAction: 'none' }}>
          {ar && <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />}
          {ar && <div className="absolute inset-0 bg-black/20" />}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" onPointerUp={tapCanvas} />
          {phase === 'fight' && sim && (
            <>
              <div className="absolute top-2 left-2 right-2 flex items-center gap-2">
                <div className="flex-1">
                  <div className="hud-label mb-0.5">Энергия отряда</div>
                  <Bar value={sim.energy} max={100} h={7} color="#f2d16b" />
                </div>
                <button className="btn-ghost chamfer-sm px-3 py-2 text-[11px] text-danger border-danger/40" onClick={() => finish(true)}>ОТХОД</button>
              </div>
              <div className="absolute bottom-2 left-2 right-2 flex gap-1.5">
                <button className="flex-1 chamfer-sm py-2.5 text-[11px] font-bold bg-bg1/85 border border-amb/50 text-amb disabled:opacity-40" disabled={sim.energy < 42 || sim.over} onClick={() => sim.tryAbility('barrage')}>ЗАЛП · 42</button>
                <button className="flex-1 chamfer-sm py-2.5 text-[11px] font-bold bg-bg1/85 border border-ok/50 text-ok disabled:opacity-40" disabled={sim.energy < 36 || sim.over} onClick={() => sim.tryAbility('repair')}>РЕМОНТ · 36</button>
                <button className="flex-1 chamfer-sm py-2.5 text-[11px] font-bold bg-bg1/85 border border-acc/50 text-acc disabled:opacity-40" disabled={sim.energy < 30 || sim.over} onClick={() => sim.tryAbility('overdrive')}>ФОРСАЖ · 30</button>
              </div>
              <div className="absolute top-12 left-2 text-[9px] font-mono text-faint">{sim.focusId ? 'ЦЕЛЬ ЗАХВАЧЕНА' : 'Тап по врагу — фокус огня'}</div>
            </>
          )}
          {phase === 'result' && sim && (
            <div className="absolute inset-0 bg-black/70 anim-fade flex flex-col items-center justify-center p-6">
              <div className={`font-[family-name:var(--font-disp)] text-4xl tracking-widest ${sim.winner === 0 ? 'text-ok' : 'text-danger'}`} style={{ textShadow: '0 0 30px currentColor' }}>
                {sim.winner === 0 ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ'}
              </div>
              <div className="text-[11px] font-mono text-dim mt-1">
                Уничтожено: {sim.units.filter((u) => u.side === 0).reduce((a, u) => a + u.kills, 0)} · Потери отряда: {sim.units.filter((u) => u.side === 0 && u.dead).length}/{sim.units.filter((u) => u.side === 0).length}
              </div>
              {sim.winner === 0 && (
                <div className="panel chamfer p-3 mt-4 w-full max-w-xs">
                  <div className="hud-label mb-2">Добыча</div>
                  <div className="text-[13px] font-mono font-bold text-amb">+{fmt(loot.credits)} кредитов</div>
                  {Object.entries(loot.res).map(([k, v]) => (
                    <div key={k} className="text-[12px] font-mono" style={{ color: RES_META[k as ResKey].color }}>+{v} {RES_META[k as ResKey].name}</div>
                  ))}
                  <div className="text-[12px] font-mono text-acc">+{loot.xp} XP</div>
                </div>
              )}
              <button className="btn-acc chamfer px-8 py-3.5 mt-5 text-sm tracking-wider" onClick={() => finish(false)}>
                {sim.winner === 0 ? 'ЗАБРАТЬ И ЗАХВАТИТЬ' : 'ВЕРНУТЬСЯ'}
              </button>
            </div>
          )}
        </div>
      )}
      {arCalib && (
        <div className="absolute inset-0 z-10 bg-bg0/80 flex flex-col items-center justify-center gap-3">
          <div className="w-24 h-24 border-2 border-acc relative anim-float">
            <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-amb" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-amb" />
          </div>
          <div className="text-[12px] font-mono text-acc blink">ПОИСК ПОВЕРХНОСТИ…</div>
        </div>
      )}
    </div>
  );
}

function unitPower(r: Robot): number {
  const b = r.build;
  const w = (id: string | null, base: number) => (id ? base : 0);
  return Math.round((w(b.slots.weapon, 40) + w(b.slots.chassis, 30) + w(b.slots.defense, 15) + w(b.slots.utility, 10)) * (r.condition / 100));
}
void prodSpeed;
