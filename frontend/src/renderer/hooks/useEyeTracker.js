import { useState, useEffect, useCallback } from 'react';

const useEyeTracker = (url) => {
  const [gazeData, setGazeData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  const connectToEyeTracker = useCallback(() => {
    console.log(`Attempting to connect to eye tracker at ${url}`);
    let socket;

    try {
      socket = new WebSocket(url);
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError(`Failed to create WebSocket: ${err.message}`);
      return () => {};
    }

    socket.onopen = () => {
      console.log('WebSocket connection opened successfully');
      setIsConnected(true);
      setError(null);
    };

    socket.onmessage = (event) => {
      console.log('Received message:', event.data);
      try {
        const data = JSON.parse(event.data, (key, value) => {
          if (value === "NaN") return NaN;
          return value;
        });
        console.log('Parsed gaze data:', data);
        setGazeData(data);
      } catch (err) {
        console.error('Error parsing gaze data:', err);
        setError(`Error parsing gaze data: ${err.message}`);
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket connection closed', event.reason);
      setIsConnected(false);
      setError(`WebSocket connection closed: ${event.reason}`);
      setTimeout(connectToEyeTracker, 5000);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError(`WebSocket error: ${error.message || JSON.stringify(error)}`);
    };

    return () => {
      console.log('Cleaning up WebSocket connection');
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [url]);

  const startTracking = useCallback(() => {
    console.log('Starting eye tracking');
    setIsTracking(true);
    // ここに実際のトラッキング開始ロジックを追加
  }, []);

  const stopTracking = useCallback(() => {
    console.log('Stopping eye tracking');
    setIsTracking(false);
    // ここに実際のトラッキング停止ロジックを追加
  }, []);

  useEffect(() => {
    console.log('Setting up WebSocket connection');
    const cleanup = connectToEyeTracker();
    return () => {
      console.log('Cleaning up effect');
      cleanup();
    };
  }, [connectToEyeTracker]);


  return { gazeData, isConnected, error, startTracking, stopTracking };
};

export default useEyeTracker;
