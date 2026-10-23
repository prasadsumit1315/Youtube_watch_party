import { io, Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://watchparty-server-ids7.onrender.com';

let socket: Socket | null = null;
let currentReconnectToken: string | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function setMemoryReconnectToken(token: string | null): void {
  currentReconnectToken = token;
}

export function getMemoryReconnectToken(): string | null {
  return currentReconnectToken;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentReconnectToken = null;
  }
}
