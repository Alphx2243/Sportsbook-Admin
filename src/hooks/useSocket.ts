import { useSocket as useSocketContext } from '@/contexts/SocketContext';
import { useEffect } from 'react';

export const useSocket = (sportName?: string, onUpdate?: (data: any) => void, eventType: string = 'availability_changed') => {
  const { socket, isConnected } = useSocketContext();

  useEffect(() => {
    if (socket && isConnected && sportName) {
      console.log(`Emitting join_sport for: ${sportName}`);
      socket.emit('join_sport', sportName);

      if (onUpdate) {
        const wrappedUpdate = (data: any) => {
          console.log(`Received ${eventType} for ${sportName}:`, data);
          onUpdate(data);
        };
        socket.on(eventType, wrappedUpdate);
        return () => {
          console.log(`Cleaning up socket listener for ${sportName} (${eventType})`);
          socket.off(eventType, wrappedUpdate);
        };
      }
    };
  }, [socket, isConnected, sportName, onUpdate, eventType]);

  return { socket, isConnected };
};
