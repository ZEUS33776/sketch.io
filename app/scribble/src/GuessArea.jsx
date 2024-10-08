import React, { useState, useEffect, useRef } from 'react';
import { getGuesses } from '../services/guessAreaServices';

const GuessArea = () => {
  const [guess, setGuess] = useState('');
  const data = getGuesses();
  const [guesses, setGuesses] = useState(data);
  const guessListRef = useRef(null); // Create a ref for the guess list container

  const handleGuess = () => {
    setGuesses([...guesses, { user: 'test', guess }]);
    setGuess('');
  };

  const handleChange = (e) => {
    setGuess(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleGuess();
    }
  };

  // Scroll to the bottom of the guess list when a new guess is added
  useEffect(() => {
    if (guessListRef.current) {
      guessListRef.current.scrollTop = guessListRef.current.scrollHeight;
    }
  }, [guesses]);

  return (
    <div className="flex flex-col pt-1 justify-between h-full">
      {/* Scrollable guesses container */}
      <div
        ref={guessListRef} // Attach ref to the div
        className="overflow-y-auto h-full border-b-2 hide-scrollbar"
      >
        {guesses.map((guess, index) => (
          <div
            key={index}
            className={`flex gap-2 pl-4 py-1  ${
              index % 2 === 1 ? 'bg-[#ececec]' : 'bg-[#ffffff]'
            }`}
          >
            <b>{guess.user}:</b>
            <span>{guess.guess}</span>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="flex gap-1 justify-end p-2 w-full">
        <input
          type="text"
          value={guess}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter your guess"
          className="p-2 border-2 rounded-md w-full"
        />
      </div>
    </div>
  );
};

export default GuessArea;
