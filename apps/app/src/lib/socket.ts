import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../stores/auth.store";

const SOCKET_URL: string = import.meta.env["VITE_API_URL"] ?? "/";

let socket: Socket | null = null;

function getSocket(): Socket {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: (callback) => callback({ token: useAuthStore.getState().accessToken }),
  });

  return socket;
}

export function connectSocket(restaurantId: string, deviceId?: string): Socket {
  const instance = getSocket();
  if (!instance.connected) {
    instance.connect();
  }
  instance.emit("subscribe:restaurant", { restaurantId, deviceId });
  return instance;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
