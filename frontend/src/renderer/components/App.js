import React, { useState, useEffect, useRef } from 'react';
import { Container, Typography, Box, Button, Grid, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import ImageGallery from './ImageGallery';
import useEyeTracker from '../hooks/useEyeTracker';
const { ipcRenderer } = window.require('electron');

function App() {
  const [isInitialScreen, setIsInitialScreen] = useState(true);
  const [imageSets, setImageSets] = useState({});
  const [selectedSet, setSelectedSet] = useState('');
  const [currentImages, setCurrentImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [selectedRegions, setSelectedRegions] = useState({});
  const [saveDirectory, setSaveDirectory] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [stepCount, setStepCount] = useState(0);
  const [isRegionSelectionStep, setIsRegionSelectionStep] = useState(false);
  const [gazeDataBuffer, setGazeDataBuffer] = useState([]);
  const [userActionLog, setUserActionLog] = useState([]);
  const imageGalleryRef = useRef();

  const { gazeData, isConnected, error, startTracking, stopTracking } = useEyeTracker('ws://host.docker.internal:8765');

  useEffect(() => {
    ipcRenderer.invoke('load-image-sets')
      .then(loadedImageSets => {
        setImageSets(loadedImageSets);
        console.log('Loaded image sets:', loadedImageSets);
      })
      .catch(error => {
        console.error('Failed to load image sets:', error);
        alert(`Failed to load image sets. Error: ${error.message}\nPlease check the image_sets folder and the main process logs.`);
      });
  }, []);

  useEffect(() => {
    if (gazeData) {
      setGazeDataBuffer(prev => [...prev, gazeData]);
    }
  }, [gazeData]);

  const logUserAction = (action, details = {}) => {
    const timestamp = gazeData ? gazeData.timestamp : Date.now();
    setUserActionLog(prev => [...prev, { timestamp, action, details }]);
  };

  const createSessionFolder = async () => {
    try {
      const result = await ipcRenderer.invoke('create-session-folder');
      console.log('Created session folder:', result);
      setSessionId(result.sessionId);
      setSaveDirectory(result.directory);
      return result;
    } catch (error) {
      console.error('Error creating session folder:', error);
      alert('Failed to create session folder. Please try again.');
      return null;
    }
  };

  const getRandomImages = (imageSet, count) => {
    const shuffled = [...imageSet].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const handleStartSession = async () => {
    if (!selectedSet) {
      alert('Please select an image set before starting the session.');
      return;
    }
    const sessionResult = await createSessionFolder();
    if (sessionResult) {
      const randomImages = getRandomImages(imageSets[selectedSet], 4);
      setCurrentImages(randomImages);
      setCurrentSetIndex(0);
      setIsInitialScreen(false);
      setIsRegionSelectionStep(false);
      startTracking();
      setGazeDataBuffer([]);
      setStepCount(0);
      setUserActionLog([]);
      logUserAction('SESSION_START', { sessionId: sessionResult.sessionId });
      console.log(`Started session with ID: ${sessionResult.sessionId}`);
      console.log('Current images:', randomImages);
    }
  };

  const handleImageSelect = (image) => {
    setSelectedImage(prevSelected => prevSelected && prevSelected.id === image?.id ? null : image);
    logUserAction('IMAGE_SELECT', { imageId: image.id });
  };

  const handleRegionSelect = (image, region) => {
    setSelectedRegions(prev => ({
      ...prev,
      [image.id]: {
        ...prev[image.id],
        ...region
      }
    }));
    logUserAction('REGION_SELECT', { imageId: image.id, region });
  };

  const saveData = async (isEndSession = false) => {
    const newStepCount = stepCount + 1;
    setStepCount(newStepCount);

    const positions = {
      0: 1, 1: 2, 2: 3, 3: 4
    };

    const convertRegionFormat = (region) => {
      if (!region) return null;
      return {
        topLeft: { x: region.x, y: region.y },
        bottomRight: { x: region.x + region.width, y: region.y + region.height }
      };
    };

    const jsonData = {
      step: newStepCount,
      timestamp: new Date().toISOString(),
      isRegionSelectionStep: isRegionSelectionStep,
      images: currentImages.map((image, index) => ({
        id: image.id,
        src: image.src,
        alt: image.alt,
        position: positions[index],
        isSelected: selectedImage && selectedImage.id === image.id,
        regions: {
          positive: convertRegionFormat(selectedRegions[image.id]?.positive),
          negative: convertRegionFormat(selectedRegions[image.id]?.negative)
        }
      })),
      userActionLog: userActionLog,
      isEndSession: isEndSession
    };

    const csvData = gazeDataBuffer.map(data => 
      `${data.timestamp},${data.left_x},${data.left_y},${data.right_x},${data.right_y}`
    ).join('\n');

    const csvHeader = 'timestamp,left_x,left_y,right_x,right_y\n';

    try {
      const jsonFileName = `${newStepCount}${isEndSession ? '_end' : ''}.json`;
      const csvFileName = `${newStepCount}${isEndSession ? '_end' : ''}.csv`;

      await ipcRenderer.invoke('save-data', saveDirectory, jsonFileName, JSON.stringify(jsonData, null, 2));
      await ipcRenderer.invoke('save-data', saveDirectory, csvFileName, csvHeader + csvData);
      await ipcRenderer.invoke('update-session-info', sessionId, newStepCount);

      console.log('Data saved successfully');

      return true;
    } catch (error) {
      console.error('Failed to save data:', error);
      alert('Failed to save data. Please try again.');
      return false;
    }
  };

  const handleNextStep = async () => {
    if (await saveData()) {
      if (isRegionSelectionStep) {
        // Move to next set of images
        setSelectedImage(null);
        setSelectedRegions({});
        setGazeDataBuffer([]);
        
        const nextSetIndex = (currentSetIndex + 1) % Object.keys(imageSets).length;
        setCurrentSetIndex(nextSetIndex);
        
        const nextSetKey = Object.keys(imageSets)[nextSetIndex];
        const nextImages = getRandomImages(imageSets[nextSetKey], 4);
        setCurrentImages(nextImages);
        setIsRegionSelectionStep(false);
      } else {
        // Move to region selection step
        setIsRegionSelectionStep(true);
      }

      if (imageGalleryRef.current) {
        imageGalleryRef.current.resetSelection();
      }

      logUserAction('NEXT_STEP', { isRegionSelectionStep: !isRegionSelectionStep });
    }
  };

  const handleEndSession = async () => {
    try {
      await saveData(true);
      stopTracking();
      setIsInitialScreen(true);
      setCurrentSetIndex(0);
      setCurrentImages([]);
      setSelectedImage(null);
      setSelectedRegions({});
      setSaveDirectory('');
      setSessionId(null);
      setStepCount(0);
      setGazeDataBuffer([]);
      setSelectedSet('');
      setIsRegionSelectionStep(false);
      setUserActionLog([]);

      if (imageGalleryRef.current) {
        imageGalleryRef.current.resetSelection();
      }

      logUserAction('SESSION_END');
      console.log('Session ended successfully');
    } catch (error) {
      console.error('Error ending session:', error);
      alert('Failed to end session. Please try again.');
    }
  };

  if (isInitialScreen) {
    return (
      <Container maxWidth="sm" style={{ marginTop: '20vh' }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Image Selection System
        </Typography>
        <Box mt={4}>
          <FormControl fullWidth>
            <InputLabel id="image-set-select-label">Select Image Set</InputLabel>
            <Select
              labelId="image-set-select-label"
              value={selectedSet}
              onChange={(e) => setSelectedSet(e.target.value)}
            >
              {Object.keys(imageSets).map((setKey) => (
                <MenuItem key={setKey} value={setKey}>
                  Image Set {setKey}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box mt={4} display="flex" justifyContent="center">
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleStartSession}
            disabled={!selectedSet}
          >
            Start Session
          </Button>
        </Box>
      </Container>
    );
  }
  
  return (
    <Container maxWidth={false} style={{ padding: '1rem', minWidth: '1250px' }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Image Selection System
      </Typography>
      <Typography variant="h6" gutterBottom align="center">
        {isRegionSelectionStep ? "Select Regions" : "Select Preferred Image"}
      </Typography>
      <Box position="relative" minHeight="calc(100vh - 200px)">
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            {currentImages.length > 0 ? (
              <ImageGallery
                ref={imageGalleryRef}
                images={currentImages}
                onImageSelect={handleImageSelect}
                onRegionSelect={handleRegionSelect}
                selectedImage={selectedImage}
                gazeData={gazeData}
                isRegionSelectionStep={isRegionSelectionStep}
                logUserAction={logUserAction}
              />
            ) : (
              <Typography>No images loaded</Typography>
            )}
            <Box mt={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleNextStep}
              >
                Next Step
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box border={1} borderColor="grey.300" p={2} borderRadius={2}>
              <Typography variant="h6" gutterBottom>
                Eye Tracking Data
              </Typography>
              <Typography>
                Connection Status: {isConnected ? 'Connected' : 'Disconnected'}
              </Typography>
              {error && (
                <Typography color="error">
                  Error: {error}
                </Typography>
              )}
              {gazeData && (
                <>
                  <Typography>
                    Left Eye: X: {gazeData.left_x.toFixed(4)}, Y: {gazeData.left_y.toFixed(4)}
                  </Typography>
                  <Typography>
                    Right Eye: X: {gazeData.right_x.toFixed(4)}, Y: {gazeData.right_y.toFixed(4)}
                  </Typography>
                  <Typography>
                    Timestamp: {gazeData.timestamp}
                  </Typography>
                </>
              )}
            </Box>
          </Grid>
        </Grid>
        <Box position="absolute" bottom={16} right={16}>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleEndSession}
          >
            End Session
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

export default App;
