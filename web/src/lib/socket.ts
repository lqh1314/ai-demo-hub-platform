import { io, Socket } from 'socket.io-client';
import { RUNTIME } from './runtime-config';

let socket: Socket | null = null;

/**
 * 复用单例：连接 /realtime 命名空间，握手携带 JWT。
 * 同源部署：wsOrigin 为空，走相对路径；前后端分离：连接到后端 origin 的 /realtime。
 */
export function getSocket(): Socket {
  if (socket) return socket;
  const token = localStorage.getItem('access_token') || '';
  const namespace = RUNTIME.wsOrigin ? `${RUNTIME.wsOrigin}/realtime` : '/realtime';
  socket = io(namespace, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 2000,
  });
  return socket;
}

export function resetSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
