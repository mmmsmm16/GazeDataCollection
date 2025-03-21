import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Button, 
  FormControl, 
  InputLabel,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Checkbox,
  Paper  // Paperを追加
} from '@mui/material';
import ImageGallery from './ImageGallery';
import Countdown from './Countdown';
import useEyeTracker from '../hooks/useEyeTracker';
const { ipcRenderer } = window.require('electron');


function App() {
  const [isInitialScreen, setIsInitialScreen] = useState(true);
  const [imageSets, setImageSets] = useState({});
  const [selectedSet, setSelectedSet] = useState('');
  const [userType, setUserType] = useState('guest');
  const [totalSteps, setTotalSteps] = useState(10);
  const [currentStep, setCurrentStep] = useState(1);
  const [currentSubStep, setCurrentSubStep] = useState(1);
  const [currentImages, setCurrentImages] = useState([]);
  const [nextImages, setNextImages] = useState([]);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);
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
  const [imageQueue, setImageQueue] = useState([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [includeRegionSelection, setIncludeRegionSelection] = useState(false);

  const { 
    gazeData, 
    isConnected, 
    error, 
    startTracking, 
    stopTracking, 
    getGazeDataBuffer 
  } = useEyeTracker('ws://host.docker.internal:8765');


  // App.js の isInitialScreen に関するuseEffectを追加
useEffect(() => {
  console.log('isInitialScreen:', isInitialScreen);
}, [isInitialScreen]);

  // デバッグ用のログ関数
  const debugLog = useCallback((message, data) => {
    console.log(`[${new Date().toISOString()}] ${message}`, data);
  }, []);
  
  // Image sets のロード
  useEffect(() => {
    debugLog('Loading image sets');
    ipcRenderer.invoke('load-image-sets')
      .then(loadedImageSets => {
        debugLog('Loaded image sets', loadedImageSets);
        setImageSets(loadedImageSets);
      })
      .catch(error => {
        console.error('Failed to load image sets:', error);
        alert(`Failed to load image sets. Error: ${error.message}\nPlease check the image_sets folder and the main process logs.`);
      });
  }, [debugLog]);

  // 画像セットをロードする関数
  const loadImageSet = useCallback((setIndex) => {
    const setKeys = Object.keys(imageSets);
    if (setKeys.length === 0) {
      debugLog('No image sets available', imageSets);
      return [];
    }
    const setKey = setKeys[setIndex % setKeys.length];
    const newImages = getRandomImages(imageSets[setKey], 4);
    debugLog(`Loaded image set for index ${setIndex}`, newImages);
    return newImages;
  }, [imageSets, debugLog]);

  // 画像キューを更新する関数
  const updateImageQueue = useCallback(() => {
    setIsLoadingImages(true);
    const newImages = loadImageSet(currentSetIndex + imageQueue.length);
    if (newImages.length > 0) {
      setImageQueue(prevQueue => {
        const updatedQueue = [...prevQueue, newImages];
        debugLog('Updated image queue', updatedQueue);
        return updatedQueue;
      });
    } else {
      debugLog('Failed to load new images for queue', { currentSetIndex, queueLength: imageQueue.length });
    }
    setIsLoadingImages(false);
  }, [loadImageSet, currentSetIndex, imageQueue.length, debugLog]);

  // 初期画像セットのロード
  useEffect(() => {
    if (Object.keys(imageSets).length > 0 && imageQueue.length === 0) {
      debugLog('Loading initial image sets', { imageSetsLength: Object.keys(imageSets).length, queueLength: imageQueue.length });
      updateImageQueue();
      updateImageQueue(); // 次のセットも準備
    }
  }, [imageSets, imageQueue.length, updateImageQueue, debugLog]);

  // 画像キューが少なくなったら新しい画像をロード
  useEffect(() => {
    if (imageQueue.length < 2 && !isLoadingImages) {
      debugLog('Updating image queue due to low count', { queueLength: imageQueue.length, isLoadingImages });
      updateImageQueue();
    }
  }, [imageQueue, isLoadingImages, updateImageQueue, debugLog]);

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
    console.log('Starting session with:', {
      selectedSet,
      userType,
      totalSteps,
      includeRegionSelection
    });
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

  const handleCountdownComplete = useCallback(() => {
    debugLog('Countdown completed', { currentStep, currentSubStep, currentImages });
    setShowCountdown(false);
    setShowImages(true);
    startTracking();
    setIsDataCollectionActive(true);
  }, [currentStep, currentSubStep, currentImages, debugLog, startTracking]);


  const handleImageSelect = (image) => {
    setSelectedImage(image);
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

  const saveData = async (isEndSession = false, currentSelectedImage = null) => {
    console.log(`[${new Date().toISOString()}] Saving data with selected image:`, currentSelectedImage);
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
        isSelected: currentSelectedImage ? image.id === currentSelectedImage.id : selectedImage ? image.id === selectedImage.id : false,
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

  // handleNextStep 関数
  const handleNextStep = async (selectedImageFromGallery = null) => {
    debugLog('handleNextStep called', { currentStep, currentSubStep, imageQueueLength: imageQueue.length, currentImages });
  
    setIsDataCollectionActive(false);
    stopTracking();
    
    // 選択された画像の状態を即時反映させる
    let currentSelectedImage = selectedImage;
    if (selectedImageFromGallery) {
      currentSelectedImage = selectedImageFromGallery;
      setSelectedImage(selectedImageFromGallery);
    }
  
    // saveDataを修正して現在の選択状態を渡す
    await saveData(false, currentSelectedImage);

    let nextStep = currentStep;
    let nextSubStep = currentSubStep;
  
    if (includeRegionSelection) {
      if (currentSubStep === 1) {
        nextSubStep = 2;
        setIsRegionSelectionStep(true);
      } else {
        nextStep = currentStep + 1;
        nextSubStep = 1;
        setIsRegionSelectionStep(false);
      }
    } else {
      nextStep = currentStep + 1;
      nextSubStep = 1;
      setIsRegionSelectionStep(false);
    }

    debugLog('Transitioning to next step/substep', { nextStep, nextSubStep });

    if (nextStep > parseInt(totalSteps)) {
      debugLog('Reached total steps, ending session');
      await handleEndSession();
      resetState();
      return;
    }
    
    setCurrentStep(nextStep);
    setCurrentSubStep(nextSubStep);

    if (nextSubStep === 1) {
      if (imageQueue.length > 0) {
        const nextImages = imageQueue[0];
        debugLog('Setting next images', nextImages);
        setCurrentImages(nextImages);
        setImageQueue(prevQueue => {
          const updatedQueue = prevQueue.slice(1);
          debugLog('Updated image queue after setting next images', updatedQueue);
          return updatedQueue;
        });
        setCurrentSetIndex(prevIndex => prevIndex + 1);
        
        if (imageQueue.length < 3) {
          debugLog('Updating image queue in handleNextStep', { queueLength: imageQueue.length });
          updateImageQueue();
        }
      } else {
        debugLog('Image queue is empty. Loading new images.', { currentSetIndex });
        const newImages = loadImageSet(currentSetIndex);
        if (newImages.length > 0) {
          setCurrentImages(newImages);
          debugLog('Loaded new images as fallback', newImages);
        } else {
          debugLog('Failed to load new images as fallback', { currentSetIndex, imageSets });
          alert('Failed to load new images. Please restart the session.');
          return;
        }
      }
      
      setShowCountdown(true);
      setShowImages(false);
      setSelectedImage(null);
    } else {
      startNextSubstep();
    }

    setSelectedRegions({});
    setGazeDataBuffer([]);

    if (imageGalleryRef.current) {
      imageGalleryRef.current.resetSelection();
    }

    logUserAction('NEXT_STEP', { 
      currentStep: nextStep, 
      currentSubStep: nextSubStep,
      isRegionSelectionStep: nextSubStep === 2 
    });
  };
  
  const resetState = () => {
    setCurrentStep(1);
    setCurrentSubStep(1);
    setIsRegionSelectionStep(false);
    setCurrentSetIndex(0);
    setSelectedImage(null);
    setSelectedRegions({});
    setGazeDataBuffer([]);
    setUserActionLog([]);
    setShowCountdown(false);
    setShowImages(false);
    setIsDataCollectionActive(false);
    
    // 画像キューを初期化
    setImageQueue([]);
    updateImageQueue();
    updateImageQueue();
  
    // 初期画面に戻る
    setIsInitialScreen(true);
  
    console.log(`[${new Date().toISOString()}] State reset completed. Ready for new session.`);
  };

  const startNextSubstep = () => {
    console.log(`[${new Date().toISOString()}] Starting next substep`);
    setShowImages(true);
    startTracking();
    setIsDataCollectionActive(true);
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
      <Container maxWidth="sm">
        <Box sx={{ mt: '20vh', p: 4, bgcolor: 'background.paper' }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Image Selection System
          </Typography>
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
          <FormControlLabel
            control={
              <Checkbox
                checked={includeRegionSelection}
                onChange={(e) => setIncludeRegionSelection(e.target.checked)}
              />
            }
            label="Include Region Selection Step"
            sx={{ mt: 2, display: 'block' }}
          />
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
        </Box>
      </Container>
    );
  }
  
  // メイン画面のreturn部分
  return (
    <Container maxWidth={false} sx={{ 
      padding: '1rem', 
      minWidth: '1250px', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center' 
    }}>
      {showCountdown && <Countdown onComplete={handleCountdownComplete} />}
      {showImages && (
        <>
          <Typography variant="h6" gutterBottom align="center">
            {isRegionSelectionStep ? "Select Regions" : "Select Preferred Image"}
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
                  onNextStep={handleNextStep}
                  showNextStepButton={isRegionSelectionStep}
                />
              ) : (
                <Typography>Loading images...</Typography>
              )}
            </Box>
          </Box>
        </>
      )}
    </Container>
  );
}

export default App;
