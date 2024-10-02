import { useState, useEffect, useCallback } from 'react';

const useEyeTracker = () => {
  const [gazeData, setGazeData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const connectToEyeTracker = useCallback(() => {
    console.log('Attempting to connect to eye tracker');
    const socket = new WebSocket('ws://localhost:8765');

    socket.onopen = () => {
      console.log('WebSocket connection opened');
      setIsConnected(true);
      setError(null);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received gaze data:', data);
      setGazeData(data);
    };

    socket.onclose = (event) => {
      console.log('WebSocket connection closed', event);
      setIsConnected(false);
      setError('WebSocket connection closed');
      // Attempt to reconnect after 5 seconds
      setTimeout(connectToEyeTracker, 5000);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket error occurred');
    };

    return () => {
      console.log('Cleaning up WebSocket connection');
      socket.close();
    };
  }, []);

  useEffect(() => {
    console.log('Setting up WebSocket connection');
    const cleanup = connectToEyeTracker();
    return () => {
      console.log('Cleaning up effect');
      cleanup();
    };
  }, [connectToEyeTracker]);

  return { gazeData, isConnected, error, reconnect: connectToEyeTracker };
};

export default useEyeTracker;
