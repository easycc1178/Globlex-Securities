import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './use-auth';

type WebSocketMessage = {
  type: string;
  data?: any;
  messageId?: number;
  status?: string;
  message?: string;
  userId?: number;
  users?: number[];
};

export function useWebSocket() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create WebSocket connection
  const connect = useCallback(() => {
    if (!user) return;

    try {
      // Clean up previous connection if exists
      if (socketRef.current) {
        socketRef.current.close();
      }

      // Get our API server URL for WebSocket connection
      // Important: avoid conflicts with Vite's WebSocket by using our own path
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/client`;
      
      console.log('Connecting to WebSocket URL:', wsUrl);
      
      // Handle errors by wrapping WebSocket creation
      let socket: WebSocket | null = null;
      try {
        socket = new WebSocket(wsUrl);
        socketRef.current = socket;
      } catch (wsError) {
        console.error('Failed to create WebSocket connection:', wsError);
        setIsConnected(false);
        setError('Failed to create WebSocket connection. Will retry later.');
        
        // Schedule a reconnection attempt
        setTimeout(() => {
          connect();
        }, 5000);
        return;
      }

      socket.onopen = () => {
        setIsConnected(true);
        setError(null);
        console.log('WebSocket connection successful');

        // Send authentication message with user ID
        const authMessage: WebSocketMessage = {
          type: 'auth',
          userId: user.id
        };

        socket.send(JSON.stringify(authMessage));
      };

      socket.onclose = (event) => {
        setIsConnected(false);

        // If not a normal closure (code 1000), attempt to reconnect
        if (event.code !== 1000) {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000); // Try to reconnect after 3 seconds
        }
      };

      socket.onerror = (event) => {
        console.error('WebSocket error:', event);
        setIsConnected(false);
        setError('Connection error occurred');
      };
    } catch (err) {
      setError('Failed to establish WebSocket connection');
      console.error('WebSocket connection error:', err);
    }
  }, [user]);

  // Send a message
  const sendMessage = useCallback((messageData: WebSocketMessage) => {
    if (socketRef.current && isConnected) {
      socketRef.current.send(JSON.stringify(messageData));
      return true;
    }
    return false;
  }, [isConnected]);

  // Add a message listener
  const addMessageListener = useCallback((callback: (data: any) => void) => {
    if (socketRef.current) {
      const messageHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          callback(data);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      socketRef.current.addEventListener('message', messageHandler);

      // Return function to remove the listener
      return () => {
        if (socketRef.current) {
          socketRef.current.removeEventListener('message', messageHandler);
        }
      };
    }

    // If no socket, return a no-op cleanup function
    return () => {};
  }, []);

  // Connect when user is available - with safety checks
  useEffect(() => {
    // Wrap in a try-catch to prevent DOMException errors
    try {
      // Only connect if we're in the main application UI and have a user
      // Avoid connecting when in HMR, development modes, or in iframe/embedded contexts
      const shouldConnect = user && 
                          // Only try to connect in safe contexts
                          typeof window !== 'undefined' && 
                          // Make sure we're not in the Eruda debugger or other risky contexts
                          !window.location.href.includes('/__replco') &&
                          !window.location.href.includes('/devtools/');

      if (shouldConnect) {
        console.log('Safe context detected, attempting WebSocket connection');
        
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          try {
            connect();
          } catch (connectErr) {
            console.error('Failed to connect from RAF:', connectErr);
          }
        });
      } else {
        console.log('Skipping WebSocket connection in this context');
      }
    } catch (err) {
      console.error('Error during WebSocket connection setup:', err);
    }

    // Cleanup on unmount
    return () => {
      try {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        if (socketRef.current) {
          try {
            socketRef.current.close(1000, 'Component unmounted');
          } catch (closeErr) {
            console.error('Error closing WebSocket:', closeErr);
          }
        }
      } catch (err) {
        console.error('Error during WebSocket cleanup:', err);
      }
    };
  }, [user, connect]);

  return {
    isConnected,
    error,
    sendMessage,
    addMessageListener,
    connect,
  };
}