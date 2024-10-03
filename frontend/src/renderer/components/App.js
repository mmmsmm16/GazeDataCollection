import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Button, 
  FormControl, 
  InputLabel,
  Select,
  MenuItem,
  TextField
} from '@mui/material';
import ImageGallery from './ImageGallery';
import Countdown from './Countdown';
import useEyeTracker from '../hooks/useEyeTracker';
const { ipcRenderer } = window.require('electron');

function App() {
  const [isInitialScreen, setIsInitialScreen] = useState(true);
  const [imageSets, setImageSets] = useState({});
  const [selectedSet, setSelectedSet] = useState('');
  const [userType, setUserType] = useState('host');
  const [totalSteps, setTotalSteps] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [currentSubStep, setCurrentSubStep] = useState(1);
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
  const [showCountdown, setShowCountdown] = useState(false);
  const [isDataCollectionActive, setIsDataCollectionActive] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const { 
    gazeData, 
    isConnected, 
    error, 
    startTracking, 
    stopTracking, 
    getGazeDataBuffer 
  } = useEyeTracker('ws://host.docker.internal:8765');

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

  useEffect(() => {
    const interval = setInterval(() => {
      console.log(`[${new Date().toISOString()}] App is still running. Memory usage: ${process.memoryUsage().heapUsed / 1024 / 1024} MB`);
    }, 5000);
  
    return () => clearInterval(interval);
  }, []);

  const logUserAction = (action, details = {}) => {
    const timestamp = gazeData ? gazeData.timestamp : Date.now();
    setUserActionLog(prev => [...prev, { timestamp, action, details }]);
  };

  const createSessionFolder = async () => {
    try {
      const result = await ipcRenderer.invoke('create-session-folder', userType);
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
    if (!selectedSet || !userType || !totalSteps) {
      alert('Please select an image set, user type, and set the total steps before starting the session.');
      return;
    }
    const sessionResult = await createSessionFolder();
    if (sessionResult) {
      const randomImages = getRandomImages(imageSets[selectedSet], 4);
      stopTracking();
      console.log(`[${new Date().toISOString()}] Gaze tracking stopped before countdown`);
      setGazeDataBuffer([]);
      setUserActionLog([]);
      
      setCurrentImages(randomImages);
      setCurrentSetIndex(0);
      setIsInitialScreen(false);
      setIsRegionSelectionStep(false);
      setStepCount(0);
      
      logUserAction('SESSION_START', { sessionId: sessionResult.sessionId, userType, totalSteps });
      console.log(`Started session with ID: ${sessionResult.sessionId}`);
      console.log('Current images:', randomImages);
      
      // 状態更新が完了した後にカウントダウンを開始
      setTimeout(() => {
        setShowCountdown(true);
        setShowImages(false);
      }, 0);
    }
  };

  const handleCountdownComplete = () => {
    try {
      console.log(`[${new Date().toISOString()}] Countdown completed`);
      setShowCountdown(false);
      setShowImages(true);
      console.log(`[${new Date().toISOString()}] Starting tracking after countdown`);
      startTracking();
      setIsDataCollectionActive(true);
      console.log(`[${new Date().toISOString()}] Data collection active set to true`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error in handleCountdownComplete:`, error);
      alert(`An error occurred: ${error.message}`);
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
    console.log(`[${new Date().toISOString()}] Saving data`);
    const gazeDataBufferContent = getGazeDataBuffer();
    console.log(`Retrieved ${gazeDataBufferContent.length} gaze data points`);
    
    if (gazeDataBufferContent.length === 0) {
      console.warn('No gaze data to save. Buffer is empty.');
      return false;
    }
  
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
      step: currentStep,
      subStep: currentSubStep,
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
  
    const csvData = gazeDataBufferContent.map(data => {
      const line = `${data.timestamp},${isNaN(data.left_x) ? 'N' : data.left_x},${isNaN(data.left_y) ? 'N' : data.left_y},${isNaN(data.right_x) ? 'N' : data.right_x},${isNaN(data.right_y) ? 'N' : data.right_y}`;
      console.log(`CSV line: ${line}`);
      return line;
    }).join('\n');
  
    console.log(`CSV data length: ${csvData.length} characters`);
  
    try {
      const jsonFileName = `${currentStep}_${currentSubStep}.json`;
      console.log(`Saving JSON file: ${jsonFileName}`);
      await ipcRenderer.invoke('save-data', saveDirectory, jsonFileName, JSON.stringify(jsonData, null, 2));
  
      if (gazeDataBufferContent.length > 0) {
        const csvFileName = `${currentStep}_${currentSubStep}.csv`;
        const csvHeader = 'timestamp,left_x,left_y,right_x,right_y\n';
        const csvData = gazeDataBufferContent.map(data => 
          `${data.timestamp},${isNaN(data.left_x) ? 'N' : data.left_x},${isNaN(data.left_y) ? 'N' : data.left_y},${isNaN(data.right_x) ? 'N' : data.right_x},${isNaN(data.right_y) ? 'N' : data.right_y}`
        ).join('\n');
  
        console.log(`Saving CSV file: ${csvFileName}`);
        await ipcRenderer.invoke('save-data', saveDirectory, csvFileName, csvHeader + csvData);
      } else {
        console.log('No gaze data to save in CSV format');
      }
  
      console.log(`Updating session info: sessionId=${sessionId}, currentStep=${currentStep}`);
      await ipcRenderer.invoke('update-session-info', userType, sessionId, currentStep);
  
      console.log('Data saved successfully');
      return true;
    } catch (error) {
      console.error('Failed to save data:', error);
      alert(`Failed to save data. Error: ${error.message}`);
      return false;
    }
  };

  const handleNextStep = async () => {
    console.log(`[${new Date().toISOString()}] Next step initiated`);
    setIsDataCollectionActive(false);
    console.log(`[${new Date().toISOString()}] Data collection active set to false`);
    stopTracking();
    console.log(`[${new Date().toISOString()}] Gaze tracking stopped at next step`);  

    if (await saveData()) {
      if (currentSubStep === 2) {
        // Both sub-steps are completed, move to next main step
        if (currentStep >= parseInt(totalSteps)) {
          handleEndSession();
          return;
        }
        setCurrentStep(prevStep => prevStep + 1);
        setCurrentSubStep(1);
        setIsRegionSelectionStep(false);
        
        const nextSetIndex = (currentSetIndex + 1) % Object.keys(imageSets).length;
        setCurrentSetIndex(nextSetIndex);
        
        const nextSetKey = Object.keys(imageSets)[nextSetIndex];
        const nextImages = getRandomImages(imageSets[nextSetKey], 4);
        setCurrentImages(nextImages);
      } else {
        // Move to region selection step
        setCurrentSubStep(2);
        setIsRegionSelectionStep(true);
      }

      setSelectedImage(null);
      setSelectedRegions({});
      setGazeDataBuffer([]);

      if (imageGalleryRef.current) {
        imageGalleryRef.current.resetSelection();
      }

      setShowCountdown(true);
      setShowImages(false);
      console.log(`[${new Date().toISOString()}] Preparing for next countdown`);
      logUserAction('NEXT_STEP', { 
        currentStep: currentStep, 
        currentSubStep: currentSubStep === 2 ? 1 : 2,
        isRegionSelectionStep: currentSubStep === 1 
      });
    }
  };

  const handleEndSession = async () => {
    try {
      await saveData(false);
      stopTracking();
      console.log(`[${new Date().toISOString()}] Gaze tracking stopped at session end`);
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
          <FormControl fullWidth margin="normal">
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
          <FormControl fullWidth margin="normal">
            <InputLabel id="user-type-select-label">User Type</InputLabel>
            <Select
              labelId="user-type-select-label"
              value={userType}
              onChange={(e) => setUserType(e.target.value)}
            >
              <MenuItem value="host">Host</MenuItem>
              <MenuItem value="guest">Guest</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            margin="normal"
            label="Total Steps"
            type="number"
            value={totalSteps}
            onChange={(e) => setTotalSteps(e.target.value)}
          />
        </Box>
        <Box mt={4} display="flex" justifyContent="center">
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleStartSession}
            disabled={!selectedSet || !userType || !totalSteps}
          >
            Start Session
          </Button>
        </Box>
      </Container>
    );
  }
  
  return (
    <Container maxWidth={false} style={{ padding: '1rem', minWidth: '1250px', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {showCountdown && <Countdown onComplete={handleCountdownComplete} />}
      {showImages && (
        <>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Image Selection System
          </Typography>
          <Typography variant="h6" gutterBottom align="center">
            {isRegionSelectionStep ? "Select Regions" : "Select Preferred Image"}
          </Typography>
          <Typography variant="subtitle1" gutterBottom align="center">
            Step: {currentStep} / {totalSteps} (Sub-step: {currentSubStep} / 2)
          </Typography>
          <Box display="flex" justifyContent="center" alignItems="center" flexGrow={1}>
            <Box width="80%" maxWidth="1200px">
              {currentImages.length > 0 ? (
                <ImageGallery
                  ref={imageGalleryRef}
                  images={currentImages}
                  onImageSelect={handleImageSelect}
                  onRegionSelect={handleRegionSelect}
                  selectedImage={selectedImage}
                  gazeData={isDataCollectionActive ? gazeData : null}
                  isRegionSelectionStep={isRegionSelectionStep}
                  logUserAction={logUserAction}
                />
              ) : (
                <Typography>No images loaded</Typography>
              )}
              <Box mt={2} display="flex" justifyContent="center">
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleNextStep}
                >
                  Next Step
                </Button>
              </Box>
            </Box>
          </Box>
        </>
      )}
    </Container>
  );
}

export default App;
