import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type SpreadsData = {
  callSpread: {
    maxProfit: number;
    maxLoss: number;
    creditOrDebit: number;
    breakEven: number;
  };
  putSpread: {
    maxProfit: number;
    maxLoss: number;
    creditOrDebit: number;
    breakEven: number;
  };
};

export function useWebSocket() {
  const [spreadsData, setSpreadsData] = useState<SpreadsData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = () => {
    try {
      // Use the Hono RPC client to get the WebSocket URL
      const wsUrl = new URL('/api/ws', window.location.href);
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';

      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        console.log('WebSocket connected');
      });

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data) as SpreadsData;
          setSpreadsData(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          toast.error('Failed to parse WebSocket message');
        }
      });

      ws.addEventListener('close', () => {
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect with exponential backoff
        const maxAttempts = 5;
        const baseDelay = 1000; // 1 second

        if (reconnectAttemptsRef.current < maxAttempts) {
          const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Attempting to reconnect (attempt ${reconnectAttemptsRef.current}/${maxAttempts})`);
            connect();
          }, delay);
        } else {
          toast.error('WebSocket connection lost. Please refresh the page.');
        }
      });

      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        toast.error('WebSocket connection error');
        setIsConnected(false);
      });
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      toast.error('Failed to create WebSocket connection');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setSpreadsData(null);
  };

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, []);

  return {
    spreadsData,
    isConnected,
    connect,
    disconnect,
  };
}
