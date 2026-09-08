import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** 复用单例：连接 /realtime 命名空间，握手携带 JWT */
export function getSocket(): Socket {
  if (socket) return socket;
  const token = localStorage.getItem('access_token') || '';
  socket = io('/realtime', {
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
