import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

/*
 * P2P-слой ФЕРРОФРОНТ на нативном WebRTC (RTCPeerConnection).
 * Сигнализация — ручная (vanilla ICE): коды-приглашения передаются игроками
 * через любой мессенджер. Свой сервер не нужен; STUN — публичный (Google).
 * Протокол: JSON по DataChannel. Топология «звезда»: хост ретранслирует
 * сообщения гостям (host-authoritative для общих событий).
 * Продакшен-путь: заменить ручную сигнализацию на WebSocket-сигналайзер
 * (PeerJS Cloud / Supabase Realtime / Colyseus) — интерфейс NetClient не меняется.
 */

export type NetStatus = 'idle' | 'hosting' | 'joining' | 'connected' | 'error';
export interface NetPeer { id: string; name: string; faction: string; level: number; host: boolean; }
export interface NetMsg {
  t: 'hello' | 'welcome' | 'chat' | 'capture' | 'ping' | 'bye';
  from?: string; name?: string; faction?: string; level?: number;
  text?: string; hexId?: string; zoneName?: string; at?: number;
}

const RTC_CFG: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};
const b64e = (s: string) => btoa(unescape(encodeURIComponent(s)));
const b64d = (s: string) => decodeURIComponent(escape(atob(s.trim())));

interface Callbacks { onChat: (m: NetMsg) => void; onCapture: (m: NetMsg) => void; }

export class NetClient {
  peerId: string;
  status: NetStatus = 'idle';
  isHost = false;
  peers: NetPeer[] = [];
  inviteCode = '';
  error = '';
  private conns = new Map<string, RTCPeerConnection>();
  private channels = new Map<string, RTCDataChannel>();
  private cb: Callbacks;
  private onState: () => void;
  private self = { name: 'Командир', faction: 'helios', level: 1 };

  constructor(cb: Callbacks, onState: () => void) {
    this.cb = cb; this.onState = onState;
    this.peerId = Math.random().toString(36).slice(2, 8);
  }

  setSelf(name: string, faction: string, level: number) { this.self = { name, faction, level }; }
  private emit() { this.onState(); }

  private waitIce(pc: RTCPeerConnection): Promise<void> {
    return new Promise((res) => {
      if (pc.iceGatheringState === 'complete') return res();
      const to = setTimeout(res, 2500);
      const check = () => { if (pc.iceGatheringState === 'complete') { clearTimeout(to); res(); } };
      pc.addEventListener('icegatheringstatechange', check);
    });
  }

  private wireChannel(id: string, ch: RTCDataChannel) {
    ch.onopen = () => {
      this.send(id, { t: 'hello', from: this.peerId, ...this.self });
      this.status = 'connected'; this.error = ''; this.emit();
    };
    ch.onmessage = (ev) => {
      let m: NetMsg;
      try { m = JSON.parse(ev.data as string) as NetMsg; } catch { return; }
      if (m.t === 'hello') {
        this.peers = [...this.peers.filter((p) => p.id !== id), { id, name: m.name ?? 'Гость', faction: m.faction ?? 'azur', level: m.level ?? 1, host: false }];
        if (this.isHost) this.relay(id, m);
        this.emit();
      } else if (m.t === 'chat') {
        if (this.isHost) this.relay(id, m);
        this.cb.onChat(m);
      } else if (m.t === 'capture') {
        if (this.isHost) this.relay(id, m);
        this.cb.onCapture(m);
      } else if (m.t === 'bye') {
        this.dropPeer(id);
      }
    };
    ch.onclose = () => this.dropPeer(id);
    this.channels.set(id, ch);
  }

  private wirePc(id: string, pc: RTCPeerConnection) {
    this.conns.set(id, pc);
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      if (st === 'failed' || st === 'closed' || st === 'disconnected') {
        // даём шанс восстановиться, иначе сбрасываем
        setTimeout(() => { if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') this.dropPeer(id); }, 4000);
      }
    };
  }

  private dropPeer(id: string) {
    const p = this.peers.find((x) => x.id === id);
    this.peers = this.peers.filter((x) => x.id !== id);
    this.channels.get(id)?.close();
    this.conns.get(id)?.close();
    this.channels.delete(id); this.conns.delete(id);
    if (this.peers.length === 0 && this.status === 'connected') this.status = this.isHost ? 'hosting' : 'idle';
    void p;
    this.emit();
  }

  private send(id: string, m: NetMsg) {
    const ch = this.channels.get(id);
    if (ch && ch.readyState === 'open') ch.send(JSON.stringify(m));
  }
  private broadcast(m: NetMsg, except?: string) {
    for (const id of this.channels.keys()) if (id !== except) this.send(id, m);
  }
  private relay(fromId: string, m: NetMsg) { this.broadcast(m, fromId); }

  /** Хост: создаёт комнату и код-приглашение (offer+ICE, base64). */
  async createInvite(): Promise<string> {
    this.isHost = true; this.status = 'hosting'; this.error = ''; this.emit();
    const pc = new RTCPeerConnection(RTC_CFG);
    const gid = `g${Math.random().toString(36).slice(2, 7)}`;
    const ch = pc.createDataChannel('ff');
    this.wirePc(gid, pc);
    this.wireChannel(gid, ch);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.waitIce(pc);
    const code = b64e(JSON.stringify({ s: pc.localDescription?.sdp, t: pc.localDescription?.type, g: gid }));
    this.inviteCode = code;
    this.emit();
    return code;
  }

  /** Хост: принимает код-ответ от гостя. */
  async acceptAnswer(code: string): Promise<void> {
    try {
      const { s, t, g } = JSON.parse(b64d(code));
      const pc = this.conns.get(g);
      if (!pc) throw new Error('expired');
      await pc.setRemoteDescription({ type: t, sdp: s });
    } catch {
      this.error = 'Неверный или устаревший код-ответ';
      this.emit();
      throw new Error('bad answer');
    }
  }

  /** Гость: подключается по коду-приглашению, возвращает код-ответ. */
  async join(invite: string): Promise<string> {
    this.isHost = false; this.status = 'joining'; this.error = ''; this.emit();
    try {
      const { s, t, g } = JSON.parse(b64d(invite));
      const pc = new RTCPeerConnection(RTC_CFG);
      const id = g ?? 'host';
      this.wirePc(id, pc);
      pc.ondatachannel = (ev) => this.wireChannel(id, ev.channel);
      await pc.setRemoteDescription({ type: t, sdp: s });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.waitIce(pc);
      return b64e(JSON.stringify({ s: pc.localDescription?.sdp, t: pc.localDescription?.type, g: id }));
    } catch {
      this.status = 'error'; this.error = 'Не удалось прочитать код приглашения';
      this.emit();
      throw new Error('bad invite');
    }
  }

  sendChat(text: string) {
    this.broadcast({ t: 'chat', from: this.peerId, ...this.self, text, at: Date.now() });
  }
  sendCapture(hexId: string, zoneName: string) {
    this.broadcast({ t: 'capture', from: this.peerId, ...this.self, hexId, zoneName, at: Date.now() });
  }

  reset() {
    for (const id of [...this.channels.keys()]) this.send(id, { t: 'bye' });
    for (const c of this.conns.values()) c.close();
    this.conns.clear(); this.channels.clear();
    this.peers = []; this.status = 'idle'; this.inviteCode = ''; this.error = '';
    this.emit();
  }
}

/* ---------- React-обёртка ---------- */
interface NetCtxValue {
  status: NetStatus; peers: NetPeer[]; invite: string; error: string; isHost: boolean;
  host: () => Promise<void>; join: (code: string) => Promise<string>; accept: (code: string) => Promise<void>;
  chat: (text: string) => void; capture: (hexId: string, zoneName: string) => void;
  reset: () => void;
}
const NetCtx = createContext<NetCtxValue | null>(null);

export function NetProvider({ children, self, onChat, onCapture }: {
  children: React.ReactNode;
  self: { name: string; faction: string; level: number };
  onChat: (m: NetMsg) => void; onCapture: (m: NetMsg) => void;
}) {
  const [, force] = useState(0);
  const clientRef = useRef<NetClient | null>(null);
  const cbRef = useRef({ onChat, onCapture }); cbRef.current = { onChat, onCapture };
  if (!clientRef.current) {
    clientRef.current = new NetClient(
      { onChat: (m) => cbRef.current.onChat(m), onCapture: (m) => cbRef.current.onCapture(m) },
      () => force((x) => x + 1),
    );
  }
  const client = clientRef.current;
  useEffect(() => { client.setSelf(self.name, self.faction, self.level); }, [client, self.name, self.faction, self.level]);
  useEffect(() => () => client.reset(), [client]);

  return (
    <NetCtx.Provider value={{
      status: client.status, peers: client.peers, invite: client.inviteCode, error: client.error, isHost: client.isHost,
      host: () => client.createInvite().then(() => undefined),
      join: (code) => client.join(code),
      accept: (code) => client.acceptAnswer(code),
      chat: (t) => client.sendChat(t),
      capture: (h, n) => client.sendCapture(h, n),
      reset: () => client.reset(),
    }}>
      {children}
    </NetCtx.Provider>
  );
}

export function useNet() {
  const v = useContext(NetCtx);
  if (!v) throw new Error('NetProvider missing');
  return v;
}
