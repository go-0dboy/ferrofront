import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

/*
 * СЕТЕВОЙ СЛОЙ ФЕРРОФРОНТ — сменные адаптеры.
 * Игра общается только с NetProvider (useNet), поэтому транспорт можно менять
 * без переписывания геймплея:
 *
 *  1. manual    — чистый WebRTC, ручная сигнализация кодами (vanilla ICE). Ноль серверов.
 *  2. peerjs    — PeerJS Cloud: бесплатный публичный брокер, короткие коды комнат,
 *                 работает через Интернет (библиотека грузится с CDN по требованию).
 *  3. supabase  — Supabase Realtime: broadcast + presence, общая комната мира
 *                 (нужны URL и anon-ключ бесплатного проекта; js грузится с CDN).
 *  4. colyseus  — собственный авторитативный сервер (см. server/), клиент грузится с CDN.
 *
 * Протокол поверх любого транспорта — один: NetMsg (hello/roster/chat/capture/bye).
 * Топологии: manual и peerjs — «звезда» с ретрансляцией хостом (relays=false);
 * supabase и colyseus — инфраструктура сама доставляет всем (relays=true).
 */

export type NetMode = 'manual' | 'peerjs' | 'supabase' | 'colyseus';
export type NetStatus = 'idle' | 'hosting' | 'joining' | 'connecting' | 'connected' | 'error';
export interface NetPeer { id: string; name: string; faction: string; level: number; }
export interface NetMsg {
  t: 'hello' | 'roster' | 'chat' | 'capture' | 'bye';
  from?: string; name?: string; faction?: string; level?: number;
  text?: string; hexId?: string; zoneName?: string; at?: number;
  peers?: NetPeer[];
}
export interface NetLogEntry { at: number; text: string; kind: 'info' | 'ok' | 'err'; }
export interface NetConfig { mode: NetMode; supabaseUrl: string; supabaseKey: string; colyseusUrl: string; room: string; }

export const MODE_LABEL: Record<NetMode, string> = {
  manual: 'РУЧНОЙ P2P', peerjs: 'PEERJS CLOUD', supabase: 'SUPABASE', colyseus: 'COLYSEUS',
};

declare global {
  interface Window { Peer?: unknown; supabase?: unknown; Colyseus?: unknown; }
}

const CFG_KEY = 'ff_net_cfg_v1';
const loadCfg = (): NetConfig => {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return { mode: 'manual', supabaseUrl: '', supabaseKey: '', colyseusUrl: '', room: 'kraisk-7', ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { mode: 'manual', supabaseUrl: '', supabaseKey: '', colyseusUrl: '', room: 'kraisk-7' };
};

const b64e = (s: string) => btoa(unescape(encodeURIComponent(s)));
const b64d = (s: string) => decodeURIComponent(escape(atob(s.trim())));
const shortId = () => Math.random().toString(36).slice(2, 8);
const roomCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();

function loadScript(src: string, globalName: string): Promise<unknown> {
  const w = window as unknown as Record<string, unknown>;
  if (w[globalName]) return Promise.resolve(w[globalName]);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => (w[globalName] ? res(w[globalName]) : rej(new Error('no-global')));
    s.onerror = () => rej(new Error('cdn'));
    document.head.appendChild(s);
  });
}

export interface AdapterHooks {
  status: (s: NetStatus, err?: string) => void;
  peers: (p: NetPeer[]) => void;
  msg: (m: NetMsg) => void;
  log: (text: string, kind?: NetLogEntry['kind']) => void;
}
export interface NetAdapter {
  readonly relays: boolean;        // инфраструктура сама рассылает всем
  readonly needsHandshake: boolean; // нужен ручной обмен кодами
  host(): Promise<string>;          // создать комнату; возвращает код/приглашение
  join(code: string): Promise<string | void>; // войти; для manual возвращает код-ответ
  accept?(code: string): Promise<void>;       // manual: принять ответ гостя
  sendTo?(id: string, m: NetMsg): void;
  send(m: NetMsg): void;
  close(): void;
}

/* ============ 1. РУЧНОЙ WebRTC (vanilla ICE) ============ */
const RTC_CFG: RTCConfiguration = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };

export class ManualRtcAdapter implements NetAdapter {
  relays = false; needsHandshake = true;
  private conns = new Map<string, RTCPeerConnection>();
  private channels = new Map<string, RTCDataChannel>();
  constructor(private h: AdapterHooks) {}

  private waitIce(pc: RTCPeerConnection): Promise<void> {
    return new Promise((res) => {
      if (pc.iceGatheringState === 'complete') return res();
      const to = setTimeout(res, 2500);
      const check = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(to); res(); } };
      pc.addEventListener('icegatheringstatechange', check);
    });
  }
  private wire(id: string, ch: RTCDataChannel) {
    ch.onmessage = (ev) => { try { this.h.msg(JSON.parse(ev.data as string) as NetMsg); } catch { /* skip */ } };
    ch.onclose = () => { this.drop(id); this.h.log(`Канал ${id} закрыт`, 'info'); };
    this.channels.set(id, ch);
  }
  private wirePc(id: string, pc: RTCPeerConnection) {
    this.conns.set(id, pc);
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      if (st === 'failed' || st === 'closed' || st === 'disconnected') {
        setTimeout(() => { if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') this.drop(id); }, 4000);
      }
    };
  }
  private drop(id: string) {
    this.channels.get(id)?.close(); this.conns.get(id)?.close();
    this.channels.delete(id); this.conns.delete(id);
  }
  async host(): Promise<string> {
    this.h.status('hosting'); this.h.log('Создаю комнату WebRTC…');
    const pc = new RTCPeerConnection(RTC_CFG);
    const gid = `g${shortId()}`;
    const ch = pc.createDataChannel('ff');
    this.wirePc(gid, pc); this.wire(gid, ch);
    ch.onopen = () => { this.h.status('connected'); this.h.log('Гость подключился', 'ok'); };
    await pc.setLocalDescription(await pc.createOffer());
    await this.waitIce(pc);
    return b64e(JSON.stringify({ s: pc.localDescription?.sdp, t: pc.localDescription?.type, g: gid }));
  }
  async join(invite: string): Promise<string> {
    this.h.status('joining');
    try {
      const { s, t, g } = JSON.parse(b64d(invite));
      const pc = new RTCPeerConnection(RTC_CFG);
      const id = g ?? 'host';
      this.wirePc(id, pc);
      pc.ondatachannel = (ev) => {
        this.wire(id, ev.channel);
        ev.channel.onopen = () => { this.h.status('connected'); this.h.log('Канал с хостом открыт', 'ok'); };
      };
      await pc.setRemoteDescription({ type: t, sdp: s });
      await pc.setLocalDescription(await pc.createAnswer());
      await this.waitIce(pc);
      this.h.log('Ответ сформирован — отправьте хосту');
      return b64e(JSON.stringify({ s: pc.localDescription?.sdp, t: pc.localDescription?.type, g: id }));
    } catch {
      this.h.status('error', 'Не удалось прочитать код приглашения');
      throw new Error('bad invite');
    }
  }
  async accept(code: string): Promise<void> {
    try {
      const { s, t, g } = JSON.parse(b64d(code));
      const pc = this.conns.get(g);
      if (!pc) throw new Error('expired');
      await pc.setRemoteDescription({ type: t, sdp: s });
      this.h.log('Ответ принят, соединяем…');
    } catch {
      this.h.status('error', 'Неверный или устаревший код-ответ');
      throw new Error('bad answer');
    }
  }
  sendTo(id: string, m: NetMsg) { const ch = this.channels.get(id); if (ch?.readyState === 'open') ch.send(JSON.stringify(m)); }
  send(m: NetMsg) { for (const ch of this.channels.values()) if (ch.readyState === 'open') ch.send(JSON.stringify(m)); }
  close() { for (const id of [...this.channels.keys()]) this.sendTo(id, { t: 'bye' }); for (const c of this.conns.values()) c.close(); this.conns.clear(); this.channels.clear(); }
}

/* ============ 2. PEERJS CLOUD ============ */
export class PeerJsAdapter implements NetAdapter {
  relays = false; needsHandshake = false;
  private peer: { destroy(): void; on(e: string, cb: (...a: unknown[]) => void): void; connect(id: string, o?: object): unknown; id?: string } | null = null;
  private conns = new Map<string, { send(d: string): void; close(): void; on(e: string, cb: (...a: unknown[]) => void): void; peer: string; open?: boolean }>();
  constructor(private h: AdapterHooks, private self: () => { name: string; faction: string; level: number }) {}

  private async lib(): Promise<new (id?: string) => never> {
    try { await loadScript('https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js', 'Peer'); }
    catch { throw new Error('Библиотека PeerJS не загрузилась — проверьте интернет'); }
    return window.Peer as new (id?: string) => never;
  }
  private wireConn(conn: { peer: string; on(e: string, cb: (...a: unknown[]) => void): void; send(d: string): void; close(): void }) {
    conn.on('open', () => {
      this.conns.set(conn.peer, conn);
      this.h.status('connected');
      this.h.log(`Соединение ${conn.peer.slice(0, 8)} открыто`, 'ok');
      conn.send(JSON.stringify({ t: 'hello', ...this.self() }));
    });
    conn.on('data', (d: unknown) => { try { this.h.msg(JSON.parse(String(d)) as NetMsg); } catch { /* skip */ } });
    conn.on('close', () => { this.conns.delete(conn.peer); this.h.log(`Узел ${conn.peer.slice(0, 8)} отключился`, 'info'); if (!this.conns.size) this.h.status('hosting'); });
  }
  async host(): Promise<string> {
    const Peer = await this.lib();
    const code = roomCode();
    this.h.status('connecting'); this.h.log('Регистрирую комнату на PeerJS Cloud…');
    return new Promise((res, rej) => {
      const peer = new Peer(`ff7-${code}`) as unknown as { destroy(): void; on(e: string, cb: (...a: unknown[]) => void): void; connect(id: string, o?: object): unknown };
      this.peer = peer;
      peer.on('open', () => { this.h.status('hosting'); this.h.log(`Комната ${code} готова`, 'ok'); res(code); });
      peer.on('connection', (conn: unknown) => this.wireConn(conn as never));
      peer.on('error', (e: unknown) => {
        const t = (e as { type?: string } | undefined)?.type;
        if (t === 'unavailable-id') { this.h.log('Код занят, генерирую новый', 'err'); rej(new Error('taken')); }
        else { this.h.status('error', 'PeerJS: ' + (t ?? 'сбой брокера')); rej(new Error(t ?? 'peerjs')); }
      });
    });
  }
  async join(code: string): Promise<void> {
    const Peer = await this.lib();
    this.h.status('connecting'); this.h.log(`Стучусь в комнату ${code.toUpperCase()}…`);
    return new Promise((res, rej) => {
      const peer = new Peer() as unknown as { destroy(): void; on(e: string, cb: (...a: unknown[]) => void): void; connect(id: string, o?: object): unknown };
      this.peer = peer;
      peer.on('open', () => this.wireConn(peer.connect(`ff7-${code.toUpperCase()}`, { reliable: true }) as never));
      peer.on('error', (e: unknown) => {
        const t = (e as { type?: string } | undefined)?.type;
        this.h.status('error', t === 'peer-unavailable' ? `Комната ${code.toUpperCase()} не найдена` : 'PeerJS: ' + (t ?? 'сбой брокера'));
        rej(new Error(t ?? 'peerjs'));
      });
      setTimeout(() => rej(new Error('timeout')), 12000);
    });
  }
  sendTo(id: string, m: NetMsg) { this.conns.get(id)?.send(JSON.stringify(m)); }
  send(m: NetMsg) { const s = JSON.stringify(m); for (const c of this.conns.values()) c.send(s); }
  close() { for (const c of this.conns.values()) c.close(); this.conns.clear(); this.peer?.destroy(); this.peer = null; }
}

/* ============ 3. SUPABASE REALTIME ============ */
export class SupabaseAdapter implements NetAdapter {
  relays = true; needsHandshake = false;
  private client: { removeChannel(ch: unknown): void; channel(name: string, opts?: object): SupaChannel; } | null = null;
  private channel: SupaChannel | null = null;
  private roomName = '';
  readonly myId = shortId();
  constructor(private h: AdapterHooks, private url: string, private key: string, private self: () => { name: string; faction: string; level: number }) {}

  async host(): Promise<string> { await this.join(''); return this.roomName; }
  async join(roomIn: string): Promise<void> {
    if (!this.url || !this.key) { this.h.status('error', 'Укажите URL и anon-ключ проекта Supabase'); throw new Error('nocreds'); }
    try { await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js', 'supabase'); }
    catch { this.h.status('error', 'Supabase JS не загрузился — проверьте интернет'); throw new Error('cdn'); }
    const sbFactory = window.supabase as { createClient(u: string, k: string): SupabaseClient };
    const room = (roomIn || 'kraisk-7').trim();
    this.roomName = room;
    this.h.status('connecting'); this.h.log(`Подключаюсь к комнате «${room}»…`);
    this.client = sbFactory.createClient(this.url, this.key);
    const ch = this.client.channel(`ff-${room}`, { config: { presence: { key: this.myId } } });
    this.channel = ch;
    ch.on('broadcast', { event: 'ff' }, (p: { payload?: NetMsg }) => { if (p.payload) this.h.msg(p.payload); });
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState() as Record<string, { name?: string; faction?: string; level?: number }[]>;
      const peers: NetPeer[] = Object.entries(st).filter(([k]) => k !== this.myId)
        .map(([k, v]) => ({ id: k, name: v[0]?.name ?? 'Командир', faction: v[0]?.faction ?? 'azur', level: v[0]?.level ?? 1 }));
      this.h.peers(peers);
      this.h.log(`В комнате ${peers.length + 1} участников`, 'info');
    });
    await new Promise<void>((res, rej) => {
      const to = setTimeout(() => { this.h.status('error', 'Таймаут подключения к Supabase'); rej(new Error('timeout')); }, 12000);
      ch.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(to);
          await ch.track({ name: this.self().name, faction: this.self().faction, level: this.self().level });
          this.h.status('connected'); this.h.log('Realtime-канал открыт', 'ok');
          res();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(to);
          this.h.status('error', 'Supabase: канал отклонён (проверьте ключ и Realtime)');
          rej(new Error('channel'));
        }
      });
    });
  }
  send(m: NetMsg) { void this.channel?.send({ type: 'broadcast', event: 'ff', payload: { ...m, from: this.myId } }); }
  close() { if (this.channel && this.client) void this.client.removeChannel(this.channel); this.channel = null; }
}
interface SupaChannel {
  on(type: string, filter: object, cb: (p: { payload?: NetMsg }) => void): SupaChannel;
  on(type: string, filter: object, cb: () => void): SupaChannel;
  subscribe(cb: (status: string) => void): SupaChannel;
  presenceState(): object;
  track(payload: object): Promise<unknown>;
  send(m: object): Promise<unknown>;
}
interface SupabaseClient { channel(name: string, opts?: object): SupaChannel; removeChannel(ch: unknown): void; }

/* ============ 4. COLYSEUS (свой сервер) ============ */
export class ColyseusAdapter implements NetAdapter {
  relays = true; needsHandshake = false;
  private room: { send(t: string, m: object): void; leave(): void; onMessage(t: string, cb: (m: NetMsg) => void): void; onLeave(cb: () => void): void } | null = null;
  private roomName = '';
  constructor(private h: AdapterHooks, private url: string, private self: () => { name: string; faction: string; level: number }) {}

  async host(): Promise<string> { await this.join(''); return this.roomName; }
  async join(roomIn: string): Promise<void> {
    if (!this.url) { this.h.status('error', 'Укажите адрес сервера Colyseus (ws://… или wss://…)'); throw new Error('nocreds'); }
    try { await loadScript('https://unpkg.com/colyseus.js@0.15.25/dist/colyseus.js', 'Colyseus'); }
    catch { this.h.status('error', 'Colyseus JS не загрузился — проверьте интернет'); throw new Error('cdn'); }
    const C = window.Colyseus as { Client: new (url: string) => { joinOrCreate(r: string, o: object): Promise<never> } };
    const url = /^wss?:\/\//.test(this.url) ? this.url : `wss://${this.url}`;
    const room = (roomIn || 'ferrofront').trim();
    this.roomName = room;
    this.h.status('connecting'); this.h.log(`Стучусь на сервер ${url}…`);
    try {
      const client = new C.Client(url);
      const r = await client.joinOrCreate(room, { ...this.self() }) as unknown as ColyseusAdapter['room'];
      this.room = r;
      r?.onMessage('ff', (m) => this.h.msg(m));
      r?.onMessage('presence', (m) => this.h.peers((m as unknown as { peers?: NetPeer[] }).peers ?? []));
      r?.onLeave(() => { this.h.status('idle'); this.h.log('Отключён от сервера', 'info'); });
      this.h.status('connected'); this.h.log(`Комната «${room}» на сервере открыта`, 'ok');
    } catch {
      this.h.status('error', 'Сервер недоступен. Поднимите его: см. server/README.md');
      throw new Error('connect');
    }
  }
  send(m: NetMsg) { this.room?.send('ff', m); }
  close() { this.room?.leave(); this.room = null; }
}

/* ============ ПРОВАЙДЕР ============ */
interface Snap { status: NetStatus; peers: NetPeer[]; invite: string; error: string; isHost: boolean; log: NetLogEntry[]; }
interface NetCtxValue extends Snap {
  mode: NetMode; cfg: NetConfig;
  setMode: (m: NetMode) => void; saveCfg: (patch: Partial<NetConfig>) => void;
  host: () => Promise<void>; join: (code: string) => Promise<string | void>; accept: (code: string) => Promise<void>;
  chat: (text: string) => void; capture: (hexId: string, zoneName: string) => void;
  reset: () => void;
}
const NetCtx = createContext<NetCtxValue | null>(null);

export function NetProvider({ children, self, onChat, onCapture }: {
  children: React.ReactNode;
  self: { name: string; faction: string; level: number };
  onChat: (m: NetMsg) => void; onCapture: (m: NetMsg) => void;
}) {
  const [cfg, setCfg] = useState<NetConfig>(loadCfg);
  const [snap, setSnap] = useState<Snap>({ status: 'idle', peers: [], invite: '', error: '', isHost: false, log: [] });
  const adapterRef = useRef<NetAdapter | null>(null);
  const selfRef = useRef(self); selfRef.current = self;
  const cbRef = useRef({ onChat, onCapture }); cbRef.current = { onChat, onCapture };
  const peersRef = useRef<NetPeer[]>([]); peersRef.current = snap.peers;
  const isHostRef = useRef(false); isHostRef.current = snap.isHost;

  useEffect(() => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* ignore */ } }, [cfg]);

  const pushLog = (text: string, kind: NetLogEntry['kind'] = 'info') =>
    setSnap((p) => ({ ...p, log: [...p.log, { at: Date.now(), text, kind }].slice(-8) }));

  // обработка входящих (единая для всех транспортов)
  const handleMsg = (m: NetMsg) => {
    const ad = adapterRef.current;
    if (!ad) return;
    if (m.t === 'hello' && m.from) {
      setSnap((p) => ({ ...p, peers: [...p.peers.filter((x) => x.id !== m.from), { id: m.from!, name: m.name ?? 'Командир', faction: m.faction ?? 'azur', level: m.level ?? 1 }] }));
      pushLog(`${m.name ?? 'Командир'} в канале`, 'ok');
      // хост «звезды»: знакомим новичка с остальными
      if (isHostRef.current && !ad.relays && ad.sendTo) {
        ad.sendTo(m.from, { t: 'roster', peers: [{ id: 'host', ...selfRef.current }, ...peersRef.current.filter((x) => x.id !== m.from)] });
      }
      // хост ретранслирует hello другим гостям
      if (isHostRef.current && !ad.relays) ad.send({ ...m });
      return;
    }
    if (m.t === 'roster' && m.peers) {
      setSnap((p) => ({ ...p, peers: m.peers!.filter((x) => x.id !== 'host' && !p.peers.some((y) => y.id === x.id)) }));
      return;
    }
    if (isHostRef.current && !ad.relays && (m.t === 'chat' || m.t === 'capture')) ad.send({ ...m });
    if (m.t === 'chat') cbRef.current.onChat(m);
    if (m.t === 'capture') cbRef.current.onCapture(m);
  };

  const buildAdapter = (mode: NetMode): NetAdapter => {
    const hooks: AdapterHooks = {
      status: (s, err) => setSnap((p) => ({ ...p, status: s, error: err ?? (s === 'error' ? 'Сбой соединения' : p.error), isHost: s === 'hosting' ? true : p.isHost })),
      peers: (peers) => setSnap((p) => ({ ...p, peers })),
      msg: handleMsg,
      log: pushLog,
    };
    switch (mode) {
      case 'peerjs': return new PeerJsAdapter(hooks, () => selfRef.current);
      case 'supabase': return new SupabaseAdapter(hooks, cfg.supabaseUrl, cfg.supabaseKey, () => selfRef.current);
      case 'colyseus': return new ColyseusAdapter(hooks, cfg.colyseusUrl, () => selfRef.current);
      default: return new ManualRtcAdapter(hooks);
    }
  };

  const withAdapter = async <T,>(fn: (ad: NetAdapter) => Promise<T>): Promise<T | undefined> => {
    let ad = adapterRef.current;
    if (!ad) { ad = buildAdapter(cfg.mode); adapterRef.current = ad; }
    try { return await fn(ad); } catch { return undefined; }
  };

  const api: NetCtxValue = {
    ...snap, mode: cfg.mode, cfg,
    setMode: (m) => { if (adapterRef.current) { adapterRef.current.close(); adapterRef.current = null; } setSnap((p) => ({ ...p, status: 'idle', peers: [], invite: '', error: '', isHost: false })); setCfg((c) => ({ ...c, mode: m })); pushLog(`Режим: ${MODE_LABEL[m]}`); },
    saveCfg: (patch) => setCfg((c) => ({ ...c, ...patch })),
    host: () => withAdapter(async (ad) => {
      const code = await ad.host();
      setSnap((p) => ({ ...p, invite: code, isHost: true }));
      return undefined;
    }).then(() => undefined),
    join: (code) => withAdapter((ad) => ad.join(code).then((r) => { setSnap((p) => ({ ...p, invite: typeof r === 'string' ? r : p.invite })); return r; })),
    accept: (code) => withAdapter(async (ad) => { if (ad.accept) await ad.accept(code); }).then(() => undefined),
    chat: (text) => adapterRef.current?.send({ t: 'chat', ...selfRef.current, text, at: Date.now() }),
    capture: (hexId, zoneName) => adapterRef.current?.send({ t: 'capture', ...selfRef.current, hexId, zoneName, at: Date.now() }),
    reset: () => { adapterRef.current?.close(); adapterRef.current = null; setSnap((p) => ({ ...p, status: 'idle', peers: [], invite: '', error: '', isHost: false })); pushLog('Канал закрыт'); },
  };

  return <NetCtx.Provider value={api}>{children}</NetCtx.Provider>;
}

export function useNet() {
  const v = useContext(NetCtx);
  if (!v) throw new Error('NetProvider missing');
  return v;
}
