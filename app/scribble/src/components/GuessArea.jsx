import React, { useState, useEffect, useRef, useContext } from 'react';
import { getGuesses } from '../../services/guessAreaServices';
import { TargetContext } from '../pages/MainCanvasPage';

const GuessArea = () => {
  const [guess, setGuess] = useState('');
  const data = getGuesses();
  const [guesses, setGuesses] = useState(data);
  const guessListRef = useRef(null);
  const { word, isCorrectGuess, setCorrectGuess } = useContext(TargetContext);

  const similar = (word1, word2) => {
    word1 = word1.trim().toLowerCase();
    word2 = word2.trim().toLowerCase();
    if (word1.length !== word2.length) {
      return false;
    }
    let flag = 0;
    for (let i = 0; i < word1.length; i++) {
      if (word1[i] !== word2[i]) {
        flag += 1;
      }
      if (flag > 1) {
        return false;
      }
    }
    return flag === 1;
  };

  const handleIsCorrect = () => {
    setCorrectGuess(true);
  };

  const handleGuess = () => {
    const trimmedGuess = guess.trim();
    if (trimmedGuess.length > 0) {
      setGuesses((prevGuesses) => [...prevGuesses, { user: 'test', guess: trimmedGuess }]);
      if (trimmedGuess.toLowerCase() === word.trim().toLowerCase()) {
        handleIsCorrect();
      }
      setGuess('');
    }
  };

  const handleChange = (e) => {
    setGuess(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleGuess();
    }
  };

  useEffect(() => {
    if (guessListRef.current) {
      guessListRef.current.scrollTop = guessListRef.current.scrollHeight;
    }
  }, [guesses]);

  return (
    <div className="flex flex-col pt-1 justify-between h-full">
      <div ref={guessListRef} className="overflow-y-auto h-full border-b-2 hide-scrollbar">
        {guesses.map((guess, index) => (
          <div
            key={index}
            className={`flex gap-2 pl-4 py-1 ${index % 2 === 1 ? 'bg-[#ececec]' : 'bg-[#ffffff]'}
            ${similar(word, guess.guess) ? 'text-orange-500' : ''}
            ${guess.guess.trim().toLowerCase() === word.trim().toLowerCase() ? 'text-green-600' : ''}`}
          >
            <b>{guess.user}:</b>
            <span>
              {guess.guess}  
              {similar(word, guess.guess) ? ' was close!' : ''} 
              {guess.guess.trim().toLowerCase() === word.trim().toLowerCase() ? ' was correct!' : ''}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-1 justify-end p-2 w-full">
        <input
          type="text"
          value={guess}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Enter your guess"
          className="p-2 border-2 rounded-md w-full focus:outline-none"
        />
      </div>
    </div>
  );
};

export default GuessArea;