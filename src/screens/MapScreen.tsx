import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, nearHex, canAttackNow } from '../game/state';
import { useSensors } from '../game/sensors';
import {
  generateWorld, WORLD, hexPath, terrAt, ownerColor, ownerName, rateFor, TYPE_LABEL, FACTIONS, RES_META,
  revealRadius, fmt, fmtDur, RECIPES, FACTORIES, PART_MAP, prodSlots, hexRing, ATTACK_ENERGY_COST,
} from '../game/data';
import type { Territory, ResKey } from '../game/types';
import { Icon, Sheet, Bar } from '../components/ui';

const geo = generateWorld(7).geo;

function drawGlyph(ctx: CanvasRenderingContext2D, t: Territory, time: number) {
  const c = ownerColor(t.owner);
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.fillStyle = 'rgba(10,15,22,0.72)';
  ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = c; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#e8f0f7'; ctx.strokeStyle = '#e8f0f7'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  const ty = t.type;
  if (ty === 'factory') {
    ctx.beginPath(); ctx.moveTo(-13, 12); ctx.lineTo(-13, -6); ctx.lineTo(-4, 0); ctx.lineTo(-4, -6); ctx.lineTo(5, 0); ctx.lineTo(5, -12); ctx.lineTo(13, -12); ctx.lineTo(13, 12); ctx.closePath(); ctx.stroke();
  } else if (ty === 'metal' || ty === 'polymer' || ty === 'electronics' || ty === 'energy') {
    ctx.strokeRect(-11, -9, 22, 18);
    ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(11, -2); ctx.stroke();
    ctx.font = '700 11px "JetBrains Mono"'; ctx.textAlign = 'center';
    ctx.fillStyle = RES_META[ty as ResKey]?.color ?? '#fff';
    ctx.fillText(RES_META[ty as ResKey]?.short ?? '?', 0, 4.5);
  } else if (ty === 'strategic') {
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -6); ctx.moveTo(-8, 12); ctx.lineTo(0, -6); ctx.lineTo(8, 12); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -10, 4, Math.PI, 0); ctx.stroke();
  } else if (ty === 'landmark') {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5, a2 = a + Math.PI / 5;
      ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); ctx.lineTo(Math.cos(a2) * 5.5, Math.sin(a2) * 5.5);
    }
    ctx.closePath(); ctx.stroke();
  } else if (ty === 'outpost') {
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(11, -8); ctx.lineTo(11, 4); ctx.quadraticCurveTo(11, 11, 0, 14); ctx.quadraticCurveTo(-11, 11, -11, 4); ctx.lineTo(-11, -8); ctx.closePath(); ctx.stroke();
  } else if (ty === 'park') {
    ctx.beginPath(); ctx.arc(-4, -4, 7, 0, Math.PI * 2); ctx.arc(6, -2, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 13); ctx.stroke();
  } else {
    ctx.strokeRect(-10, -6, 9, 14); ctx.strokeRect(1, -11, 10, 19);
  }
  // гарнизон
  if (t.type !== 'water') {
    const p = Math.min(1, t.garrison.power / 220);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-16, 36, 32, 5);
    ctx.fillStyle = t.owner === null || t.owner === 'raiders' ? '#e4574f' : c;
    ctx.fillRect(-16, 36, 32 * p, 5);
  }
  // непрособрано
  if (t.unclaimed > 5) {
    const blink = 0.55 + 0.45 * Math.sin(time * 5);
    ctx.fillStyle = `rgba(242,169,59,${blink})`;
    ctx.beginPath(); ctx.arc(24, -24, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b1a02'; ctx.font = '800 9px "JetBrains Mono"'; ctx.textAlign = 'center';
    ctx.fillText('КР', 24, -20.5);
  }
  ctx.restore();
}

function drawEvent(ctx: CanvasRenderingContext2D, t: Territory, kind: string, time: number) {
  ctx.save();
  ctx.translate(t.x, t.y - 62);
  const pulse = 1 + 0.12 * Math.sin(time * 6);
  ctx.scale(pulse, pulse);
  const col = kind === 'invasion' || kind === 'convoy' ? '#e4574f' : '#f2a93b';
  ctx.fillStyle = 'rgba(10,15,22,0.85)';
  ctx.strokeStyle = col; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(16, 0); ctx.lineTo(0, 16); ctx.lineTo(-16, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col; ctx.font = '800 13px "JetBrains Mono"'; ctx.textAlign = 'center';
  ctx.fillText(kind === 'anomaly' ? '⌁' : kind === 'wreck' ? '▣' : kind === 'convoy' ? '≫' : '!', 0, 4.5);
  ctx.restore();
}

export default function MapScreen({ onAttack }: { onAttack: (hexId: string) => void }) {
  const { state, dispatch } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stRef = useRef(state);
  stRef.current = state;
  const cam = useRef({ x: state.pos.x, y: state.pos.y, z: 1, tz: 1, follow: true });
  const posRef = useRef({ x: state.pos.x, y: state.pos.y });
  const joy = useRef({ active: false, dx: 0, dy: 0 });
  const dmAcc = useRef(0);
  const lastSync = useRef(0);
  const [sel, setSel] = useState<string | null>(null);
  const [dashCd, setDashCd] = useState(0);
  const [sensorPanel, setSensorPanel] = useState(false);
  const sensors = useSensors();
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const drag = useRef({ sx: 0, sy: 0, cx: 0, cy: 0, moved: false, t: 0 });

  useEffect(() => { posRef.current = { ...state.pos }; }, [state.pos.x, state.pos.y]);

  /* основной цикл отрисовки */
  useEffect(() => {
    let raf = 0; let last = performance.now(); let time = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
      const cv = canvasRef.current, wrap = wrapRef.current;
      const s = stRef.current;
      if (!cv || !wrap) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = wrap.clientWidth, H = wrap.clientHeight;
      if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; cv.style.width = `${W}px`; cv.style.height = `${H}px`; }
      const ctx = cv.getContext('2d'); if (!ctx) return;

      // движение
      if (joy.current.active) {
        const sp = 62 * s.settings.speed;
        const nx = Math.max(60, Math.min(WORLD.w - 60, posRef.current.x + joy.current.dx * sp * dt));
        const ny = Math.max(60, Math.min(WORLD.h - 60, posRef.current.y + joy.current.dy * sp * dt));
        const t0 = terrAt(nx, ny, s.terrs);
        if (!(t0 && t0.type === 'water')) {
          dmAcc.current += Math.hypot(nx - posRef.current.x, ny - posRef.current.y);
          posRef.current = { x: nx, y: ny };
        }
      }
      if (performance.now() - lastSync.current > 350 && (dmAcc.current > 0.5 || joy.current.active)) {
        lastSync.current = performance.now();
        const heading = joy.current.active ? Math.atan2(joy.current.dy, joy.current.dx) : s.heading;
        dispatch({ type: 'SYNC_POS', x: posRef.current.x, y: posRef.current.y, heading, dm: dmAcc.current });
        dmAcc.current = 0;
      }

      // камера
      if (cam.current.follow) { cam.current.x += (posRef.current.x - cam.current.x) * Math.min(1, dt * 5); cam.current.y += (posRef.current.y - cam.current.y) * Math.min(1, dt * 5); }
      cam.current.z += (cam.current.tz - cam.current.z) * Math.min(1, dt * 8);
      const z = cam.current.z;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0a0f16'; ctx.fillRect(0, 0, W, H);
      const ox = W / 2 - cam.current.x * z, oy = H / 2 - cam.current.y * z;
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);

      // город
      ctx.fillStyle = '#121a28';
      for (const b of geo.blocks) { ctx.globalAlpha = 0.35 + b.s * 0.4; ctx.fillRect(b.x, b.y, b.w, b.h); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#182233'; ctx.lineWidth = 17;
      for (const r of geo.roads) { ctx.beginPath(); ctx.moveTo(r.x1, r.y1); ctx.lineTo(r.x2, r.y2); ctx.stroke(); }
      ctx.strokeStyle = '#1e2c42'; ctx.lineWidth = 1.5;
      for (const r of geo.roads) { ctx.beginPath(); ctx.moveTo(r.x1, r.y1); ctx.lineTo(r.x2, r.y2); ctx.stroke(); }
      ctx.fillStyle = '#0d2030';
      ctx.beginPath();
      geo.water.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#16344c'; ctx.lineWidth = 3; ctx.stroke();
      for (const p of geo.parks) {
        ctx.fillStyle = '#0f2419';
        ctx.beginPath(); p.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y))); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#1c4530'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#173a27';
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(p.x + Math.cos(i * 2.3) * 70, p.y + Math.sin(i * 1.9) * 55, 14, 0, Math.PI * 2); ctx.fill(); }
      }

      const rr = revealRadius(s);
      const px = posRef.current.x, py = posRef.current.y;
      const eventHexes = new Map(s.events.map((e) => [e.hexId, e.kind]));
      let targetHex: Territory | null = null;
      const ev = s.events[0];
      if (ev) targetHex = s.terrs.find((t) => t.id === ev.hexId) ?? null;
      else {
        let bd = 1e9;
        for (const t of s.terrs) if (t.discovered && t.type === 'factory' && t.owner !== s.profile.faction) {
          const d = Math.hypot(t.x - px, t.y - py); if (d < bd) { bd = d; targetHex = t; }
        }
      }

      // гексы
      for (const t of s.terrs) {
        hexPath(ctx, t.x, t.y, WORLD.hexR - 5);
        if (!t.discovered) {
          ctx.fillStyle = 'rgba(7,10,16,0.82)'; ctx.fill();
          const d = Math.hypot(t.x - px, t.y - py);
          if (d < rr * 1.55) {
            ctx.strokeStyle = `rgba(53,224,200,${0.1 + 0.1 * Math.sin(time * 3 + t.x)})`; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = 'rgba(53,224,200,0.5)'; ctx.font = '700 26px "JetBrains Mono"'; ctx.textAlign = 'center';
            ctx.fillText('?', t.x, t.y + 9);
          } else {
            ctx.strokeStyle = 'rgba(70,90,120,0.14)'; ctx.lineWidth = 1; ctx.stroke();
          }
          continue;
        }
        const oc = ownerColor(t.owner);
        const isOwn = t.owner === s.profile.faction;
        ctx.fillStyle = t.type === 'water' ? 'rgba(13,32,48,0.5)' : isOwn ? `${oc}2e` : t.owner ? `${oc}1c` : 'rgba(92,107,132,0.13)';
        ctx.fill();
        ctx.strokeStyle = t.type === 'water' ? '#16344c' : `${oc}${isOwn ? 'cc' : '88'}`;
        ctx.lineWidth = isOwn ? 3.5 : 2;
        ctx.stroke();
        if (sel === t.id) {
          hexPath(ctx, t.x, t.y, WORLD.hexR - 12);
          ctx.strokeStyle = 'rgba(232,240,247,0.9)'; ctx.lineWidth = 2;
          ctx.setLineDash([10, 8]); ctx.lineDashOffset = -time * 30; ctx.stroke(); ctx.setLineDash([]);
        }
        if (t.type !== 'water') drawGlyph(ctx, t, time);
        const ek = eventHexes.get(t.id);
        if (ek) drawEvent(ctx, t, ek, time);
        if (targetHex?.id === t.id) {
          const by = t.y - 96 + Math.sin(time * 4) * 7;
          ctx.save(); ctx.translate(t.x, by); ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#f2a93b'; ctx.strokeStyle = '#2b1a02'; ctx.lineWidth = 2;
          ctx.fillRect(-7, -7, 14, 14); ctx.strokeRect(-7, -7, 14, 14); ctx.restore();
        }
        if (s.base.hexId === t.id) {
          ctx.fillStyle = '#f2d16b'; ctx.font = '800 20px "JetBrains Mono"'; ctx.textAlign = 'center';
          ctx.fillText('★', t.x, t.y - 44);
        }
      }

      // зона обзора
      ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(53,224,200,0.025)'; ctx.fill();
      ctx.strokeStyle = 'rgba(53,224,200,0.3)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([14, 10]); ctx.lineDashOffset = -time * 20; ctx.stroke(); ctx.setLineDash([]);
      // радар-кольцо
      const rp = (time % 2.4) / 2.4;
      ctx.beginPath(); ctx.arc(px, py, 40 + rp * 130, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(53,224,200,${0.5 * (1 - rp)})`; ctx.lineWidth = 2; ctx.stroke();
      // игрок
      ctx.save(); ctx.translate(px, py); ctx.rotate(s.heading + Math.PI / 2);
      ctx.fillStyle = s.profile.faction ? FACTIONS[s.profile.faction].color : '#35e0c8';
      ctx.strokeStyle = '#0a0f16'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(12, 13); ctx.lineTo(0, 6); ctx.lineTo(-12, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [dispatch, sel]);

  /* указатели: пан, тап, пинч */
  const toWorld = (cx: number, cy: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const z = cam.current.z;
    return {
      x: cam.current.x + (cx - rect.left - rect.width / 2) / z,
      y: cam.current.y + (cy - rect.top - rect.height / 2) / z,
    };
  };
  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
    drag.current = { sx: e.clientX, sy: e.clientY, cx: cam.current.x, cy: cam.current.y, moved: false, t: performance.now() };
    cam.current.follow = false;
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current > 0) cam.current.tz = Math.max(0.55, Math.min(1.9, cam.current.tz * (d / pinch.current)));
      pinch.current = d; drag.current.moved = true;
      return;
    }
    const dx = e.clientX - drag.current.sx, dy = e.clientY - drag.current.sy;
    if (Math.abs(dx) + Math.abs(dy) > 7) drag.current.moved = true;
    if (drag.current.moved) {
      cam.current.x = drag.current.cx - dx / cam.current.z;
      cam.current.y = drag.current.cy - dy / cam.current.z;
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId); pinch.current = 0;
    if (!drag.current.moved && performance.now() - drag.current.t < 450) {
      const w = toWorld(e.clientX, e.clientY);
      const t = terrAt(w.x, w.y, stRef.current.terrs);
      setSel(t && t.type !== 'water' ? t.id : null);
    }
  };

  /* джойстик */
  const padRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false });
  const joyDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    joyMove(e); joy.current.active = true; setKnob((k) => ({ ...k, on: true }));
  };
  const joyMove = (e: React.PointerEvent) => {
    if (!padRef.current) return;
    const r = padRef.current.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy), max = r.width / 2 - 16;
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    joy.current.dx = dx / max; joy.current.dy = dy / max;
    setKnob({ x: dx, y: dy, on: true });
  };
  const joyUp = () => {
    joy.current = { active: false, dx: 0, dy: 0 };
    setKnob({ x: 0, y: 0, on: false });
    if (dmAcc.current > 0.5) {
      dispatch({ type: 'SYNC_POS', x: posRef.current.x, y: posRef.current.y, heading: stRef.current.heading, dm: dmAcc.current });
      dmAcc.current = 0;
    }
  };

  const dash = () => {
    const now = Date.now();
    if (now < dashCd) return;
    setDashCd(now + 90000);
    const h = stRef.current.heading;
    const nx = Math.max(60, Math.min(WORLD.w - 60, posRef.current.x + Math.cos(h) * 140));
    const ny = Math.max(60, Math.min(WORLD.h - 60, posRef.current.y + Math.sin(h) * 140));
    posRef.current = { x: nx, y: ny };
    dispatch({ type: 'SYNC_POS', x: nx, y: ny, heading: h, dm: 140 });
  };

  const selTerr = useMemo(() => (sel ? state.terrs.find((t) => t.id === sel) ?? null : null), [sel, state.terrs]);
  const bearing = useMemo(() => {
    if (!selTerr) return null;
    const dx = selTerr.x - state.pos.x, dy = selTerr.y - state.pos.y;
    const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const rel = sensors.headingDeg != null ? (deg - sensors.headingDeg + 360) % 360 : deg;
    return { deg: Math.round(deg), rel, dist: Math.round(Math.hypot(dx, dy)) };
  }, [selTerr, state.pos.x, state.pos.y, sensors.headingDeg]);
  const here = terrAt(state.pos.x, state.pos.y, state.terrs);
  const night = (() => { const h = new Date().getHours(); return h >= 23 || h < 7; })();
  const shieldOn = state.base.shieldUntil > Date.now() || night;

  const action = useMemo(() => {
    let best: Territory | null = null;
    for (const t of state.terrs) {
      if (t.type === 'water' || !nearHex(state, t)) continue;
      if (!best || t.unclaimed > best.unclaimed) best = t;
    }
    if (!best) return null;
    if (best.owner === state.profile.faction) {
      if (best.unclaimed >= 1) return { hex: best, kind: 'collect' as const, label: `Собрать ${Math.floor(best.unclaimed)} кр.` };
      if (best.type === 'factory') return { hex: best, kind: 'factory' as const, label: 'Открыть завод' };
      return { hex: best, kind: 'info' as const, label: 'Инфо' };
    }
    if (best.eventId === 'anomaly' || best.eventId === 'wreck') return { hex: best, kind: 'scan' as const, label: best.eventId === 'anomaly' ? 'Сканировать аномалию' : 'Собрать обломки' };
    if (best.type === 'landmark') return { hex: best, kind: 'landmark' as const, label: 'Исследовать' };
    if (canAttackNow(best) && state.robots.some((r) => r.condition >= 30) && state.deployEnergy >= ATTACK_ENERGY_COST)
      return { hex: best, kind: 'attack' as const, label: `Атаковать · ${ATTACK_ENERGY_COST}⚡` };
    return {
      hex: best, kind: 'info' as const,
      label: !canAttackNow(best) ? `Перезарядка ${fmtDur(((best.attackReadyAt ?? 0) - Date.now()) / 1000)}`
        : state.deployEnergy < ATTACK_ENERGY_COST ? `Нужно ${ATTACK_ENERGY_COST}⚡ энергии`
        : 'Нужен мех (≥30%)',
    };
  }, [state]);

  const doAction = () => {
    if (!action) return;
    const { hex, kind } = action;
    setSel(hex.id);
    if (kind === 'collect') dispatch({ type: 'COLLECT', hexId: hex.id });
    else if (kind === 'scan') dispatch({ type: 'SCAN_EVENT', eventId: state.events.find((e) => e.hexId === hex.id)?.id });
    else if (kind === 'landmark') dispatch({ type: 'SCAN_LANDMARK', hexId: hex.id });
    else if (kind === 'attack') onAttack(hex.id);
  };

  const speedLabels: Record<number, string> = { 1: '×1', 4: '×4', 12: '×12' };

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden select-none" style={{ touchAction: 'none' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onWheel={(e) => { cam.current.tz = Math.max(0.55, Math.min(1.9, cam.current.tz * (e.deltaY > 0 ? 0.88 : 1.14))); }}
      />
      {/* верхние чипы */}
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2 pointer-events-none">
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="panel chamfer-sm px-2.5 py-1.5 flex items-center gap-2 w-fit max-w-[62vw]">
            <Icon name="map" size={14} className="text-acc shrink-0" />
            <span className="text-[12px] font-bold truncate">{here?.type === 'water' ? 'Акватория' : here ? here.name : 'Вне зон'}</span>
            {here && here.owner && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ownerColor(here.owner) }} />}
          </span>
          <span className={`w-fit chamfer-xs px-2 py-1 flex items-center gap-1.5 text-[10px] font-mono font-bold ${shieldOn ? 'bg-ok/15 text-ok border border-ok/40' : 'bg-bg2/80 text-dim border border-line'}`}>
            <Icon name="shield" size={12} />
            {shieldOn ? (night ? 'НОЧНОЕ ПЕРЕМИРИЕ' : `ЩИТ БАЗЫ ${fmtDur((state.base.shieldUntil - Date.now()) / 1000)}`) : 'БАЗА ОТКРЫТА'}
          </span>
          {state.buffs.supportUntil > Date.now() && (
            <span className="w-fit chamfer-xs px-2 py-1 flex items-center gap-1.5 text-[10px] font-mono font-bold bg-amb/15 text-amb border border-amb/40">
              <Icon name="sword" size={12} /> ПОДДЕРЖКА +10% {fmtDur((state.buffs.supportUntil - Date.now()) / 1000)}
            </span>
          )}
          {state.prod.length > 0 && (
            <span className="w-fit chamfer-xs px-2 py-1 flex items-center gap-1.5 text-[10px] font-mono font-bold bg-bg2/85 text-acc border border-line pointer-events-auto" onClick={() => setSel(state.prod[0].hexId)}>
              <Icon name="factory" size={12} /> {PART_MAP[state.prod[0].partId]?.name} · {fmtDur((state.prod[0].startedAt + state.prod[0].duration - Date.now()) / 1000)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 items-end pointer-events-auto">
          {state.events.slice(0, 3).map((e) => {
            const t = state.terrs.find((x) => x.id === e.hexId);
            if (!t) return null;
            return (
              <button key={e.id} onClick={() => { cam.current.follow = false; cam.current.x = t.x; cam.current.y = t.y; cam.current.tz = 1.15; setSel(t.id); }}
                className={`panel chamfer-sm px-2 py-1.5 flex items-center gap-2 text-[10px] font-bold ${e.kind === 'invasion' || e.kind === 'convoy' ? 'text-danger border-danger/40' : 'text-amb border-amb/40'}`}>
                <span className="w-1.5 h-1.5 rounded-full blink" style={{ background: e.kind === 'invasion' || e.kind === 'convoy' ? '#e4574f' : '#f2a93b' }} />
                {e.kind === 'anomaly' ? 'Аномалия' : e.kind === 'wreck' ? 'Обломки' : e.kind === 'convoy' ? 'Конвой' : 'Вторжение'} · {t.name}
              </button>
            );
          })}
        </div>
      </div>
      {/* правые кнопки */}
      <div className="absolute right-2 bottom-40 flex flex-col gap-2">
        <button className="btn-ghost chamfer-sm p-2.5" onClick={() => { cam.current.tz = Math.min(1.9, cam.current.tz * 1.25); }} aria-label="Приблизить"><Icon name="plus" size={18} /></button>
        <button className="btn-ghost chamfer-sm p-2.5" onClick={() => { cam.current.tz = Math.max(0.55, cam.current.tz * 0.8); }} aria-label="Отдалить"><Icon name="minus" size={18} /></button>
        <button className="btn-ghost chamfer-sm p-2.5 text-acc" onClick={() => { cam.current.follow = true; }} aria-label="Ко мне"><Icon name="center" size={18} /></button>
        <button className={`chamfer-sm p-2.5 border ${Date.now() < dashCd ? 'btn-ghost opacity-50' : 'btn-warn'}`} onClick={dash} aria-label="Марш-бросок"><Icon name="walk" size={18} /></button>
        <button className={`chamfer-sm p-2.5 border ${sensors.gps === 'on' || sensors.motion === 'on' ? 'btn-acc' : 'btn-ghost'}`} onClick={() => setSensorPanel(true)} aria-label="Датчики"><Icon name="radar" size={18} /></button>
      </div>

      {/* чипы датчиков */}
      <div className="absolute left-2 top-2 flex flex-col gap-1 items-start pointer-events-none">
        <div className="chamfer-xs bg-bg0/80 border border-line px-2 py-1 flex items-center gap-2 font-mono text-[9px]">
          <span className={`w-1.5 h-1.5 rounded-full ${sensors.gps === 'on' ? 'bg-ok' : sensors.gps === 'starting' ? 'bg-amb blink' : 'bg-faint'}`} />
          <span className={sensors.gps === 'on' ? 'text-ok' : 'text-faint'}>GPS{sensors.gpsAccuracy != null ? ` ±${sensors.gpsAccuracy}м` : sensors.gps === 'denied' ? ' нет доступа' : ' сим'}</span>
          <span className="text-dim">{fmt(sensors.steps)} шаг</span>
          <span className="text-dim">{sensors.headingDeg != null ? `${sensors.headingDeg}°` : 'С'} </span>
        </div>
      </div>

      {/* компас-пеленг к выбранной зоне */}
      {bearing && selTerr && (
        <button onClick={() => { cam.current.follow = false; }} className="absolute left-1/2 -translate-x-1/2 top-2 chamfer-sm bg-bg0/85 border border-acc/40 px-3 py-1.5 flex items-center gap-2 anim-in">
          <svg width="16" height="16" viewBox="0 0 16 16" style={{ transform: `rotate(${bearing.rel}deg)` }}>
            <path d="M8 1 12 12 8 9.5 4 12z" fill="#35e0c8" />
          </svg>
          <span className="font-mono text-[10px] text-acc font-bold">{fmt(bearing.dist)} м</span>
          <span className="font-mono text-[9px] text-dim">{selTerr.name.length > 14 ? selTerr.name.slice(0, 13) + '…' : selTerr.name} · {bearing.deg}°</span>
        </button>
      )}
      {/* джойстик */}
      <div className="absolute left-4 bottom-8 flex flex-col items-center gap-2">
        <div className="flex gap-1">
          {([1, 4, 12] as const).map((sp) => (
            <button key={sp} onClick={() => dispatch({ type: 'SET_SETTINGS', patch: { speed: sp } })}
              className={`chamfer-xs px-2.5 py-1 text-[10px] font-mono font-bold border ${state.settings.speed === sp ? 'bg-acc text-bg0 border-acc' : 'bg-bg2/80 text-dim border-line'}`}>
              {speedLabels[sp]}
            </button>
          ))}
        </div>
        <div
          ref={padRef}
          className="relative w-32 h-32 rounded-full border-2 border-line2 bg-bg1/70 backdrop-blur-sm"
          onPointerDown={joyDown} onPointerMove={(e) => joy.current.active && joyMove(e)} onPointerUp={joyUp} onPointerCancel={joyUp}
        >
          <div className="absolute inset-3 rounded-full border border-line" />
          <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-faint" />
          <div
            className={`absolute left-1/2 top-1/2 w-14 h-14 -ml-7 -mt-7 rounded-full border-2 transition-colors ${knob.on ? 'bg-acc/90 border-acc' : 'bg-bg3 border-line2'}`}
            style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
          >
            <Icon name="chevU" size={20} className="mx-auto mt-3.5 text-bg0 opacity-80" />
          </div>
        </div>
        <span className="hud-label">{state.settings.speed === 1 ? 'Пешком' : state.settings.speed === 4 ? 'Патруль' : 'Форсаж'} · СИМ</span>
      </div>
      {/* контекстная кнопка */}
      {action && (
        <div className="absolute right-4 bottom-8 left-44 flex justify-end pointer-events-none">
          <button
            onClick={doAction}
            disabled={action.kind === 'info'}
            className={`pointer-events-auto chamfer px-5 py-3.5 text-sm tracking-wide flex items-center gap-2 ${action.kind === 'attack' ? 'btn-warn' : action.kind === 'info' ? 'btn-ghost' : 'btn-acc'} ${action.kind === 'attack' ? 'anim-glow' : ''}`}
          >
            <Icon name={action.kind === 'attack' ? 'sword' : action.kind === 'collect' ? 'box' : action.kind === 'factory' ? 'factory' : 'target'} size={18} />
            {action.label}
          </button>
        </div>
      )}

      {/* карточка зоны */}
      <Sheet open={!!selTerr} onClose={() => setSel(null)} title={selTerr?.name ?? ''}>
        {selTerr && <TerrCard t={selTerr} state={state} dispatch={dispatch} onAttack={onAttack} close={() => setSel(null)} />}
      </Sheet>

      {/* панель датчиков */}
      <Sheet open={sensorPanel} onClose={() => setSensorPanel(false)} title="Датчики устройства">
        <div className="space-y-2.5">
          {([
            ['GPS-модуль', sensors.gps, sensors.gps === 'on' ? `точность ±${sensors.gpsAccuracy ?? '—'} м · позиция привязана к сектору` : 'реальное перемещение вместо джойстика'],
            ['Акселерометр', sensors.motion, sensors.motion === 'on' ? `шаги: ${fmt(sensors.steps)} · питают энергию развёртывания` : 'подсчёт реальных шагов'],
            ['Компас', sensors.compass, sensors.compass === 'on' ? `курс ${sensors.headingDeg ?? 0}° · пеленг к зонам` : 'наведение маркера и пеленга'],
          ] as const).map(([name, st, sub]) => (
            <div key={name} className="panel-deep chamfer-xs p-3 flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${st === 'on' ? 'bg-ok' : st === 'starting' ? 'bg-amb blink' : st === 'denied' ? 'bg-danger' : 'bg-faint'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold">{name} <span className="font-mono text-[9px] text-faint uppercase">{st === 'off' ? 'выкл' : st === 'starting' ? 'запуск…' : st === 'on' ? 'активен' : st === 'denied' ? 'запрещён' : 'нет на устройстве'}</span></div>
                <div className="text-[10px] text-dim truncate">{sub}</div>
              </div>
              {name === 'GPS-модуль' && (
                sensors.gps === 'on'
                  ? <button className="btn-ghost chamfer-xs px-2.5 py-1.5 text-[10px] font-bold" onClick={sensors.stopGps}>СТОП</button>
                  : <button className="btn-acc chamfer-xs px-2.5 py-1.5 text-[10px] font-bold" onClick={sensors.startGps}>СТАРТ</button>
              )}
            </div>
          ))}
          {sensors.needGesture && (
            <button className="btn-acc chamfer w-full py-3.5 text-sm" onClick={sensors.enableAll}>ВКЛЮЧИТЬ ДАТЧИКИ</button>
          )}
          <p className="text-[10px] text-faint leading-snug">
            На iPhone доступ к движению и компасу выдаётся только по явному нажатию. Координаты обрабатываются локально,
            точная позиция никогда не передаётся другим игрокам — только принадлежность зон. Без датчиков игра работает в режиме симуляции (джойстик).
          </p>
          <button className="btn-ghost chamfer-xs w-full py-2 text-[11px]" onClick={() => dispatch({ type: 'SET_SETTINGS', patch: { gps: !state.settings.gps } })}>
            Учёт ходьбы: GPS-режим {state.settings.gps ? 'ВКЛ' : 'выкл'} {state.settings.gps ? '(шаги не дублируют метры)' : '(метры считаются по шагам)'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}

function TerrCard({ t, state, dispatch, onAttack, close }: {
  t: Territory; state: ReturnType<typeof useGame>['state']; dispatch: ReturnType<typeof useGame>['dispatch'];
  onAttack: (id: string) => void; close: () => void;
}) {
  const isOwn = t.owner === state.profile.faction;
  const rate = rateFor(t);
  const near = nearHex(state, t);
  const ready = canAttackNow(t);
  const recipe = t.factoryId ? RECIPES[t.factoryId] : null;
  const ev = state.events.find((e) => e.hexId === t.id);
  const canPay = (input: Partial<Record<ResKey, number>>) => Object.entries(input).every(([k, v]) => state.res[k as ResKey] >= (v ?? 0));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="chamfer-xs px-2 py-1 bg-bg2 border border-line text-[10px] font-mono font-bold text-dim">{TYPE_LABEL[t.type]}</span>
        <span className="chamfer-xs px-2 py-1 bg-bg2 border border-line text-[10px] font-mono font-bold text-amb">
          {'◆'.repeat(Math.min(5, t.tier))} УР.{t.tier}
        </span>
        <span className="chamfer-xs px-2 py-1 border text-[10px] font-mono font-bold" style={{ borderColor: `${ownerColor(t.owner)}66`, color: ownerColor(t.owner), background: `${ownerColor(t.owner)}14` }}>
          {ownerName(t.owner)}
        </span>
        {ev && <span className="chamfer-xs px-2 py-1 bg-danger/15 border border-danger/50 text-danger text-[10px] font-mono font-bold blink">СОБЫТИЕ</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div className="panel-deep chamfer-xs p-2.5">
          <div className="hud-label mb-1">Доход</div>
          <div className="font-mono font-bold text-ink">{rate.credits} кр/мин{rate.res && rate.amount ? ` +${rate.amount} ${RES_META[rate.res].short}` : ''}</div>
          {t.type === 'strategic' && <div className="text-[10px] text-acc mt-0.5">+15% соседним зонам альянса</div>}
        </div>
        <div className="panel-deep chamfer-xs p-2.5">
          <div className="hud-label mb-1">Гарнизон</div>
          <div className="font-mono font-bold text-ink flex items-center gap-1.5">
            <Icon name="skull" size={13} className="text-danger" /> {t.garrison.power} · {t.garrison.size} юн.
          </div>
          {isOwn && <div className="text-[10px] text-ok mt-0.5">Оборона: {t.defense}/100</div>}
        </div>
      </div>
      {isOwn && (
        <div className="panel-deep chamfer-xs p-2.5 flex items-center justify-between">
          <div>
            <div className="hud-label mb-0.5">Накоплено</div>
            <div className="font-mono font-bold text-amb text-lg leading-none">{fmt(Math.floor(t.unclaimed))} кр.</div>
          </div>
          <button className="btn-acc chamfer-sm px-4 py-2.5 text-xs" disabled={t.unclaimed < 1} onClick={() => dispatch({ type: 'COLLECT', hexId: t.id })}>
            СОБРАТЬ
          </button>
        </div>
      )}
      {ev && (ev.kind === 'anomaly' || ev.kind === 'wreck') && near && (
        <button className="btn-warn chamfer w-full py-3 text-sm flex items-center justify-center gap-2" onClick={() => { dispatch({ type: 'SCAN_EVENT', eventId: ev.id }); close(); }}>
          <Icon name="radar" size={17} /> {ev.kind === 'anomaly' ? 'Стабилизировать аномалию' : 'Собрать обломки'}
        </button>
      )}
      {t.type === 'landmark' && near && (
        <button className="btn-acc chamfer w-full py-3 text-sm flex items-center justify-center gap-2" disabled={(t.attackReadyAt ?? 0) > Date.now()} onClick={() => dispatch({ type: 'SCAN_LANDMARK', hexId: t.id })}>
          <Icon name="star" size={17} /> Исследовать (+50 кр, +40 XP)
        </button>
      )}
      {!isOwn && t.type !== 'water' && (
        <div className="space-y-1.5">
          <button className="btn-warn chamfer w-full py-3.5 text-sm flex items-center justify-center gap-2" disabled={!near || !ready || state.deployEnergy < ATTACK_ENERGY_COST} onClick={() => { onAttack(t.id); close(); }}>
            <Icon name="sword" size={18} />
            {!near ? 'Подойдите ближе (165 м)'
              : !ready ? `Перезарядка ${fmtDur(((t.attackReadyAt ?? 0) - Date.now()) / 1000)}`
              : state.deployEnergy < ATTACK_ENERGY_COST ? `Нужно ${ATTACK_ENERGY_COST}⚡ — копится со временем и ходьбой`
              : `НАЧАТЬ ШТУРМ · ${ATTACK_ENERGY_COST}⚡`}
          </button>
          {!near && <p className="text-[10px] text-dim text-center">До центра зоны {fmt(Math.hypot(t.x - state.pos.x, t.y - state.pos.y))} м</p>}
          {near && state.deployEnergy < ATTACK_ENERGY_COST && <p className="text-[10px] text-amb text-center">Энергия развёртывания восстанавливается: +1 каждые ~22 с, ходьба ускоряет заряд</p>}
        </div>
      )}
      {isOwn && t.type !== 'water' && (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost chamfer-sm py-2.5 text-xs flex items-center justify-center gap-1.5" disabled={t.defense >= 100 || state.credits < 40 * t.tier} onClick={() => dispatch({ type: 'REINFORCE', hexId: t.id })}>
            <Icon name="shield" size={15} /> Укрепить · {40 * t.tier} кр.
          </button>
          <button className="btn-ghost chamfer-sm py-2.5 text-xs flex items-center justify-center gap-1.5" disabled={t.id === state.base.hexId || state.credits < 300} onClick={() => dispatch({ type: 'RELOCATE_BASE', hexId: t.id })}>
            <Icon name="hq" size={15} /> Штаб сюда · 300 кр.
          </button>
        </div>
      )}
      {recipe && isOwn && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="hud-label">{FACTORIES[t.factoryId!].name} · очередь {state.prod.length}/{prodSlots(state)}</div>
            <Icon name="factory" size={16} className="text-acc" />
          </div>
          <div className="space-y-1.5">
            {recipe.map((r) => {
              const p = PART_MAP[r.partId];
              const locked = r.req && (r.req.startsWith('eng') ? state.profile.engLevel < parseInt(r.req.slice(3)) : !state.researched.includes(r.req));
              const busy = state.prod.length >= prodSlots(state);
              return (
                <div key={r.partId} className={`panel-deep chamfer-xs p-2.5 flex items-center gap-2 ${locked ? 'opacity-45' : ''}`}>
                  <span className="w-1 h-8 shrink-0" style={{ background: p.tier === 3 ? '#f08fb8' : p.tier === 2 ? '#c9a0f0' : '#5c7089' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold truncate">{p.name}</div>
                    <div className="text-[10px] font-mono text-dim">
                      {Object.entries(r.input).map(([k, v]) => `${v} ${RES_META[k as ResKey]?.short}`).join(' · ')} · {fmtDur(r.time)}
                    </div>
                  </div>
                  {locked
                    ? <span className="text-faint"><Icon name="lock" size={16} /></span>
                    : <button className="btn-acc chamfer-xs px-3 py-2 text-[11px] font-bold" disabled={busy || !canPay(r.input)} onClick={() => dispatch({ type: 'START_PRODUCTION', hexId: t.id, partId: r.partId })}>В ЦЕХ</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {recipe && !isOwn && <p className="text-[11px] text-dim">Захватите завод, чтобы открыть производство категории «{FACTORIES[t.factoryId!].cat}».</p>}
      <div className="h-1" />
      <div className="hud-label">Сектор {String.fromCharCode(65 + ((t.q + 4) % 8))}{hexRing(t.q, t.r)} · страт. важность {t.tier}/5</div>
    </div>
  );
}
