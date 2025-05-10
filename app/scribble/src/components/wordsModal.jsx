import React, { useState, useEffect, useContext } from 'react';
import { TargetContext, GameContext } from '../pages/MainCanvasPage';
import socket from './socket';

// Debug helper function
const debugLog = (message, data) => {
  console.log(`%c[WordModal Debug] ${message}`, 'background: #ffd700; color: #000; padding: 3px;', data || '');
};

const WordModal = ({ wordCount = 3 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { word, setWord } = useContext(TargetContext);
  const gameContext = useContext(GameContext);
  const [wordOptions, setWordOptions] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [didMount, setDidMount] = useState(false);
  const [drawerId, setDrawerId] = useState(null);

  debugLog('Component rendered', { 
    isOpen, 
    hasWordOptions: wordOptions?.length > 0,
    isDrawing: gameContext?.isDrawing,
    hasWordOptionsContext: gameContext?.hasWordOptions,
    wordOptionsCount: wordOptions?.length,
    currentWord: word,
    mySocketId: socket.id,
    drawerId: drawerId
  });
  
  // Add mount log and immediately request drawer info
  useEffect(() => {
    debugLog('Component mounted');
    setDidMount(true);
    
    // Immediately request drawer info on mount
    const roomId = localStorage.getItem('roomId');
    if (roomId) {
      debugLog('Requesting drawer info on mount');
      socket.emit('getDrawerInfo', { roomId });
    }
    
    // Also set up an interval to periodically check drawer info
    // This ensures we don't miss drawer assignment
    const checkInterval = setInterval(() => {
      const roomId = localStorage.getItem('roomId');
      if (roomId && !isOpen && !word) {
        debugLog('Periodic drawer info check');
        socket.emit('getDrawerInfo', { roomId });
      }
    }, 2000); // Check every 2 seconds
    
    return () => {
      debugLog('Component unmounted');
      clearInterval(checkInterval);
    };
  }, [isOpen, word]);

  // Listen for drawer assignment
  useEffect(() => {
    const handleAssignedAsDrawer = (data) => {
      debugLog('Drawer assignment data received', data);
      
      if (data.isDrawing && data.wordOptions && data.wordOptions.length > 0) {
        // We're the drawer, show word options
        debugLog('Word options received', data.wordOptions);
        setWordOptions(data.wordOptions);
        setIsOpen(true);
        setWord(""); // Reset any previous word
        
        // Start a countdown to encourage quick selection
        setCountdown(5);
      } else {
        // We're not the drawer, hide modal
        debugLog('Not the drawer or no word options', data);
        setIsOpen(false);
        setCountdown(null);
      }
    };

    // Handle drawer info response
    const handleDrawerInfo = (data) => {
      debugLog('Got drawer info response', data);
      
      // Store the drawerId regardless of whether we're the drawer
      if (data.drawerId) {
        setDrawerId(data.drawerId);
      }
      
      // Log all data to help debug
      debugLog('Drawer info data details', {
        isCurrentDrawer: data.isCurrentDrawer,
        hasWordOptions: data.wordOptions?.length > 0,
        wordOptionsCount: data.wordOptions?.length,
        wordSelected: data.wordSelected,
        currentWord: word,
        mySocketId: socket.id,
        drawerId: data.drawerId || drawerId
      });
      
      // If we are the drawer and have word options but haven't selected yet
      // For extra reliability, check socket.id directly against drawerId
      if ((data.isCurrentDrawer || socket.id === data.drawerId) && 
          data.wordOptions && data.wordOptions.length > 0 && 
          !data.wordSelected) {
        debugLog('Opening word selection modal from getDrawerInfo', data.wordOptions);
        setWordOptions(data.wordOptions);
        setIsOpen(true);
        setCountdown(5);
      }
    };

    socket.on("assignedAsDrawer", handleAssignedAsDrawer);
    socket.on("drawerInfo", handleDrawerInfo);
    
    // Listen for drawer assigned event to get the drawerId
    const handleDrawerAssigned = (data) => {
      debugLog('Drawer assigned event received', data);
      if (data.drawerId) {
        setDrawerId(data.drawerId);
        // If I'm the drawer, request word options immediately
        if (data.drawerId === socket.id) {
          const roomId = localStorage.getItem('roomId');
          if (roomId) {
            debugLog('I am the new drawer, requesting drawer info');
            socket.emit('getDrawerInfo', { roomId });
          }
        }
      }
    };
    
    socket.on("drawerAssigned", handleDrawerAssigned);
    
    // Listen for word selection
    const handleWordSelected = (data) => {
      debugLog('Word selected event', data);
      if (data.word) {
        // This is for the drawer
        setWord(data.word);
        setIsOpen(false); // Close the modal when word is selected (by server or user)
        setCountdown(null);
        debugLog(`Word selected and set: ${data.word}`);
      }
    };
    
    socket.on("wordSelected", handleWordSelected);

    // Request drawer info when dependencies change
    const roomId = localStorage.getItem('roomId');
    if (roomId) {
      debugLog('Requesting drawer info on dependency change');
      socket.emit('getDrawerInfo', { roomId });
    }

    return () => {
      socket.off("assignedAsDrawer", handleAssignedAsDrawer);
      socket.off("drawerInfo", handleDrawerInfo);
      socket.off("drawerAssigned", handleDrawerAssigned);
      socket.off("wordSelected", handleWordSelected);
    };
  }, [setWord, word, drawerId]);

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null) return;
    
    debugLog('Countdown updated', countdown);
    const timer = countdown > 0 && setInterval(() => {
      setCountdown(countdown - 1);
    }, 1000);

    // The server will auto-select at 0, we just need to update UI
    if (countdown === 0) {
      debugLog('Countdown reached zero, waiting for server to auto-select');
    }
    
    return () => timer && clearInterval(timer);
  }, [countdown]);

  // Function to handle word selection
  const handleWordSelect = (selectedWord, index) => {
    const roomId = localStorage.getItem("roomId");
    
    debugLog('Word selected by user', { selectedWord, index });
    socket.emit("selectWord", { roomId, wordIndex: index });
    
    // No toast, just debug log
    debugLog(`User selected: ${selectedWord}`);
  };

  // Force modal to be visible in certain conditions
  useEffect(() => {
    // Check if we should force modal open based on multiple conditions
    const amIDrawer = gameContext?.isDrawing || 
                     (drawerId && socket.id === drawerId) ||
                     (gameContext?.currentDrawer && localStorage.getItem("userName") === gameContext?.currentDrawer);
                     
    const shouldShowModal = amIDrawer && 
                           wordOptions.length > 0 && 
                           !word && 
                           !gameContext?.wordSelected;
                           
    debugLog('Force modal visibility check', { 
      amIDrawer, 
      shouldShowModal, 
      wordOptionsLength: wordOptions.length,
      currentWord: word,
      gameContextWordSelected: gameContext?.wordSelected,
      myUserName: localStorage.getItem("userName"),
      currentDrawer: gameContext?.currentDrawer
    });
    
    // If we determine we should show the modal
    if (shouldShowModal && !isOpen) {
      debugLog('Forcing modal to open');
      setIsOpen(true);
      // Add countdown only if it's not already set
      if (countdown === null) {
        setCountdown(10);
      }
    } 
    // If the modal should be closed but is open
    else if (!shouldShowModal && isOpen) {
      debugLog('Forcing modal to close');
      setIsOpen(false);
      setCountdown(null);
    }
  }, [gameContext?.isDrawing, gameContext?.wordSelected, gameContext?.currentDrawer, drawerId, wordOptions, word, isOpen, countdown]);

  // Handle round changes - make sure to re-request drawer info
  useEffect(() => {
    if (gameContext?.currentRound > 0) {
      debugLog('Round changed to ' + gameContext.currentRound);
      
      // Wait a moment for server to update, then request drawer info
      setTimeout(() => {
        const roomId = localStorage.getItem('roomId');
        if (roomId) {
          debugLog('Requesting drawer info after round change');
          socket.emit('getDrawerInfo', { roomId });
        }
      }, 1000);
    }
  }, [gameContext?.currentRound]);

  // If I am drawer and waiting for word options but don't have any, request them
  useEffect(() => {
    if (gameContext?.isDrawing && gameContext?.hasWordOptions && wordOptions.length === 0) {
      debugLog('I am drawer with no word options, requesting them');
      const roomId = localStorage.getItem('roomId');
      if (roomId) {
        socket.emit('getDrawerInfo', { roomId });
        // Try again after a short delay
        setTimeout(() => {
          socket.emit('getDrawerInfo', { roomId });
        }, 500);
      }
    }
  }, [gameContext?.isDrawing, gameContext?.hasWordOptions, wordOptions.length]);

  // Don't render anything if modal is closed
  if (!isOpen) {
    debugLog('Modal is closed, not rendering');
    return null;
  }
  
  // Don't render if we have no word options
  if (!wordOptions || wordOptions.length === 0) {
    debugLog('No word options available, not rendering');
    return null;
  }

  debugLog('Rendering modal with word options', wordOptions);
  return (
    <div className="fixed z-50 inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 relative animate-fade-in">
        <div className="absolute -top-3 -right-3 bg-indigo-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">
          {countdown !== null ? countdown : ''}
        </div>
        
        <h2 className="text-2xl font-semibold text-gray-800 mb-2 text-center">
          Choose a Word to Draw
        </h2>
        
        <p className="text-center text-gray-600 mb-6">
          Select one of the options below in the next {countdown} seconds, or one will be randomly selected for you!
        </p>
        
        <div className="grid grid-cols-1 gap-4 mb-6">
          {wordOptions.map((word, index) => (
            <button
              key={index}
              className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold py-4 px-6 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1 hover:from-indigo-600 hover:to-indigo-700 text-lg"
              onClick={() => handleWordSelect(word, index)}
            >
              {word}
            </button>
          ))}
        </div>
        
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-medium text-amber-800 mb-2">How to play:</h3>
          <ol className="list-decimal list-inside text-sm text-amber-700 space-y-1">
            <li>Choose one word from the options above within 5 seconds</li>
            <li>Draw that word using the drawing tools</li>
            <li>Other players will try to guess what you're drawing</li>
            <li>You earn up to 200 points when players guess correctly!</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default WordModal;
