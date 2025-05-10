import React from "react";
import { CountdownCircleTimer } from "react-countdown-circle-timer";
import "../clock/clock.css"

const Clock = ({ duration, initialRemainingTime, colors, colorsTime, onComplete, isPlaying = false, size = 120, strokeWidth = 12 }) => {
  // Only use props for timer control
  const renderTime = ({ remainingTime }) => (
    <div className="time-wrapper">
      <div className="time">{remainingTime}</div>
    </div>
  );

  return (
    <div className="text-gray-900 font-bold relative">
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-80 rounded-full z-10">
          <span className="text-xs text-gray-500">Waiting...</span>
        </div>
      )}
      <CountdownCircleTimer
        key={`timer-${initialRemainingTime}`}
        isPlaying={isPlaying}
        duration={duration}
        initialRemainingTime={initialRemainingTime}
        colors={colors}
        colorsTime={colorsTime}
        strokeWidth={strokeWidth}
        size={size}
        isSmoothColorTransition={true}
        onComplete={onComplete}
        trailColor="#f3f4f6"
      >
        {renderTime}
      </CountdownCircleTimer>
    </div>
  );
};

export default Clock;
