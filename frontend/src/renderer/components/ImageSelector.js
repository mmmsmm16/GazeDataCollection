import React, { useState, useRef } from 'react';
import { Paper } from '@mui/material';

const ImageSelector = ({ image, onRegionSelect }) => {
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [endPos, setEndPos] = useState({ x: 0, y: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const imageRef = useRef(null);

  const handleMouseDown = (e) => {
    const { offsetX, offsetY } = e.nativeEvent;
    setStartPos({ x: offsetX, y: offsetY });
    setEndPos({ x: offsetX, y: offsetY });
    setIsSelecting(true);
  };

  const handleMouseMove = (e) => {
    if (!isSelecting) return;
    const { offsetX, offsetY } = e.nativeEvent;
    setEndPos({ x: offsetX, y: offsetY });
  };

  const handleMouseUp = () => {
    if (!isSelecting) return;
    setIsSelecting(false);
    if (onRegionSelect) {
      onRegionSelect({
        x: Math.min(startPos.x, endPos.x),
        y: Math.min(startPos.y, endPos.y),
        width: Math.abs(endPos.x - startPos.x),
        height: Math.abs(endPos.y - startPos.y),
      });
    }
  };

  return (
    <Paper elevation={3} style={{ position: 'relative', display: 'inline-block' }}>
      <img 
        ref={imageRef} 
        src={image.src} 
        alt={image.alt} 
        style={{ width: '512px', height: '512px' }} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      {isSelecting && (
        <div
          style={{
            position: 'absolute',
            border: '2px solid red',
            left: Math.min(startPos.x, endPos.x),
            top: Math.min(startPos.y, endPos.y),
            width: Math.abs(endPos.x - startPos.x),
            height: Math.abs(endPos.y - startPos.y),
          }}
        />
      )}
    </Paper>
  );
};

export default ImageSelector;
