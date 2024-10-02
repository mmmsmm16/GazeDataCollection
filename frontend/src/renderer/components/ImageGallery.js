import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Card, CardMedia, Button, Box, ButtonGroup } from '@mui/material';

const ImageGallery = forwardRef(({ 
  images, 
  onImageSelect, 
  onRegionSelect, 
  selectedImage, 
  gazeData, 
  isRegionSelectionStep,
  logUserAction,
  onNextStep,
  showNextStepButton = true // 新しいプロパティを追加
}, ref) => {
  const [selectingRegion, setSelectingRegion] = useState(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState({});
  const [selectionMode, setSelectionMode] = useState('positive');
  const imageRefs = useRef({});
  const drawingLayerRefs = useRef({});

  useImperativeHandle(ref, () => ({
    resetSelection: () => {
      setSelectedRegions({});
    }
  }));

  const handleMouseDown = (image, e) => {
    if (!isRegionSelectionStep) return;
    const rect = imageRefs.current[image.id].getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setCurrentPos({ x, y });
    setSelectingRegion(image.id);
    setIsDrawing(true);
    logUserAction('REGION_SELECTION_START', { imageId: image.id, x, y });
  };

  const handleMouseMove = (image, e) => {
    if (!isDrawing || selectingRegion !== image.id) return;
    const rect = imageRefs.current[image.id].getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentPos({ x, y });
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const selectedImage = images.find(img => img.id === selectingRegion);
      if (selectedImage) {
        const newRegion = {
          x: Math.min(startPos.x, currentPos.x),
          y: Math.min(startPos.y, currentPos.y),
          width: Math.abs(currentPos.x - startPos.x),
          height: Math.abs(currentPos.y - startPos.y)
        };
        setSelectedRegions(prev => ({
          ...prev,
          [selectedImage.id]: {
            ...prev[selectedImage.id],
            [selectionMode]: newRegion
          }
        }));
        onRegionSelect(selectedImage, { [selectionMode]: newRegion });
        logUserAction('REGION_SELECTION_END', { imageId: selectedImage.id, region: newRegion, mode: selectionMode });
      }
    }
  };

  const handleSelectToggle = (image) => {
    onImageSelect(selectedImage && selectedImage.id === image.id ? null : image);
    logUserAction('IMAGE_SELECT_TOGGLE', { imageId: image.id, selected: !(selectedImage && selectedImage.id === image.id) });
  };

  const handleSelectionModeChange = (mode) => {
    setSelectionMode(mode);
    logUserAction('SELECTION_MODE_CHANGE', { mode });
  };

  const handleRegionDelete = (imageId) => {
    setSelectedRegions(prev => {
      const newRegions = { ...prev };
      delete newRegions[imageId];
      return newRegions;
    });
    onRegionSelect({ id: imageId }, null);
    logUserAction('REGION_DELETE', { imageId });
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDrawing) {
        handleMouseUp();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDrawing, handleMouseUp]);

  const renderButtons = (image, index) => (
    <Box 
      display="flex" 
      flexDirection="column" 
      justifyContent="center"
      height="512px"
      width="120px"
    >
      {!isRegionSelectionStep && (
        <Button
          variant={selectedImage && selectedImage.id === image.id ? "contained" : "outlined"}
          onClick={() => handleSelectToggle(image)}
          style={{ width: '100%' }}
        >
          {selectedImage && selectedImage.id === image.id ? "Selected" : "Select"}
        </Button>
      )}
      {isRegionSelectionStep && (
        <>
          <ButtonGroup orientation="vertical" style={{ width: '100%' }}>
            <Button
              onClick={() => handleSelectionModeChange('positive')}
              variant={selectionMode === 'positive' ? "contained" : "outlined"}
              style={{ width: '100%' }}
            >
              Positive
            </Button>
            <Button
              onClick={() => handleSelectionModeChange('negative')}
              variant={selectionMode === 'negative' ? "contained" : "outlined"}
              style={{ width: '100%' }}
            >
              Negative
            </Button>
          </ButtonGroup>
          <Button
            onClick={() => handleRegionDelete(image.id)}
            variant="outlined"
            color="secondary"
            style={{ width: '100%', marginTop: '8px' }}
          >
            Delete Region
          </Button>
        </>
      )}
    </Box>
  );


  const renderRegion = (imageId, region, type) => {
    if (!region) return null;
    return (
      <Box
        position="absolute"
        sx={{
          border: '2px solid',
          borderColor: type === 'positive' ? 'green' : 'red',
          backgroundColor: type === 'positive' ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)',
          left: `${region.x}px`,
          top: `${region.y}px`,
          width: `${region.width}px`,
          height: `${region.height}px`,
          pointerEvents: 'none',
        }}
      />
    );
  };

  const renderImageWithButtons = (image, index) => (
    <Box 
      key={image.id} 
      sx={{
        display: 'flex', 
        flexDirection: 'row',
        alignItems: 'center', 
        justifyContent: 'center',
        width: '100%',
        height: '100%'
      }}
    >
      {index % 2 === 0 && (
        <Box width="120px" mr="8px" height="512px">
          {renderButtons(image, index)}
        </Box>
      )}
      <Card 
        sx={{ 
          width: 512, 
          height: 512, 
          position: 'relative',
          boxShadow: 'none',
          borderRadius: 0,
          overflow: 'visible',
        }}
      >
        <CardMedia
          component="img"
          image={image.src}
          alt={image.alt}
          ref={(el) => imageRefs.current[image.id] = el}
          sx={{
            cursor: isRegionSelectionStep ? 'crosshair' : 'default',
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
        <Box
          ref={(el) => drawingLayerRefs.current[image.id] = el}
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          onMouseDown={(e) => handleMouseDown(image, e)}
          onMouseMove={(e) => handleMouseMove(image, e)}
          sx={{ pointerEvents: isRegionSelectionStep ? 'auto' : 'none' }}
        />
        {isDrawing && selectingRegion === image.id && (
          <Box
            position="absolute"
            sx={{
              border: '2px solid',
              borderColor: selectionMode === 'positive' ? 'green' : 'red',
              backgroundColor: selectionMode === 'positive' ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)',
              left: `${Math.min(startPos.x, currentPos.x)}px`,
              top: `${Math.min(startPos.y, currentPos.y)}px`,
              width: `${Math.abs(currentPos.x - startPos.x)}px`,
              height: `${Math.abs(currentPos.y - startPos.y)}px`,
              pointerEvents: 'none',
            }}
          />
        )}
        {selectedRegions[image.id] && renderRegion(image.id, selectedRegions[image.id].positive, 'positive')}
        {selectedRegions[image.id] && renderRegion(image.id, selectedRegions[image.id].negative, 'negative')}
        {gazeData && selectedImage && selectedImage.id === image.id && (
          <Box
            position="absolute"
            sx={{
              left: `${gazeData.x * 512}px`,
              top: `${gazeData.y * 512}px`,
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: 'blue',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          />
        )}
      </Card>
      {index % 2 === 1 && (
        <Box width="120px" ml="8px" height="512px">
          {renderButtons(image, index)}
        </Box>
      )}
    </Box>
  );

  return (
    <Box 
      sx={{ 
        width: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <Box 
        sx={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '32px',
          width: (512 + 120) * 2 + 32,
          height: 512 * 2 + 32,
        }}
      >
        {images.map((image, index) => renderImageWithButtons(image, index))}
      </Box>
      {/* NEXT STEPボタンをここから削除 */}
    </Box>
  );
});
export default ImageGallery;
