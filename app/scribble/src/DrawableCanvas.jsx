import React, { useRef, useState, useEffect } from 'react';

// Utility function to convert hex color to RGB
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

// Utility functions for pixel manipulation
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
  imageData.data[index + 3] = 255; // Full opacity
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

// Flood fill implementation
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

const DrawableCanvas = () => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#FF0000');
  const [tool, setTool] = useState('pen');
  const [lineWidth, setLineWidth] = useState(2);
  const [cursor, setCursor] = useState('default');
  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const maxHistory = 50;
  const lastCoordRef = useRef(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      // Set initial canvas properties
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = penColor;
      ctx.lineWidth = lineWidth;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Fill with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }

    resizeCanvas();
    ctxRef.current = ctx;
    saveState();

    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Update canvas properties when tools change
  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = tool === 'eraser' ? '#FFFFFF' : penColor;
      ctxRef.current.lineWidth = tool === 'eraser' ? lineWidth * 2 : lineWidth;
    }
  }, [penColor, tool, lineWidth]);

  // Update cursor based on selected tool
  useEffect(() => {
    switch (tool) {
      case 'pen':
        setCursor(
          `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="black" stroke="white" stroke-width="1"/></svg>') 8 8, crosshair`
        );
        break;
      case 'eraser':
        setCursor(
          `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 16 16"><rect x="4" y="4" width="8" height="8" fill="white" stroke="black" stroke-width="1"/></svg>') 8 8, crosshair`
        );
        break;
      case 'fill':
        setCursor('crosshair');
        break;
      default:
        setCursor('default');
    }
  }, [tool]);

  // History management functions
  const saveState = () => {
    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL('image/png');
    const newHistory = history.slice(0, currentStep + 1);

    if (newHistory.length >= maxHistory) {
      newHistory.shift();
    }

    setHistory([...newHistory, imageData]);
    setCurrentStep(Math.min(currentStep + 1, maxHistory - 1));
  };

  const loadState = (imageData) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const img = new Image();

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        img,
        0,
        0,
        canvas.width / window.devicePixelRatio,
        canvas.height / window.devicePixelRatio
      );
    };

    img.src = imageData;
  };

  const undo = () => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      loadState(history[newStep]);
    }
  };

  const redo = () => {
    if (currentStep < history.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      loadState(history[newStep]);
    }
  };

  // Drawing helper functions
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Handle both mouse and touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: Math.floor((clientX - rect.left) * dpr),
      y: Math.floor((clientY - rect.top) * dpr),
    };
  };

  // Drawing event handlers
  const startDrawing = (e) => {
    e.preventDefault(); // Prevent scrolling on mobile
    const coords = getCoordinates(e);

    if (tool === 'pen' || tool === 'eraser') {
      ctxRef.current.beginPath();
      ctxRef.current.moveTo(
        coords.x / window.devicePixelRatio,
        coords.y / window.devicePixelRatio
      );
      lastCoordRef.current = coords;
      setIsDrawing(true);
    } else if (tool === 'fill') {
      floodFill(canvasRef.current, coords.x, coords.y, fillColor);
      saveState();
    }
  };

  const draw = (e) => {
    e.preventDefault(); // Prevent scrolling on mobile
    if (!isDrawing || (tool !== 'pen' && tool !== 'eraser')) return;

    const coords = getCoordinates(e);
    const ctx = ctxRef.current;
    const lastCoord = lastCoordRef.current;
    const dpr = window.devicePixelRatio || 1;

    if (lastCoord) {
      ctx.beginPath();
      ctx.moveTo(lastCoord.x / dpr, lastCoord.y / dpr);
      ctx.lineTo(coords.x / dpr, coords.y / dpr);
      ctx.stroke();
    }

    lastCoordRef.current = coords;
  };

  const stopDrawing = () => {
    if (isDrawing) {
      ctxRef.current.closePath();
      setIsDrawing(false);
      lastCoordRef.current = null;
      saveState();
    }
  };

  return (
    <div className="flex flex-col items-center p-4 h-full w-full">
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <label className="flex items-center">
          <span className="mr-2">Pen Color:</span>
          <input
            type="color"
            value={penColor}
            onChange={(e) => setPenColor(e.target.value)}
            className="w-8 h-8 border rounded"
            disabled={tool === 'eraser'}
          />
        </label>
        <label className="flex items-center">
          <span className="mr-2">Fill Color:</span>
          <input
            type="color"
            value={fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            className="w-8 h-8 border rounded"
            disabled={tool !== 'fill'}
          />
        </label>
        <label className="flex items-center">
          <span className="mr-2">Line Width:</span>
          <input
            type="range"
            min="1"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(parseInt(e.target.value))}
            className="w-32"
          />
          <span className="ml-2">{lineWidth}px</span>
        </label>
        <select
          value={tool}
          onChange={(e) => setTool(e.target.value)}
          className="border rounded p-2 shadow"
        >
          <option value="pen">Pen</option>
          <option value="eraser">Eraser</option>
          <option value="fill">Fill Tool</option>
        </select>
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={currentStep <= 0}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Undo
          </button>
          <button
            onClick={redo}
            disabled={currentStep >= history.length - 1}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Redo
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        style={{ cursor }}
        className="border shadow-md rounded bg-white w-full max-w-[800px] h-[500px] touch-none"
      />
    </div>
  );
};

export default DrawableCanvas;
