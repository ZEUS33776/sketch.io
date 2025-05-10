import React, { useRef, useState, useEffect } from "react";
import { CountdownCircleTimer } from "react-countdown-circle-timer";
import "../clock/clock.css"

const Clock = ({ duration, colors, colorsTime, onComplete, isPlaying = false, size = 120, strokeWidth = 12 }) => {
  // Use a key state to force reset when needed
  const [timerKey, setTimerKey] = useState(0);
  
  // Force timer re-render when isPlaying changes
  useEffect(() => {
    if (!isPlaying) {
      // Force a reset of the timer when it stops
      setTimerKey(prev => prev + 1);
    }
  }, [isPlaying]);
  
  const renderTime = ({ remainingTime }) => {
    const currentTime = useRef(remainingTime);
    const prevTime = useRef(null);
    const isNewTimeFirstTick = useRef(false);
    const [, setOneLastRerender] = useState(0);

    if (currentTime.current !== remainingTime) {
      isNewTimeFirstTick.current = true;
      prevTime.current = currentTime.current;
      currentTime.current = remainingTime;
    } else {
      isNewTimeFirstTick.current = false;
    }

    // force one last re-render when the time is over to trigger the last animation
    if (remainingTime === 0) {
      setTimeout(() => {
        setOneLastRerender((val) => val + 1);
      }, 20);
    }

    const isTimeUp = isNewTimeFirstTick.current;

    return (
      <div className="time-wrapper">
        <div key={remainingTime} className={`time ${isTimeUp ? "up" : ""}`}>
          {remainingTime}
        </div>
        {prevTime.current !== null && (
          <div
            key={prevTime.current}
            className={`time ${!isTimeUp ? "down" : ""}`}
          >
            {prevTime.current}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="text-gray-900 font-bold relative">
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-80 rounded-full z-10">
          <span className="text-xs text-gray-500">Waiting...</span>
        </div>
      )}
      <CountdownCircleTimer
        key={`timer-${timerKey}-${isPlaying ? 'playing' : 'paused'}`}
        isPlaying={isPlaying}
        duration={duration}
        colors={colors}
        colorsTime={colorsTime}
        strokeWidth={strokeWidth}
        size={size}
        isSmoothColorTransition={true}
        onComplete={onComplete}
      >
        {renderTime}
      </CountdownCircleTimer>
    </div>
  );
};

export default Clock;
