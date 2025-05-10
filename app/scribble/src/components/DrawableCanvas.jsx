import React, { useRef, useState, useEffect, useCallback, useContext } from 'react';
import { Pencil, Eraser, PaintBucket, Undo, Redo, Trash2 } from 'lucide-react';
import socket from './socket';
import { GameContext, TargetContext } from '../pages/MainCanvasPage';
import safeToast from './utils/toastUtils';

const colorPalette = [
  '#000000',
  '#FFFFFF',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#FF00FF',
  '#00FFFF',
  '#FFA500',
  '#800080',
  '#A52A2A',
  '#808080',
];

const sizePresets = [
  { size: 2, label: 'XS', cursorSize: 3 },
  { size: 6, label: 'S', cursorSize: 6 },
  { size: 12, label: 'M', cursorSize: 12 },
  { size: 20, label: 'L', cursorSize: 20 },
];

// Utility functions for pixel manipulation
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
};

const getPixelColor = (imageData, x, y) => {
  const index = (y * imageData.width + x) * 4;
  return {
    r: imageData.data[index],
    g: imageData.data[index + 1],
    b: imageData.data[index + 2],
    a: imageData.data[index + 3],
  };
};

const setPixelColor = (imageData, x, y, color) => {
  const index = (y * imageData.width + x) * 4;
  imageData.data[index] = color.r;
  imageData.data[index + 1] = color.g;
  imageData.data[index + 2] = color.b;
  imageData.data[index + 3] = 255;
};

const colorMatch = (color1, color2, tolerance = 1) => {
  return (
    Math.abs(color1.r - color2.r) <= tolerance &&
    Math.abs(color1.g - color2.g) <= tolerance &&
    Math.abs(color1.b - color2.b) <= tolerance &&
    (color1.a === undefined ||
      color2.a === undefined ||
      Math.abs(color1.a - color2.a) <= tolerance)
  );
};

const floodFill = (canvas, startX, startY, fillColorHex) => {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const fillColor = hexToRgb(fillColorHex);

  const targetColor = getPixelColor(imageData, startX, startY);
  if (colorMatch(targetColor, fillColor, 1)) return;

  const pixelsToCheck = [[startX, startY]];
  const filledPixels = new Set();

  while (pixelsToCheck.length > 0) {
    const [x, y] = pixelsToCheck.pop();
    const key = `${x},${y}`;

    if (filledPixels.has(key)) continue;
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;

    const currentColor = getPixelColor(imageData, x, y);
    if (!colorMatch(currentColor, targetColor, 1)) continue;

    setPixelColor(imageData, x, y, fillColor);
    filledPixels.add(key);

    pixelsToCheck.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  ctx.putImageData(imageData, 0, 0);
};

const DrawableCanvas = ({ isDisabled }) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedColor, setSelectedColor] = useState(colorPalette[0]);
  const [tool, setTool] = useState('pen');
  const [lineWidth, setLineWidth] = useState(sizePresets[1].size); // Default to S size
  const [cursor, setCursor] = useState('default');
  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const canvasSizeRef = useRef({ width: 0, height: 0 });
  const maxHistory = 50;
  const lastCoordRef = useRef(null);
  const roomId = localStorage.getItem('roomId');
  const rafIdRef = useRef(null);
  
  // Get game context and target word
  const gameContext = useContext(GameContext);
  const { word } = useContext(TargetContext);
  
  // Handle drawer status tracking
  const [drawerName, setDrawerName] = useState("");
  const [drawerId, setDrawerId] = useState("");
  const [isCurrentDrawer, setIsCurrentDrawer] = useState(false);
  const [waitingForWordSelection, setWaitingForWordSelection] = useState(false);

  // Device pixel ratio for high resolution rendering
  const dprRef = useRef(window.devicePixelRatio || 1);

  // Setup socket event listeners in a separate useEffect
  useEffect(() => {
    // Handler for drawer info response
    const handleDrawerInfo = (data) => {
      console.log("Got drawer info:", data);
      if (data.drawerName) {
        setDrawerName(data.drawerName);
      }
      if (data.wordSelected !== undefined) {
        setWaitingForWordSelection(!data.wordSelected);
      }
      if (data.isCurrentDrawer !== undefined) {
        console.log(`Setting isCurrentDrawer to ${data.isCurrentDrawer} from drawerInfo`);
        setIsCurrentDrawer(data.isCurrentDrawer);
      }
      
      // Log the drawer state after update for debugging
      setTimeout(() => {
        console.log("Drawer state after update:", { 
          isCurrentDrawer: data.isCurrentDrawer, 
          waitingForWord: !data.wordSelected,
          drawerName: data.drawerName,
          socketId: socket.id
        });
      }, 50);
    };
    
    // Handler for drawer assignment events
    const handleDrawerAssigned = (data) => {
      console.log("Drawer assigned event:", data);
      if (data && data.drawerName) {
        setDrawerName(data.drawerName);
        setWaitingForWordSelection(true); // Set waiting state when drawer is assigned
      }
      if (data && data.drawerId) {
        setDrawerId(data.drawerId);
        
        // Check if current user is the drawer
        const isDrawer = data.drawerId === socket.id;
        setIsCurrentDrawer(isDrawer);
        console.log(`Current user is drawer: ${isDrawer}`);
      }
    };
    
    // Handler for direct assignment for current user
    const handleAssignedAsDrawer = (data) => {
      console.log("Assigned as drawer:", data);
      setIsCurrentDrawer(data.isDrawing);
      
      if (data.isDrawing) {
        safeToast.success("It's your turn to draw! Choose a word.");
      }
    };

    // Handler for word selection events
    const handleWordSelected = (data) => {
      console.log("Word selected event:", data);
      // Regardless of who got this event, we're no longer waiting for word selection
      setWaitingForWordSelection(false);
      
      try {
        if (data.word) {
          // I'm the drawer, I got the full word
          console.log("I'm the drawer, received full word:", data.word);
          safeToast.success(`You'll be drawing: ${data.word}`);
        } else if (data.length) {
          // I'm a guesser, I know the length
          console.log(`I'm a guesser, drawer selected a ${data.length}-letter word`);
          const drawerDisplayName = drawerName || gameContext?.currentDrawer || 'The drawer';
          safeToast.info(`${drawerDisplayName} is drawing a ${data.length}-letter word`);
        }
      } catch (error) {
        console.error("Toast error:", error);
      }
      
      // Force immediate state update
      if (gameContext && !gameContext.wordSelected) {
        setTimeout(() => {
          // This can trigger a re-render if the MainCanvasPage hasn't updated yet
          console.log("Forcing render after wordSelected event");
          setIsDrawing(gameContext.isDrawing || false);
        }, 100);
      }
    };

    // Add a listener for round changes
    const handleRoundChanged = () => {
      console.log("Round changed detected in DrawableCanvas");
      // Re-request drawer info on round change
      if (roomId) {
        console.log("Re-requesting drawer info from DrawableCanvas");
        setTimeout(() => {
          socket.emit("getDrawerInfo", { roomId });
        }, 500);
      }
    };

    // Add handler for round start
    const handleRoundStart = (data) => {
      console.log("Round start event received:", data);
      if (data.drawerId === socket.id) {
        console.log("I am the drawer for this round");
        setIsCurrentDrawer(true);
      } else {
        console.log("I am not the drawer for this round");
        setIsCurrentDrawer(false);
      }
      
      // Reset canvas
      clearCanvas(false);
    };

    // Set up event listeners
    socket.on("drawerInfo", handleDrawerInfo);
    socket.on("drawerAssigned", handleDrawerAssigned);
    socket.on("assignedAsDrawer", handleAssignedAsDrawer);
    socket.on("wordSelected", handleWordSelected);
    socket.on("roundChanged", handleRoundChanged);
    socket.on("roundStart", handleRoundStart);

    // Request current drawer info when component mounts
    if (roomId) {
      socket.emit("getDrawerInfo", { roomId });
    }

    // Clean up event listeners
    return () => {
      socket.off("drawerInfo", handleDrawerInfo);
      socket.off("drawerAssigned", handleDrawerAssigned);
      socket.off("assignedAsDrawer", handleAssignedAsDrawer);
      socket.off("wordSelected", handleWordSelected);
      socket.off("roundChanged", handleRoundChanged);
      socket.off("roundStart", handleRoundStart);
    };
  }, [roomId, drawerName, gameContext]); // Dependencies

  // Handle round end
  useEffect(() => {
    if (gameContext?.roundEnded && isCurrentDrawer) {
      safeToast.info(`Round ended! The word was: "${word}"`);
    }
  }, [gameContext?.roundEnded, isCurrentDrawer, word]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctxRef.current = ctx;

    // Initial resize
    resizeCanvas();

    // Setup resize observer for more reliable resizing
    const resizeObserver = new ResizeObserver(() => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(resizeCanvas);
    });

    resizeObserver.observe(canvas.parentElement);

    // Request canvas state when joining a room
    if (roomId) {
      socket.emit('requestCanvasState', { roomId });
    }

    return () => {
      resizeObserver.disconnect();
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Listen for drawing events
  useEffect(() => {
    const handleDraw = (data) => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;

      const dpr = dprRef.current;

      if (data.tool === 'pen' || data.tool === 'eraser') {
        if (data.action === 'start') {
          ctx.beginPath();
          ctx.moveTo(data.start.x / dpr, data.start.y / dpr);
        } else if (data.action === 'draw') {
          // Set the correct rendering style for the remote user's action
          const currentStrokeStyle = ctx.strokeStyle;
          const currentLineWidth = ctx.lineWidth;

          ctx.strokeStyle = data.tool === 'eraser' ? '#FFFFFF' : data.color;
          ctx.lineWidth = data.tool === 'eraser' ? data.lineWidth * 2 : data.lineWidth;

          ctx.beginPath();
          ctx.moveTo(data.start.x / dpr, data.start.y / dpr);
          ctx.lineTo(data.end.x / dpr, data.end.y / dpr);
          ctx.stroke();

          // Restore previous style
          ctx.strokeStyle = currentStrokeStyle;
          ctx.lineWidth = currentLineWidth;
        } else if (data.action === 'stop') {
          ctx.closePath();
          // Add a small delay before saving state to ensure multiple operations finish
          setTimeout(() => saveState(), 100);
        }
      } else if (data.tool === 'fill') {
        const scaledX = Math.floor(data.start.x / dpr);
        const scaledY = Math.floor(data.start.y / dpr);
        floodFill(canvas, scaledX, scaledY, data.color);
        // Add a small delay before saving state
        setTimeout(() => saveState(), 100);
      } else if (data.action === 'clear') {
        clearCanvas(false); // Don't emit another clear event
      }
    };

    const handleCanvasState = (drawingActions) => {
      if (!drawingActions || drawingActions.length === 0) return;

      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;

      // Clear the canvas first
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);

      // Replay all the drawing actions
      drawingActions.forEach(action => {
        handleDraw(action);
      });

      // Save the restored state
      saveState();
    };

    const handleClearCanvas = () => {
      clearCanvas(false); // Don't emit another clear event
    };

    // Set up socket listeners
    socket.on('draw', handleDraw);
    socket.on('canvasState', handleCanvasState);
    socket.on('clearCanvas', handleClearCanvas);

    return () => {
      socket.off('draw', handleDraw);
      socket.off('canvasState', handleCanvasState);
      socket.off('clearCanvas', handleClearCanvas);
    };
  }, []);

  // Canvas resize function
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = ctxRef.current;
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    // Get the desired size from the container
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight || 500;

    // Don't resize if dimensions haven't changed
    if (
      canvasSizeRef.current.width === containerWidth &&
      canvasSizeRef.current.height === containerHeight
    ) {
      return;
    }

    // Create an offscreen canvas to save current content
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    offscreenCtx.drawImage(canvas, 0, 0);

    // Update the reference size
    canvasSizeRef.current = {
      width: containerWidth,
      height: containerHeight
    };

    // Set display size (CSS)
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;

    // Set actual size in memory (scaled for high DPI)
    canvas.width = Math.floor(containerWidth * dpr);
    canvas.height = Math.floor(containerHeight * dpr);

    // Scale for high-resolution rendering
    ctx.scale(dpr, dpr);

    // Restore drawing settings
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : selectedColor;
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 2 : lineWidth;
    
    // If the canvas was previously drawn on, restore the content
    if (offscreenCanvas.width > 0 && offscreenCanvas.height > 0) {
      ctx.drawImage(
        offscreenCanvas,
        0, 0, offscreenCanvas.width, offscreenCanvas.height,
        0, 0, containerWidth, containerHeight
      );
    } else {
      // Ensure canvas background is white where no content exists
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, containerWidth, containerHeight);
    }
  };

  // Save the current state to history
  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // If we've undone some steps and are now drawing new ones,
    // truncate the history
    if (currentStep < history.length - 1) {
      setHistory(prev => prev.slice(0, currentStep + 1));
    }
    
    // Add current state to history
    setHistory(prev => {
      const newHistory = [...prev, canvas.toDataURL()];
      if (newHistory.length > maxHistory) {
        return newHistory.slice(1);
      }
      return newHistory;
    });
    
    setCurrentStep(prev => Math.min(prev + 1, maxHistory - 1));
  };

  // Load a state from history
  const loadState = (dataURL) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
      ctx.drawImage(img, 0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
    };
    img.src = dataURL;
  };

  // Undo function
  const undo = () => {
    if (currentStep <= 0 || !isCurrentDrawer) return;
    const newStep = currentStep - 1;
    setCurrentStep(newStep);
    
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    
    // Load previous state
    const img = new Image();
    img.src = history[newStep];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
      ctx.drawImage(img, 0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
    };
  };

  // Redo function
  const redo = () => {
    if (currentStep >= history.length - 1 || !isCurrentDrawer) return;
    const newStep = currentStep + 1;
    setCurrentStep(newStep);
    
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    
    // Load next state
    const img = new Image();
    img.src = history[newStep];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
      ctx.drawImage(img, 0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
    };
  };

  // Clear the canvas
  const clearCanvas = (emitEvent = true) => {
    if (!isCurrentDrawer && emitEvent) {
      safeToast.error("Only the drawer can clear the canvas!");
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
    
    if (emitEvent) {
      // Emit clear event
      socket.emit('draw', {
        roomId: roomId,
        action: 'clear',
      });
    }
    
    saveState();
  };

  // Generate cursor SVG
  const generateCursor = useCallback((tool, color, size) => {
    const cursorSize = size * 2;
    let svg;
    
    if (tool === 'pen') {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cursorSize}" height="${cursorSize}">
        <circle cx="${cursorSize/2}" cy="${cursorSize/2}" r="${size}" fill="${color}" stroke="white" stroke-width="1"/>
      </svg>`;
    } else if (tool === 'eraser') {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cursorSize}" height="${cursorSize}">
        <rect x="${cursorSize/4}" y="${cursorSize/4}" width="${cursorSize/2}" height="${cursorSize/2}" fill="white" stroke="black"/>
      </svg>`;
    } else {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
        <path d="M8 0L16 8L8 16L0 8Z" fill="${color}" stroke="white"/>
      </svg>`;
    }
    
    return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${cursorSize/2} ${cursorSize/2}, crosshair`;
  }, []);

  // Update cursor when tool/color changes
  useEffect(() => {
    setCursor(generateCursor(tool, selectedColor, lineWidth));
  }, [tool, selectedColor, lineWidth, generateCursor]);

  // Get coordinates from event
  const getCoordinates = (e) => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      
      const rect = canvas.getBoundingClientRect();
      const dpr = dprRef.current;
      
      // Check if event is valid
      if (!e || (!e.clientX && !e.touches)) return null;
      
      const clientX = e.touches ? e.touches[0]?.clientX : e.clientX;
      const clientY = e.touches ? e.touches[0]?.clientY : e.clientY;
      
      // Ensure coordinates are valid numbers
      if (typeof clientX !== 'number' || typeof clientY !== 'number') return null;
      
      return {
        x: Math.floor((clientX - rect.left) * dpr),
        y: Math.floor((clientY - rect.top) * dpr)
      };
    } catch (error) {
      console.error("Error getting coordinates:", error);
      return null;
    }
  };

  // Reset isCurrentDrawer on round change
  useEffect(() => {
    setIsCurrentDrawer(false);
  }, [gameContext?.currentRound]);

  // Listen for round changes
  useEffect(() => {
    // When the round changes, clear the canvas
    if (gameContext?.currentRound > 0) {
      console.log("Round changed in DrawableCanvas:", gameContext.currentRound);
      clearCanvas(false);
      
      // Request drawer info again with delay
      if (roomId) {
        setTimeout(() => {
          console.log("Requesting drawer info after round change");
          socket.emit("getDrawerInfo", { roomId });
        }, 800);
      }
    }
  }, [gameContext?.currentRound, roomId]);

  // Start drawing
  const startDrawing = (e) => {
    e.preventDefault();
    
    // More detailed debug logging to trace permission issues
    console.log("Drawing attempt - Detailed state:", { 
      isCurrentDrawer, 
      gameContextIsDrawing: gameContext?.isDrawing,
      word: word,
      wordSelected: gameContext?.wordSelected,
      drawerName: drawerName,
      currentDrawer: gameContext?.currentDrawer,
      allGuessedCorrectly: gameContext?.allGuessedCorrectly,
      roundEnded: gameContext?.roundEnded,
      roomId: roomId
    });
    
    // Check if the round has ended or all players have guessed correctly
    if (gameContext?.roundEnded || gameContext?.allGuessedCorrectly) {
      console.log("Drawing stopped - round ended or all guessed correctly");
      return;
    }
    
    // Make this check more permissive - if ANY of the conditions indicate 
    // this user is the drawer, allow drawing
    const isAuthorizedToDraw = isCurrentDrawer || gameContext?.isDrawing || 
      (drawerName && socket.id === drawerId) || 
      (gameContext?.currentDrawer && localStorage.getItem("userName") === gameContext.currentDrawer);
    
    // Only if we're NOT authorized at all, show the error
    if (!isAuthorizedToDraw) {
      try {
        safeToast.error("It's not your turn to draw!");
        console.log("Drawing stopped - not authorized:", { 
          isCurrentDrawer, 
          gameContextIsDrawing: gameContext?.isDrawing,
          drawerName,
          userName: localStorage.getItem("userName"),
          currentDrawer: gameContext?.currentDrawer
        });
      } catch (error) {
        console.error("Toast error:", error);
      }
      return;
    }
    
    // Keep word selection check
    if (!gameContext?.wordSelected && !word) {
      try {
        safeToast.info("Please wait for word selection before drawing");
        console.log("Drawing stopped - waiting for word selection");
      } catch (error) {
        console.error("Toast error:", error);
      }
      return;
    }
    
    const coords = getCoordinates(e);
    if (!coords) return;
    
    const dpr = dprRef.current;
    
    if (tool === 'pen' || tool === 'eraser') {
      ctxRef.current.beginPath();
      ctxRef.current.moveTo(coords.x / dpr, coords.y / dpr);
      lastCoordRef.current = coords;
      setIsDrawing(true);
      
      // Emit drawing start event
      socket.emit('draw', {
        roomId: roomId,
        tool: tool,
        action: 'start',
        start: coords,
        color: selectedColor,
        lineWidth: lineWidth
      });
    } else if (tool === 'fill') {
      const scaledX = Math.floor(coords.x / dpr);
      const scaledY = Math.floor(coords.y / dpr);
      floodFill(canvasRef.current, scaledX, scaledY, selectedColor);
      
      // Emit fill event
      socket.emit('draw', {
        roomId: roomId,
        tool: tool,
        action: 'fill',
        start: coords,
        color: selectedColor
      });
      
      saveState();
    }
  };

  // Continue drawing
  const draw = (e) => {
    // Check if the user is currently drawing and it's their turn
    if (!isDrawing) return;
    if (!isCurrentDrawer && !gameContext?.isDrawing) return;
    
    e.preventDefault();
    const coords = getCoordinates(e);
    const dpr = dprRef.current;
    
    // Check if lastCoordRef.current is null and initialize it if needed
    if (!lastCoordRef.current) {
      lastCoordRef.current = coords;
      return; // Skip this iteration to avoid the error
    }
    
    // Only draw if coordinates have changed enough
    const lastCoord = lastCoordRef.current;
    const dx = coords.x - lastCoord.x;
    const dy = coords.y - lastCoord.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Skip if movement is too small
    if (dist < 2) return;
    
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(lastCoord.x / dpr, lastCoord.y / dpr);
    ctxRef.current.lineTo(coords.x / dpr, coords.y / dpr);
    ctxRef.current.stroke();
    
    lastCoordRef.current = coords;
    
    // Emit draw event
    socket.emit('draw', {
      roomId: roomId,
      tool: tool,
      action: 'draw',
      start: lastCoord,
      end: coords,
      color: selectedColor,
      lineWidth: lineWidth
    });
  };

  // Stop drawing
  const stopDrawing = () => {
    // Only stop drawing if currently drawing and it's the user's turn
    if (!isDrawing) return;
    if (!isCurrentDrawer && !gameContext?.isDrawing) return;
    
    ctxRef.current.closePath();
    setIsDrawing(false);
    
    // Emit stop event
    socket.emit('draw', {
      roomId: roomId,
      tool: tool,
      action: 'stop'
    });
    
    saveState();
  };

  // Display the appropriate message when not drawing
  const getWaitingMessage = () => {
    // First priority: check if we're waiting for word selection
    if ((gameContext?.wordSelected === false || waitingForWordSelection) && gameContext?.currentDrawer) {
      return `Waiting for ${gameContext.currentDrawer} to choose a word...`;
    } 
    // Second priority: show who's drawing if we have a drawer
    else if (gameContext?.currentDrawer) {
      return `${gameContext.currentDrawer} is drawing now`;
    } 
    // Fallback: waiting for drawer assignment
    else if (drawerName) {
      return `${drawerName} is drawing now`;
    }
    // Ultimate fallback
    else {
      return "Waiting for drawer assignment...";
    }
  };

  // Component for size icon
  const SizeIcon = ({ size }) => (
    <div 
      className="w-6 h-6 flex items-center justify-center"
      style={{ 
        position: 'relative',
      }}
    >
      <div 
        className="rounded-full bg-current"
        style={{ 
          width: Math.max(size / 2, 4),
          height: Math.max(size / 2, 4),
        }}
      />
    </div>
  );

  // Synchronize isCurrentDrawer with gameContext
  useEffect(() => {
    console.log("[DrawableCanvas] State sync - Current state:", {
      isDrawing: gameContext?.isDrawing, 
      isCurrentDrawer, 
      drawerName, 
      currentDrawer: gameContext?.currentDrawer,
      wordSelected: gameContext?.wordSelected,
      hasWordOptions: gameContext?.hasWordOptions,
      waitingForWordSelection
    });
    
    if (gameContext) {
      // If gameContext.isDrawing has changed, update isCurrentDrawer
      if (gameContext.isDrawing !== undefined) {
        console.log(`Syncing drawer state: gameContext.isDrawing=${gameContext.isDrawing}, isCurrentDrawer=${isCurrentDrawer}`);
        setIsCurrentDrawer(gameContext.isDrawing);
      }
      
      // Sync drawer name
      if (gameContext.currentDrawer && gameContext.currentDrawer !== drawerName) {
        setDrawerName(gameContext.currentDrawer);
      }
      
      // Sync word selection state
      if (gameContext.wordSelected === true) {
        setWaitingForWordSelection(false);
      } else if (gameContext.hasWordOptions === true && gameContext.isDrawing) {
        setWaitingForWordSelection(true);
      }
    }
  }, [gameContext, isCurrentDrawer, drawerName]);

  // Add debug logging
  const debugLog = (message, data) => {
    console.log(`%c[DrawableCanvas] ${message}`, 'background: #ec4899; color: white; padding: 3px;', data || '');
  };

  // Log when drawing is disabled/enabled
  useEffect(() => {
    debugLog(`Drawing ${isDisabled ? 'disabled' : 'enabled'}`, { isDisabled });
  }, [isDisabled]);

  // Use the isDisabled prop to control when drawing is allowed
  // Disable drawing when isDisabled is true
  // This should be applied to the canvas element or drawing functions

  return (
    <div className="flex flex-col h-full bg-white rounded-md overflow-hidden relative">
      {/* Drawing canvas */}
      <div className="relative flex-grow overflow-hidden">
        <canvas
          ref={canvasRef}
          className="block w-full h-full bg-white touch-none"
          style={{ cursor }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        
        {/* Word display for drawer */}
        {gameContext?.isDrawing && word && word.trim() !== "" && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white px-6 py-2 rounded-full font-bold shadow-lg text-lg">
            Draw: {word}
          </div>
        )}
        
        {/* Word selection prompt for drawer */}
        {gameContext?.isDrawing && gameContext?.hasWordOptions && !gameContext?.wordSelected && !gameContext?.roundEnded && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-500 text-white px-8 py-6 rounded-lg font-bold shadow-xl text-xl text-center">
            <div className="animate-bounce mb-4">👆</div>
            Select a word to draw!
            <div className="mt-2 text-base font-normal">
              Choose from the options above to begin drawing
            </div>
          </div>
        )}
        
        {/* Waiting message if not your turn */}
        {!gameContext?.isDrawing && !gameContext?.roundEnded && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-700 bg-opacity-80 text-white px-6 py-2 rounded-full font-medium shadow-lg">
            {getWaitingMessage()}
          </div>
        )}

        {/* Round ended message */}
        {gameContext?.roundEnded && word && word.trim() !== "" && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-indigo-600 bg-opacity-90 text-white px-8 py-4 rounded-lg font-bold shadow-xl text-xl text-center">
            Round Complete!
            <div className="text-lg font-normal mt-2">
              The word was: <span className="font-bold">{word}</span>
            </div>
          </div>
        )}
      </div>

      {/* Drawing controls - only show if you're the drawer and word has been selected */}
      {gameContext?.isDrawing && gameContext?.wordSelected && !gameContext?.roundEnded && (
        <div className="p-2 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Tools */}
            <div className="flex justify-center gap-1">
              <button
                onClick={() => setTool('pen')}
                className={`p-2 rounded ${tool === 'pen' ? 'bg-indigo-100 text-indigo-800' : 'hover:bg-gray-100'}`}
                title="Pen"
              >
                <Pencil size={20} />
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`p-2 rounded ${tool === 'eraser' ? 'bg-indigo-100 text-indigo-800' : 'hover:bg-gray-100'}`}
                title="Eraser"
              >
                <Eraser size={20} />
              </button>
              <button
                onClick={() => setTool('fill')}
                className={`p-2 rounded ${tool === 'fill' ? 'bg-indigo-100 text-indigo-800' : 'hover:bg-gray-100'}`}
                title="Fill"
              >
                <PaintBucket size={20} />
              </button>
              <button
                onClick={() => clearCanvas(true)}
                className="p-2 rounded hover:bg-gray-100"
                title="Clear Canvas"
              >
                <Trash2 size={20} />
              </button>
              <button
                onClick={undo}
                className={`p-2 rounded hover:bg-gray-100 ${currentStep <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Undo"
                disabled={currentStep <= 0}
              >
                <Undo size={20} />
              </button>
              <button
                onClick={redo}
                className={`p-2 rounded hover:bg-gray-100 ${currentStep >= history.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Redo"
                disabled={currentStep >= history.length - 1}
              >
                <Redo size={20} />
              </button>
            </div>

            {/* Sizes */}
            <div className="flex justify-center gap-1">
              {sizePresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setLineWidth(preset.size)}
                  className={`p-2 rounded ${lineWidth === preset.size ? 'bg-indigo-100 text-indigo-800' : 'hover:bg-gray-100'}`}
                  title={`${preset.label} Size`}
                >
                  <SizeIcon size={preset.size} />
                </button>
              ))}
            </div>

            {/* Color Palette */}
            <div className="flex flex-wrap justify-center gap-1">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-6 h-6 rounded-full ${selectedColor === color ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                  style={{ backgroundColor: color, border: color === '#FFFFFF' ? '1px solid #e2e8f0' : 'none' }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrawableCanvas;