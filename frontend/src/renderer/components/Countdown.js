import React, { useState, useEffect } from 'react';
import { Typography, Box } from '@mui/material';

const Countdown = ({ onComplete }) => {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count > 0) {
      const timer = setTimeout(() => setCount(count - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      onComplete();
    }
  }, [count, onComplete]);

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
