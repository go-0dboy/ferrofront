import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

export type SensorState = 'off' | 'starting' | 'on' | 'denied' | 'unavailable';

export interface SensorsValue {
  gps: SensorState; gpsAccuracy: number | null;
  motion: SensorState; compass: SensorState;
  needGesture: boolean;
  steps: number; headingDeg: number | null;
  lat: number | null; lon: number | null;
  enableAll: () => void;
  startGps: () => void; stopGps: () => void;
}

const SensorsCtx = createContext<SensorsValue | null>(null);

interface Callbacks {
  onSteps: (count: number) => void;
  onHeading: (deg: number) => void;
  onGpsMove: (lat: number, lon: number, accuracy: number) => void;
}

const hasMotionPermission = () =>
  typeof DeviceMotionEvent !== 'undefined' && typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function';
const hasOrientationPermission = () =>
  typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function';

export function SensorsProvider({ children, cb }: { children: React.ReactNode; cb: Callbacks }) {
  const [gps, setGps] = useState<SensorState>('off');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [motion, setMotion] = useState<SensorState>('off');
  const [compass, setCompass] = useState<SensorState>('off');
  const [steps, setSteps] = useState(0);
  const [headingDeg, setHeadingDeg] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const cbRef = useRef(cb); cbRef.current = cb;
  const watchId = useRef<number | null>(null);
  const stepsRef = useRef({ lastPeak: 0, ema: 9.81, acc: 0 });
  const motionOn = useRef(false);
  const compassOn = useRef(false);

  /* ---------- акселерометр: детекция шагов ---------- */
  const onMotion = useCallback((e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    const st = stepsRef.current;
    st.ema = st.ema * 0.9 + mag * 0.1;
    const now = performance.now();
    // пик выше порога относительно скользящего среднего, рефрактор 320 мс
    if (mag - st.ema > 1.7 && now - st.lastPeak > 320) {
      st.lastPeak = now;
      st.acc += 1;
      setSteps((s) => s + 1);
      if (st.acc >= 4) { cbRef.current.onSteps(st.acc); st.acc = 0; }
    }
  }, []);
  useEffect(() => {
    if (!motionOn.current) return;
    window.addEventListener('devicemotion', onMotion);
    const flush = setInterval(() => {
      if (stepsRef.current.acc > 0) { cbRef.current.onSteps(stepsRef.current.acc); stepsRef.current.acc = 0; }
    }, 1200);
    return () => { window.removeEventListener('devicemotion', onMotion); clearInterval(flush); };
  }, [motion, onMotion]);

  /* ---------- компас (троттлинг: ≥3° и не чаще 4/с, чтобы не грузить редьюсер) ---------- */
  const lastH = useRef({ deg: -999, t: 0 });
  const onOrient = useCallback((e: DeviceOrientationEvent) => {
    const w = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
    let deg: number | null = null;
    if (typeof w.webkitCompassHeading === 'number') deg = w.webkitCompassHeading;
    else if (e.absolute && e.alpha != null) deg = (360 - e.alpha) % 360;
    if (deg == null || Number.isNaN(deg)) return;
    if (!compassOn.current) { compassOn.current = true; setCompass('on'); }
    setHeadingDeg(Math.round(deg));
    const now = performance.now();
    const dDiff = Math.abs(((deg - lastH.current.deg + 540) % 360) - 180);
    if (dDiff >= 3 || now - lastH.current.t > 250) {
      lastH.current = { deg, t: now };
      cbRef.current.onHeading(deg);
    }
  }, []);
  useEffect(() => {
    if (compass !== 'on') return;
    window.addEventListener('deviceorientationabsolute', onOrient as EventListener);
    window.addEventListener('deviceorientation', onOrient as EventListener);
    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrient as EventListener);
      window.removeEventListener('deviceorientation', onOrient as EventListener);
    };
  }, [compass, onOrient]);

  /* ---------- GPS ---------- */
  const startGps = useCallback(() => {
    if (watchId.current != null) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGps('unavailable'); return; }
    setGps('starting');
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setGps('on');
        setGpsAccuracy(Math.round(p.coords.accuracy));
        setCoords({ lat: p.coords.latitude, lon: p.coords.longitude });
        cbRef.current.onGpsMove(p.coords.latitude, p.coords.longitude, p.coords.accuracy);
      },
      (err) => { setGps(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'); watchId.current = null; },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }, []);
  const stopGps = useCallback(() => {
    if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current);
    watchId.current = null; setGps('off'); setGpsAccuracy(null);
  }, []);
  useEffect(() => () => { if (watchId.current != null) navigator.geolocation?.clearWatch(watchId.current); }, []);

  /* ---------- включение всего (жест пользователя — требование iOS) ---------- */
  const enableAll = useCallback(async () => {
    try {
      if (hasMotionPermission()) {
        setMotion('starting');
        const r = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
        if (r === 'granted') { motionOn.current = true; setMotion('on'); } else setMotion('denied');
      } else if (typeof DeviceMotionEvent !== 'undefined') {
        motionOn.current = true; setMotion('on');
      } else setMotion('unavailable');
    } catch { setMotion('denied'); }
    try {
      if (hasOrientationPermission()) {
        const r = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
        if (r === 'granted') setCompass('starting'); else setCompass('denied');
      } else if (typeof DeviceOrientationEvent !== 'undefined') setCompass('starting');
      else setCompass('unavailable');
    } catch { setCompass('denied'); }
    startGps();
  }, [startGps]);

  const needGesture = hasMotionPermission() || hasOrientationPermission();

  return (
    <SensorsCtx.Provider value={{
      gps, gpsAccuracy, motion, compass, needGesture, steps, headingDeg,
      lat: coords?.lat ?? null, lon: coords?.lon ?? null, enableAll, startGps, stopGps,
    }}>
      {children}
    </SensorsCtx.Provider>
  );
}

export function useSensors() {
  const v = useContext(SensorsCtx);
  if (!v) throw new Error('SensorsProvider missing');
  return v;
}
