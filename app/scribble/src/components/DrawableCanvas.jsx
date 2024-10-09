import React, { useRef, useState, useEffect } from 'react';
import { Pencil, Eraser, PaintBucket, Undo, Redo } from 'lucide-react';

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

const DrawableCanvas = () => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedColor, setSelectedColor] = useState(colorPalette[0]);
  const [tool, setTool] = useState('pen');
  const [lineWidth, setLineWidth] = useState(sizePresets[0].size);
  const [cursor, setCursor] = useState('default');
  const [history, setHistory] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const maxHistory = 50;
  const lastCoordRef = useRef(null);

  // Generate custom cursor SVG
  const generateCursor = (tool, color, size) => {
    const cursorSize =
      sizePresets.find((preset) => preset.size === lineWidth)?.cursorSize || 3;
    let svg = '';

    if (tool === 'pen') {
      svg = `
        <svg xmlns="http://www.w3.org/2000/svg" height="${cursorSize * 2}" width="${cursorSize * 2}" viewBox="0 0 ${cursorSize * 2} ${cursorSize * 2}">
          <circle cx="${cursorSize}" cy="${cursorSize}" r="${cursorSize}" fill="${color}" stroke="white" stroke-width="1"/>
        </svg>
      `;
    } else if (tool === 'eraser') {
      svg = `
        <svg xmlns="http://www.w3.org/2000/svg" height="${cursorSize * 2}" width="${cursorSize * 2}" viewBox="0 0 ${cursorSize * 2} ${cursorSize * 2}">
          <rect x="${cursorSize - cursorSize / 2}" y="${cursorSize - cursorSize / 2}" width="${cursorSize}" height="${cursorSize}" fill="white" stroke="black" stroke-width="1"/>
        </svg>
      `;
    } else if (tool === 'fill') {
      svg = `
        <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 16 16">
          <path d="M8 0L16 8L8 16L0 8L8 0Z" fill="${color}" stroke="white" stroke-width="1"/>
        </svg>
      `;
    }

    return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${cursorSize} ${cursorSize}, crosshair`;
  };

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

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = lineWidth;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }

    resizeCanvas();
    ctxRef.current = ctx;
    saveState();

    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Update cursor and context when tool, color, or size changes
  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle =
        tool === 'eraser' ? '#FFFFFF' : selectedColor;
      ctxRef.current.lineWidth = tool === 'eraser' ? lineWidth * 2 : lineWidth;
    }

    setCursor(generateCursor(tool, selectedColor, lineWidth));
  }, [tool, selectedColor, lineWidth]);

  // Drawing functions
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: Math.floor((clientX - rect.left) * dpr),
      y: Math.floor((clientY - rect.top) * dpr),
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
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
      floodFill(canvasRef.current, coords.x, coords.y, selectedColor);
      saveState();
    }
  };

  const draw = (e) => {
    e.preventDefault();
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

  // Size icon component
  const SizeIcon = ({ size }) => (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r={size / 2} fill="currentColor" />
    </svg>
  );

  return (
    <div className="flex flex-col items-center h-full w-full">
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

      {/* Updated Container */}
      <div className="flex justify-between gap-4 w-full max-w-[800px] items-center mt-4 mb-4">
        {/* Color Palette */}
        <div className="flex gap-2 flex-wrap max-w-[300px]">
          {colorPalette.map((color) => (
            <button
              key={color}
              onClick={() => setSelectedColor(color)}
              className={`w-8 h-8 rounded-lg border-2 transition-transform ${
                selectedColor === color
                  ? 'scale-110 border-blue-500'
                  : 'border-gray-300'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>

        {/* Tool Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => setTool('pen')}
            className={`p-2 rounded ${tool === 'pen' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            title="Pen Tool"
          >
            <Pencil size={24} />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`p-2 rounded ${tool === 'eraser' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            title="Eraser Tool"
          >
            <Eraser size={24} />
          </button>
          <button
            onClick={() => setTool('fill')}
            className={`p-2 rounded ${tool === 'fill' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            title="Fill Tool"
          >
            <PaintBucket size={24} />
          </button>
        </div>

        {/* Size Presets */}
        <div className="flex gap-2">
          {sizePresets.map((preset) => (
            <button
              key={preset.size}
              onClick={() => setLineWidth(preset.size)}
              className={`p-2 rounded ${
                lineWidth === preset.size
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200'
              }`}
              title={`${preset.label} (${preset.size}px)`}
            >
              <SizeIcon size={preset.size} />
            </button>
          ))}
        </div>

        {/* Undo/Redo Buttons */}
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={currentStep <= 0}
            className="p-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo size={24} />
          </button>
          <button
            onClick={redo}
            disabled={currentStep >= history.length - 1}
            className="p-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Redo size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrawableCanvas;
