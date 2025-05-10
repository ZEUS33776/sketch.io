import React, { useState, useEffect, useRef, useContext } from 'react';
import { getGuesses } from '../../services/guessAreaServices';
import { TargetContext, GameContext } from '../pages/MainCanvasPage';
import socket from './socket';
import { MessageCircle, CheckCircle } from 'lucide-react';
import safeToast from './utils/toastUtils';

const GuessArea = ({ disabled }) => {
  const [guess, setGuess] = useState('');
  const data = getGuesses();
  const [guesses, setGuesses] = useState(data);
  const guessListRef = useRef(null);
  const { word, isCorrectGuess, setCorrectGuess } = useContext(TargetContext);
  const gameContext = useContext(GameContext);
  const [user, setUser] = useState(localStorage.getItem("userName") || null);
  const [isDisabled, setIsDisabled] = useState(disabled || false);
  const [myCorrectGuessIndex, setMyCorrectGuessIndex] = useState(null);
  const [correctGuessHighlighted, setCorrectGuessHighlighted] = useState(false);

  // Debug helper
  const debugLog = (message, data) => {
    console.log(`%c[GuessArea] ${message}`, 'background: #10b981; color: white; padding: 3px;', data || '');
  };

  // Update disabled state when prop changes
  useEffect(() => {
    setIsDisabled(disabled || isCorrectGuess || gameContext?.allGuessedCorrectly);
  }, [disabled, isCorrectGuess, gameContext?.allGuessedCorrectly]);

  useEffect(() => {
    const handleGuessUpdate = (data) => {
      debugLog("Received guess:", data);
      setGuesses((prevGuesses) => [...prevGuesses, { user: data.user, guess: data.guess }]);
    };

    socket.on('guess', handleGuessUpdate);

    return () => {
      socket.off('guess', handleGuessUpdate);
    };
  }, []);

  // Reset guesses when round changes
  useEffect(() => {
    if (gameContext?.currentRound) {
      debugLog("New round, resetting guesses");
      setGuesses([]);
      setIsDisabled(false);
      setCorrectGuess(false);
      setMyCorrectGuessIndex(null);
      setCorrectGuessHighlighted(false);
    }
  }, [gameContext?.currentRound, setCorrectGuess]);

  // Reset guess state when word changes
  useEffect(() => {
    if (word && word !== '') {
      debugLog("Word changed, resetting guess state");
      // Only reset if I'm not the drawer
      if (!gameContext?.isDrawing) {
        setIsDisabled(false);
        setCorrectGuess(false);
        setMyCorrectGuessIndex(null);
        setCorrectGuessHighlighted(false);
      }
    }
  }, [word, gameContext?.isDrawing]);

  useEffect(() => {
    const handleUserUpdate = (data) => {
      if (data?.userName) {
        debugLog("Received userName:", data.userName);
        localStorage.setItem("userName", data.userName);
        setUser(data.userName);
      } else {
        console.warn("No userName received in data:", data);
      }
    };

    socket.on('getUserInfo', handleUserUpdate);
    
    // Request user info on component mount
    socket.emit('getUser');

    return () => {
      socket.off('getUserInfo', handleUserUpdate);
    };
  }, []);

  // Listen for round ended or all guessed correctly
  useEffect(() => {
    if (gameContext?.roundEnded || gameContext?.allGuessedCorrectly) {
      setIsDisabled(true);
      if (!isCorrectGuess && word && gameContext?.roundEnded) {
        safeToast.info(`The word was: "${word}"`);
      }
    } else {
      setIsDisabled(disabled || isCorrectGuess || !gameContext?.wordSelected);
    }
  }, [gameContext?.roundEnded, gameContext?.allGuessedCorrectly, gameContext?.wordSelected, disabled, isCorrectGuess, word]);

  useEffect(() => {
    // Listen for playerGuessedCorrectly event from server
    const handlePlayerGuessedCorrectly = (data) => {
      const currentUserName = localStorage.getItem("userName") || user;
      
      debugLog("Player guessed correctly event:", { data, currentUserName });
      
      if (data.user === currentUserName) {
        debugLog("I guessed correctly!");
        
        // Update state to show correct guess
        setCorrectGuess(true);
        setIsDisabled(true);
        setCorrectGuessHighlighted(true);
        
        // Find the index of the correct guess
        const correctIndex = guesses.findIndex(g => 
          g.user === currentUserName && 
          g.guess.trim().toLowerCase() === word.trim().toLowerCase()
        );
        
        debugLog("Setting correct guess index to:", correctIndex, "for word:", word);
        if (correctIndex >= 0) {
          setMyCorrectGuessIndex(correctIndex);
        } else {
          // If we can't find the guess, try again after a short delay
          // This could happen if the guess was just added and state hasn't updated yet
          setTimeout(() => {
            const newIndex = guesses.findIndex(g => 
              g.user === currentUserName && 
              g.guess.trim().toLowerCase() === word.trim().toLowerCase()
            );
            debugLog("Retrying to find correct guess, index:", newIndex);
            if (newIndex >= 0) {
              setMyCorrectGuessIndex(newIndex);
            }
          }, 200);
        }
        
        // Show confirmation toast
        safeToast.success("You guessed correctly!");
      }
    };
    
    socket.on('playerGuessedCorrectly', handlePlayerGuessedCorrectly);
    
    return () => {
      socket.off('playerGuessedCorrectly', handlePlayerGuessedCorrectly);
    };
  }, [user, setCorrectGuess, guesses, word]);

  const similar = (word1, word2) => {
    if (!word1 || !word2) return false;
    
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

  // Function to handle word selection
  const handleWordSelect = (selectedWord, index) => {
    const roomId = localStorage.getItem("roomId");
    
    debugLog('Word selected by user', { selectedWord, index });
    socket.emit("selectWord", { roomId, wordIndex: index });
    
    // The server will send the official selection via the wordSelected event
    safeToast.success(`You selected: ${selectedWord}`);
  };

  const handleIsCorrect = () => {
    debugLog("Handling correct guess");
    setCorrectGuess(true);
    setIsDisabled(true);
    setCorrectGuessHighlighted(true);
    
    // Emit correct guess to server
    const roomId = localStorage.getItem("roomId");
    socket.emit('correctGuess', {
      roomId: roomId,
      word: word
    });
    
    // Find the correct guess in the guess list
    const userName = localStorage.getItem("userName") || user;
    const correctIndex = guesses.findIndex(g => 
      g.user === userName && 
      g.guess.trim().toLowerCase() === word.trim().toLowerCase()
    );
    
    debugLog("Setting correct guess index to:", correctIndex);
    setMyCorrectGuessIndex(correctIndex);
    
    // Force highlight on next render
    setTimeout(() => {
      setCorrectGuessHighlighted(true);
    }, 50);
    
    safeToast.success("You guessed correctly!");
  };

  const handleGuess = () => {
    const roomId = localStorage.getItem("roomId");
    const trimmedGuess = guess.trim();
    const userName = localStorage.getItem("userName") || user;
    
    if (!trimmedGuess || !userName || isDisabled) {
      return;
    }
    
    debugLog("Sending guess:", trimmedGuess);
    
    // Emit guess to server
    socket.emit('guess', {
      roomId: roomId,
      guess: trimmedGuess
    });
    
    // Add guess to local display immediately
    const newGuess = { user: userName, guess: trimmedGuess };
    const newGuesses = [...guesses, newGuess];
    setGuesses(newGuesses);
    
    // Check if correct - compare case-insensitive and trimmed
    if (word && trimmedGuess.toLowerCase() === word.trim().toLowerCase()) {
      debugLog("Guess is correct!");
      // We need to wait for the guess to be added to the state before handling correct
      setTimeout(() => {
        handleIsCorrect();
      }, 100);
    }
    
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

  useEffect(() => {
    if (guessListRef.current) {
      guessListRef.current.scrollTop = guessListRef.current.scrollHeight;
    }
  }, [guesses]);

  const currentUser = user || localStorage.getItem("userName") || '';
  
  const getPlaceholderText = () => {
    if (isCorrectGuess) {
      return "You guessed correctly!";
    } else if (gameContext?.allGuessedCorrectly) {
      return "Everyone guessed correctly!";
    } else if (gameContext?.roundEnded) {
      return "Round ended. Waiting for next round...";
    } else if (!gameContext?.wordSelected) {
      if (gameContext?.currentDrawer) {
        return `Waiting for ${gameContext.currentDrawer} to select a word...`;
      }
      return "Waiting for word selection...";
    } else if (gameContext?.isDrawing) {
      return "You're the drawer! Others are guessing.";
    } else if (gameContext?.currentDrawer) {
      return `Guess what ${gameContext.currentDrawer} is drawing...`;
    } else {
      return "Type your guess here...";
    }
  };

  // Information tooltip about scoring
  const renderScoringInfo = () => {
    const infoText = gameContext?.isDrawing 
      ? "You'll earn up to 200 points based on how many players guess correctly and how fast they guess."
      : "Guess quickly to earn more points! You can earn up to 200 points.";
    
    return (
      <div className="flex items-center justify-center">
        <div className="absolute bottom-14 text-xs px-3 py-2 bg-indigo-100 text-indigo-700 rounded-md shadow-sm mb-1 max-w-[90%] text-center">
          {infoText}
        </div>
      </div>
    );
  };

  // Add a special effect to handle resetting correctGuessHighlighted
  useEffect(() => {
    if (isCorrectGuess) {
      debugLog("Detected isCorrectGuess is true, ensuring highlighting is shown");
      setCorrectGuessHighlighted(true);
      setIsDisabled(true);
      
      // Find my correct guess in the list if we haven't already
      if (myCorrectGuessIndex === null) {
        const userName = localStorage.getItem("userName") || user;
        const index = guesses.findIndex(g => 
          g.user === userName && 
          g.guess.trim().toLowerCase() === word?.trim().toLowerCase()
        );
        
        if (index >= 0) {
          debugLog(`Found my correct guess at index ${index}`);
          setMyCorrectGuessIndex(index);
        }
      }
    }
  }, [isCorrectGuess, myCorrectGuessIndex, guesses, word, user]);
  
  // Add a broader listener for all guesses to highlight correct ones
  useEffect(() => {
    // Check all guesses in case any match the word
    if (word && guesses.length > 0) {
      const userName = localStorage.getItem("userName") || user;
      
      // Look for my own correct guess
      const myGuessIndex = guesses.findIndex(g => 
        g.user === userName && 
        g.guess.trim().toLowerCase() === word.trim().toLowerCase()
      );
      
      if (myGuessIndex >= 0 && !isCorrectGuess) {
        debugLog(`Found my correct guess at index ${myGuessIndex} but isCorrectGuess is false. Fixing...`);
        setCorrectGuess(true);
        setCorrectGuessHighlighted(true);
        setMyCorrectGuessIndex(myGuessIndex);
        setIsDisabled(true);
      }
    }
  }, [guesses, word, user, isCorrectGuess, setCorrectGuess]);
  
  // Force-highlight correct guesses when round ends
  useEffect(() => {
    if (gameContext?.roundEnded && word) {
      debugLog("Round ended, highlighting correct guesses");
      
      // If I had a correct guess, make sure it's highlighted
      const userName = localStorage.getItem("userName") || user;
      const myGuessIndex = guesses.findIndex(g => 
        g.user === userName && 
        g.guess.trim().toLowerCase() === word.trim().toLowerCase()
      );
      
      if (myGuessIndex >= 0) {
        setCorrectGuess(true);
        setMyCorrectGuessIndex(myGuessIndex);
        setCorrectGuessHighlighted(true);
      }
    }
  }, [gameContext?.roundEnded, guesses, word, user, setCorrectGuess]);

  return (
    <div className="flex flex-col h-full">
      {/* Correct guess banner */}
      {(isCorrectGuess || correctGuessHighlighted) && (
        <div className="bg-green-500 text-white py-2 px-4 flex items-center justify-center font-medium">
          <CheckCircle className="mr-2" size={16} />
          You guessed correctly!
        </div>
      )}
      
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-indigo-600" />
          <h3 className="text-sm font-medium">Guesses</h3>
        </div>
        {guesses.length > 0 && (
          <span className="text-xs text-gray-500">{guesses.length} message{guesses.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      
      <div ref={guessListRef} className="overflow-y-auto flex-1 p-1">
        {guesses.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm italic">
            No guesses yet
          </div>
        )}
        
        {guesses.map((guess, index) => {
          const isCurrentUser = currentUser === guess.user;
          const isCorrectWord = word && guess.guess.trim().toLowerCase() === word.trim().toLowerCase();
          const isCloseGuess = similar(word, guess.guess);
          
          // Determine if we should show this is a correct guess
          // Only hide correct guesses from the drawer until round ends
          // Everyone else should see correct guesses
          const showAsCorrect = isCorrectWord && (
            !gameContext?.isDrawing || // I'm not the drawer
            gameContext?.roundEnded || // Round has ended
            gameContext?.allGuessedCorrectly // All players guessed correctly
          );
          
          // Highlight scenarios:
          // 1. This is the user's guess and it matches the word exactly (case insensitive)
          const isUserCorrectGuess = isCurrentUser && isCorrectWord;
          
          // 2. This is the specific index that was marked correct by the server
          const isHighlightedByServer = isCurrentUser && index === myCorrectGuessIndex;
          
          // 3. This user's guess is correct and either they've been highlighted or the context says they're correct
          const isUserHighlightedCorrect = isCurrentUser && isCorrectWord && (correctGuessHighlighted || isCorrectGuess);
          
          // Apply highlight if any condition is true:
          // - If I'm not the drawer, show all correct guesses
          // - If I am the drawer, only show at end of round
          const shouldHighlight = (isUserCorrectGuess || isHighlightedByServer || isUserHighlightedCorrect) && (
            !gameContext?.isDrawing || 
            gameContext?.roundEnded ||
            gameContext?.allGuessedCorrectly
          );
          
          debugLog(`Guess ${index}:`, { 
            guess: guess.guess, 
            isCurrentUser, 
            isCorrectWord, 
            myCorrectGuessIndex, 
            shouldHighlight,
            correctGuessHighlighted,
            isCorrectGuess,
            isDrawer: gameContext?.isDrawing
          });
          
          return (
            <div
              key={index}
              className={`my-1 px-3 py-2 rounded-lg max-w-[85%] ${
                shouldHighlight ? 'bg-green-500 text-white' : 
                isCurrentUser ? 'ml-auto bg-indigo-500 text-white' : 'bg-gray-100 text-gray-800'
              } ${showAsCorrect && !isCurrentUser ? '!bg-green-500 !text-white' : ''} ${
                isCloseGuess && !isCorrectWord && !gameContext?.isDrawing ? '!bg-yellow-400 !text-gray-800' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs truncate max-w-[80px]">
                  {isCurrentUser ? 'You' : guess.user}:
                </span>
                <span className={`text-sm ${shouldHighlight || (showAsCorrect && !isCurrentUser) ? 'text-white font-medium' : 
                  isCurrentUser ? 'text-white' : 'text-gray-700'} ${
                  isCloseGuess && !isCorrectWord && !gameContext?.isDrawing ? '!text-gray-800 font-medium' : ''}`}>
                  {guess.guess}
                </span>
                {(shouldHighlight || showAsCorrect) && (
                  <CheckCircle size={14} className="text-white ml-1" />
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="relative p-2">
        {gameContext?.wordSelected && !isDisabled && <div className="h-4">{renderScoringInfo()}</div>}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={guess}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholderText()}
            disabled={isDisabled || isCorrectGuess || gameContext?.allGuessedCorrectly || gameContext?.isDrawing || !gameContext?.wordSelected}
            className="flex-grow bg-gray-50 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleGuess}
            disabled={!guess.trim() || isDisabled || isCorrectGuess || gameContext?.allGuessedCorrectly || gameContext?.isDrawing || !gameContext?.wordSelected}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuessArea;