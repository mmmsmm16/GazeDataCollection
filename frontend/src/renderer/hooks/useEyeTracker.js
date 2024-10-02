import { useState, useEffect, useCallback, useRef } from 'react';

const useEyeTracker = (url) => {
  const [gazeData, setGazeData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const gazeDataBuffer = useRef([]);
  const lastUpdateTime = useRef(0);
  const socketRef = useRef(null);

  const connectToEyeTracker = useCallback(() => {
    console.log(`Attempting to connect to eye tracker at ${url}`);
    
    try {
      socketRef.current = new WebSocket(url);
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError(`Failed to create WebSocket: ${err.message}`);
      return;
    }

    socketRef.current.onopen = () => {
      console.log('WebSocket connection opened successfully');
      setIsConnected(true);
      setError(null);
    };

    socketRef.current.onmessage = (event) => {
      if (!isTracking) return;
      
      try {
        const sanitizedData = event.data.replace(/"N"/g, '"NaN"');
        const data = JSON.parse(sanitizedData, (key, value) => {
          if (value === "NaN") return NaN;
          if (value === "Infinity") return Infinity;
          if (value === "-Infinity") return -Infinity;
          return value;
        });
        gazeDataBuffer.current.push(data);

        // 60Hzでメインスレッドを更新 (約16.67ms)
        if (Date.now() - lastUpdateTime.current > 16) {
          setGazeData(data);
          lastUpdateTime.current = Date.now();
        }
      } catch (err) {
        console.error('Error parsing gaze data:', err, 'Raw data:', event.data);
      }
    };

    socketRef.current.onclose = (event) => {
      console.log('WebSocket connection closed', event.reason);
      setIsConnected(false);
      setError(`WebSocket connection closed: ${event.reason}`);
      setTimeout(connectToEyeTracker, 5000);
    };

    socketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError(`WebSocket error: ${error.message || JSON.stringify(error)}`);
    };
  }, [url, isTracking]);

  const startTracking = useCallback(() => {
    console.log('Starting eye tracking');
    setIsTracking(true);
    gazeDataBuffer.current = [];
  }, []);

  const stopTracking = useCallback(() => {
    console.log('Stopping eye tracking');
    setIsTracking(false);
  }, []);

  const getGazeDataBuffer = useCallback(() => {
    const buffer = gazeDataBuffer.current;
    gazeDataBuffer.current = [];
    return buffer;
  }, []);

  useEffect(() => {
    connectToEyeTracker();
    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, [connectToEyeTracker]);

  return { gazeData, isConnected, error, startTracking, stopTracking, getGazeDataBuffer };
};

export default useEyeTracker;
