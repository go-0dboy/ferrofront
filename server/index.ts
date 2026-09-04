/*
 * ФЕРРОФРОНТ — авторитативный сервер Colyseus (транспорт №4 сетевого слоя).
 * НЕ входит в клиентскую сборку Vite. Запускается отдельным процессом.
 *
 *   cd server && npm init -y
 *   npm i colyseus @colyseus/ws-transport
 *   npx tsx index.ts          (или скомпилировать tsc и node index.js)
 *
 * Клиент игры подключается: Альянс → Комм-центр → COLYSEUS → ws://<ваш-ip>:2567
 */
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import { FerrofrontRoom } from './ferrofront-room';

const port = Number(process.env.PORT ?? 2567);
const server = new Server({ transport: new WebSocketTransport({ server: createServer() }) });

server.define('ferrofront', FerrofrontRoom);
server.listen(port);
console.log(`[ferrofront] Colyseus слушает ws://0.0.0.0:${port}, комната "ferrofront"`);
