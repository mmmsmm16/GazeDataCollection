import React, { useState, useEffect, useRef } from 'react';
import { Typography, Box } from '@mui/material';

const Countdown = ({ onComplete }) => {
  const [count, setCount] = useState(3);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    startTimeRef.current = Date.now();
    
    const updateTimer = () => {
      const elapsedTime = Date.now() - startTimeRef.current;
      const newCount = 3 - Math.floor(elapsedTime / 1000);
      
      if (newCount <= 0) {
        setCount(0);
        onComplete();
      } else {
        setCount(newCount);
        timerRef.current = requestAnimationFrame(updateTimer);
      }
    };

    timerRef.current = requestAnimationFrame(updateTimer);

    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, [onComplete]);

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      height="100vh"
      width="100vw"
      position="fixed"
      top={0}
      left={0}
      zIndex={9999}
      bgcolor="rgba(0, 0, 0, 0.7)"
    >
      <Typography variant="h1" color="white">
        {count === 0 ? 'Start!' : count}
      </Typography>
    </Box>
  );
};

export default Countdown;
