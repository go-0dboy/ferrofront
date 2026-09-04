/*
 * Комната «ferrofront»: авторитативный релей событий + presence.
 * Протокол совпадает с клиентским NetMsg (t: hello|chat|capture|bye).
 * Здесь же — точка расширения: валидация захватов, античит скоростей,
 * персистентность в БД (Supabase/Postgres) на onMessage('capture').
 */
import { Room, Client } from 'colyseus';

interface PlayerMeta { name: string; faction: string; level: number; }

export class FerrofrontRoom extends Room {
  maxClients = 16;

  onJoin(client: Client, options: Partial<PlayerMeta>) {
    (client as Client & { meta?: PlayerMeta }).meta = {
      name: options?.name ?? 'Командир',
      faction: options?.faction ?? 'helios',
      level: options?.level ?? 1,
    };
    this.broadcastPeers();
    // объявляем новичка всем (клиенты добавят его в список и увидят приветствие)
    this.broadcast('ff', { t: 'hello', from: client.sessionId, ...(client as Client & { meta: PlayerMeta }).meta, at: Date.now() });
  }

  onMessage(client: Client, type: string, message: unknown) {
    if (type !== 'ff') return;
    const m = message as { t?: string; hexId?: string; from?: string };
    // Место для серверной валидации:
    // if (m.t === 'capture') { проверить кулдаун зоны, силу гарнизона, записать в БД }
    if (m.from !== client.sessionId) m.from = client.sessionId; // подмена отправителя невозможна
    this.broadcast('ff', m);
  }

  onLeave(client: Client) {
    this.broadcastPeers();
  }

  private broadcastPeers() {
    const peers = this.clients.map((c) => {
      const meta = (c as Client & { meta?: PlayerMeta }).meta ?? { name: 'Командир', faction: 'helios', level: 1 };
      return { id: c.sessionId, ...meta };
    });
    this.broadcast('presence', { peers });
  }
}
