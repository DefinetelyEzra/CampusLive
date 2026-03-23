import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface SocketStore {
    socket: Socket | null;
    isConnected: boolean;
    isConnecting: boolean;
    connectSocket: () => void;
    disconnectSocket: () => void;
}

export const useSocketStore = create<SocketStore>((set, get) => ({
    socket: null,
    isConnected: false,
    isConnecting: false,

    connectSocket: () => {
        const { socket, isConnected, isConnecting } = get();

        if (socket && isConnected) {
            console.log('Socket already connected');
            return;
        }

        if (isConnecting) {
            console.log('Socket connection already in progress');
            return;
        }

        const token = localStorage.getItem('token') || localStorage.getItem('campusLive_token');
        if (!token) {
            console.log('No token found for socket connection');
            return;
        }

        set({ isConnecting: true });
        console.log('Connecting socket with token...');

        const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

        const newSocket = io(socketUrl, {
            auth: { token },
            transports: ['polling', 'websocket'],
            timeout: 20000,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            autoConnect: true,
        });

        newSocket.on('connect', () => {
            console.log('Socket connected successfully:', newSocket.id);
            set({
                socket: newSocket,
                isConnected: true,
                isConnecting: false
            });
        });

        newSocket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            set({ isConnected: false, isConnecting: false });
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            set({ isConnected: false, isConnecting: false });

            // Clean up failed connection
            setTimeout(() => {
                if (!get().isConnected && newSocket) {
                    newSocket.disconnect();
                }
            }, 5000);
        });

        // Set socket immediately but mark as connecting
        set({ socket: newSocket });
    },

    disconnectSocket: () => {
        const { socket } = get();
        if (socket) {
            console.log('Disconnecting socket...');
            socket.disconnect();
            set({ socket: null, isConnected: false, isConnecting: false });
        }
    }
}));