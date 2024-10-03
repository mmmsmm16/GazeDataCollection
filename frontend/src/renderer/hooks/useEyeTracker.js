import { useState, useEffect, useCallback, useRef } from 'react';

const useEyeTracker = (url) => {
  const [gazeData, setGazeData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const gazeDataBuffer = useRef([]);
  const lastUpdateTime = useRef(0);
  const socketRef = useRef(null);
  const isTrackingRef = useRef(false);

  const connectToEyeTracker = useCallback(() => {
    console.log(`[${new Date().toISOString()}] Attempting to connect to eye tracker at ${url}`);
    
    try {
      socketRef.current = new WebSocket(url);
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError(`Failed to create WebSocket: ${err.message}`);
      return;
    }

    socketRef.current.onopen = () => {
      console.log(`[${new Date().toISOString()}] WebSocket connection opened successfully`);
      setIsConnected(true);
      setError(null);
    };

    socketRef.current.onmessage = (event) => {
      if (!isTrackingRef.current) {
        return;
      }
      
      try {
        const sanitizedData = event.data.replace(/"N"/g, '"NaN"');
        const data = JSON.parse(sanitizedData, (key, value) => {
          if (value === "NaN") return NaN;
          if (value === "Infinity") return Infinity;
          if (value === "-Infinity") return -Infinity;
          return value;
        });
        gazeDataBuffer.current.push(data);

        // UIの更新は60Hzに制限（約16.67ms）
        if (Date.now() - lastUpdateTime.current > 16) {
          setGazeData(data);
          lastUpdateTime.current = Date.now();
        }
      } catch (err) {
        console.error('Error parsing gaze data:', err, 'Raw data:', event.data);
      }
    };

    socketRef.current.onclose = (event) => {
      console.log(`[${new Date().toISOString()}] WebSocket connection closed`, event.reason);
      setIsConnected(false);
      setError(`WebSocket connection closed: ${event.reason}`);
      setTimeout(connectToEyeTracker, 5000);
    };

    socketRef.current.onerror = (error) => {
      console.error(`[${new Date().toISOString()}] WebSocket error:`, error);
      setError(`WebSocket error: ${error.message || JSON.stringify(error)}`);
    };
  }, [url]);

  const startTracking = useCallback(() => {
    const startTime = new Date().toISOString();
    console.log(`[${startTime}] Starting eye tracking`);
    isTrackingRef.current = true;
    setIsTracking(true);
    gazeDataBuffer.current = [];
    console.log(`[${new Date().toISOString()}] Eye tracking started successfully. isTracking:`, isTrackingRef.current);
  }, []);

  const stopTracking = useCallback(() => {
    const stopTime = new Date().toISOString();
    console.log(`[${stopTime}] Stopping eye tracking`);
    isTrackingRef.current = false;
    setIsTracking(false);
    console.log(`Collected ${gazeDataBuffer.current.length} gaze data points. isTracking:`, isTrackingRef.current);
  }, []);

  const getGazeDataBuffer = useCallback(() => {
    const bufferSize = gazeDataBuffer.current.length;
    console.log(`[${new Date().toISOString()}] Retrieving gaze data buffer with ${bufferSize} points`);
    if (bufferSize === 0) {
      console.warn('Gaze data buffer is empty');
    } else {
      console.log('First data point:', JSON.stringify(gazeDataBuffer.current[0]));
      console.log('Last data point:', JSON.stringify(gazeDataBuffer.current[bufferSize - 1]));
    }
    const buffer = gazeDataBuffer.current;
    gazeDataBuffer.current = [];
    return buffer;
  }, []);

  useEffect(() => {
    console.log(`[${new Date().toISOString()}] Setting up WebSocket connection`);
    connectToEyeTracker();
    return () => {
      console.log(`[${new Date().toISOString()}] Cleaning up effect`);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      stopTracking();
    };
  }, [connectToEyeTracker, stopTracking]);

  useEffect(() => {
    console.log(`[${new Date().toISOString()}] isTracking state changed:`, isTracking);
  }, [isTracking]);

  return { gazeData, isConnected, error, startTracking, stopTracking, getGazeDataBuffer };
};

export default useEyeTracker;
