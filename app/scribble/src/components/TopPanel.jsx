import React, { useContext } from 'react';
import { GameContext } from '../pages/MainCanvasPage';
import { Clock, Users, Award, Pencil } from 'lucide-react';

const TopPanel = () => {
  const gameContext = useContext(GameContext);
  
  if (!gameContext) return null;
  
  const { 
    currentRound, 
    totalRounds, 
    roundTime, 
    isDrawing, 
    roundEnded, 
    allGuessedCorrectly,
    wordSelected,
    hasWordOptions,
    currentDrawer
  } = gameContext;
  
  // Get game status message
  const getGameStatus = () => {
    if (roundEnded) {
      return "Round ended";
    } else if (allGuessedCorrectly) {
      return "All players guessed correctly!";
    } else if (isDrawing && hasWordOptions && !wordSelected) {
      return "Choose a word to draw";
    } else if (isDrawing && wordSelected) {
      return "Your turn to draw";
    } else if (!isDrawing && !wordSelected && currentDrawer) {
      return `Waiting for ${currentDrawer} to select a word`;
    } else if (!isDrawing && wordSelected && currentDrawer) {
      return `${currentDrawer} is drawing - Guess what it is!`;
    } else if (!isDrawing && currentDrawer) {
      return `${currentDrawer}'s turn to draw`;
    } else {
      return "Waiting...";
    }
  };
  
  // Get status color
  const getStatusColor = () => {
    if (roundEnded) {
      return "bg-red-100 text-red-700 border-red-200";
    } else if (allGuessedCorrectly) {
      return "bg-green-100 text-green-700 border-green-200";
    } else if (isDrawing && hasWordOptions && !wordSelected) {
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    } else if (isDrawing && wordSelected) {
      return "bg-indigo-100 text-indigo-700 border-indigo-200";
    } else if (!wordSelected) {
      return "bg-amber-100 text-amber-700 border-amber-200";
    } else {
      return "bg-blue-100 text-blue-700 border-blue-200";
    }
  };
  
  return (
    <div className="bg-gray-100 border-b border-gray-200 px-4 py-2">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Round info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
            <Award size={16} className="text-indigo-600" />
            <span className="text-sm font-medium">Round</span>
            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {currentRound}/{totalRounds}
            </span>
          </div>
          
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
            <Clock size={16} className="text-indigo-600" />
            <span className="text-sm font-medium">{roundTime}s per round</span>
          </div>
          
          {currentDrawer && !isDrawing && (
            <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
              <Pencil size={16} className="text-indigo-600" />
              <span className="text-sm font-medium">
                {currentDrawer} is drawing
              </span>
            </div>
          )}
        </div>
        
        {/* Game status */}
        <div className={`px-4 py-1.5 rounded-full border ${getStatusColor()} text-sm font-medium`}>
          {getGameStatus()}
        </div>
      </div>
    </div>
  );
};

export default TopPanel;
