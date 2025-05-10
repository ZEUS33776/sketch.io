import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
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
        
        // Show confirmation toast
        safeToast.success(`You guessed correctly! +${data.points} points!`);
        
        // Force highlight of the correct guess
        setCorrectGuessHighlighted(true);
        
        // Find all guesses by the current user
        const userGuesses = guesses.filter(g => g.user === currentUserName);
        if (userGuesses.length > 0) {
          // Find the guess that matches the word (if any)
          const correctGuessIndex = guesses.findIndex(g => 
            g.user === currentUserName && 
            g.guess.trim().toLowerCase() === word.trim().toLowerCase()
          );
          
          debugLog("Setting correct guess index to:", correctGuessIndex, "for word:", word);
          
          if (correctGuessIndex >= 0) {
            setMyCorrectGuessIndex(correctGuessIndex);
          } else {
            // If we can't find the correct guess, use the last guess by this user
            const lastUserGuessIndex = guesses.length - 1;
            for (let i = guesses.length - 1; i >= 0; i--) {
              if (guesses[i].user === currentUserName) {
                debugLog("Using last user guess at index:", i);
                setMyCorrectGuessIndex(i);
                break;
              }
            }
          }
        }
      } else {
        // Another player guessed correctly
        debugLog(`${data.user} guessed correctly`);
        
        // If all guesses are correct, disable the input
        if (data.allGuessedCorrectly) {
          debugLog("All players guessed correctly, disabling input");
          setIsDisabled(true);
        }
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
    debugLog("Handling correct guess for", { word });
    
    // Update local state
    setCorrectGuess(true);
    setIsDisabled(true);
    setCorrectGuessHighlighted(true);
    
    // Find the correct guess in the guess list
    const userName = localStorage.getItem("userName") || user;
    
    // Look through all guesses to find the user's correct one
    let correctGuessFound = false;
    for (let i = guesses.length - 1; i >= 0; i--) {
      const g = guesses[i];
      if (g.user === userName && g.guess.trim().toLowerCase() === word.trim().toLowerCase()) {
        debugLog("Found correct guess at index", i);
        setMyCorrectGuessIndex(i);
        correctGuessFound = true;
        break;
      }
    }
    
    // If we couldn't find an exact match, use the most recent guess by this user
    if (!correctGuessFound) {
      for (let i = guesses.length - 1; i >= 0; i--) {
        if (guesses[i].user === userName) {
          debugLog("Using most recent guess at index", i);
          setMyCorrectGuessIndex(i);
          break;
        }
      }
    }
    
    // Show success toast with points
    safeToast.success("You guessed correctly!");
    
    // Emit correct guess to server
    const roomId = localStorage.getItem("roomId");
    socket.emit('correctGuess', {
      roomId: roomId,
      word: word
    });
  };

  const handleGuess = () => {
    const roomId = localStorage.getItem("roomId");
    const trimmedGuess = guess.trim();
    const userName = localStorage.getItem("userName") || user;
    
    if (!trimmedGuess || !userName || isDisabled) {
      return;
    }
    
    debugLog("Sending guess:", trimmedGuess);
    
    // Add guess to local display immediately
    const newGuess = { user: userName, guess: trimmedGuess };
    const newGuesses = [...guesses, newGuess];
    setGuesses(newGuesses);
    
    // Check if correct - compare case-insensitive and trimmed
    // Store in a variable to use later
    const isCorrect = word && trimmedGuess.toLowerCase() === word.trim().toLowerCase();
    debugLog("Is guess correct?", { isCorrect, guess: trimmedGuess, word });
    
    // Always send the guess to the server, which will broadcast it to other clients
    socket.emit('guess', {
      roomId: roomId,
      guess: trimmedGuess
    });
    
    // Clear input field immediately
    setGuess('');
    
    // If correct, handle the correct guess (after a short delay to ensure state updates)
    if (isCorrect) {
      debugLog("Correct guess, handling...");
      // Use a short timeout to ensure the guess is added to the list first
      setTimeout(() => {
        handleIsCorrect();
      }, 50);
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

  // Function to highlight newly received guesses that match the word
  const checkAndMarkCorrectGuesses = useCallback(() => {
    if (word && guesses.length > 0) {
      const userName = localStorage.getItem("userName") || user;
      
      // Scan all guesses, looking for correct ones
      for (let i = 0; i < guesses.length; i++) {
        const g = guesses[i];
        if (g.user === userName && g.guess.trim().toLowerCase() === word.trim().toLowerCase()) {
          if (!isCorrectGuess) {
            debugLog(`Found my correct guess at index ${i} but isCorrectGuess is false. Setting correct...`);
            setCorrectGuess(true);
            setCorrectGuessHighlighted(true);
            setMyCorrectGuessIndex(i);
            setIsDisabled(true);
            
            // Notify the server
            const roomId = localStorage.getItem("roomId");
            socket.emit('correctGuess', {
              roomId: roomId,
              word: word
            });
          } else if (myCorrectGuessIndex === null) {
            // We already know it's correct, but index isn't set
            debugLog(`Found my correct guess at index ${i} and updating the index`);
            setMyCorrectGuessIndex(i);
          }
          break;
        }
      }
    }
  }, [guesses, word, user, isCorrectGuess, myCorrectGuessIndex, setCorrectGuess]);
  
  // Add a broader listener for all guesses to highlight correct ones
  useEffect(() => {
    checkAndMarkCorrectGuesses();
  }, [guesses, word, checkAndMarkCorrectGuesses]);
  
  // Force-highlight correct guesses when round ends
  useEffect(() => {
    if (gameContext?.roundEnded && word) {
      debugLog("Round ended, highlighting correct guesses");
      checkAndMarkCorrectGuesses();
    }
  }, [gameContext?.roundEnded, checkAndMarkCorrectGuesses]);

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
          
          // Apply highlight if any condition is true
          const shouldHighlight = showAsCorrect || isUserCorrectGuess || isHighlightedByServer;
          
          debugLog(`Rendering guess ${index}:`, { 
            guess: guess.guess, 
            user: guess.user,
            isCurrentUser, 
            isCorrectWord, 
            myCorrectGuessIndex, 
            shouldHighlight,
            isCorrectGuess,
            showAsCorrect
          });
          
          return (
            <div
              key={index}
              className={`my-1 px-3 py-2 rounded-lg max-w-[85%] ${
                shouldHighlight 
                  ? 'bg-green-500 text-white border-2 border-green-600 font-medium shadow-md' 
                  : isCurrentUser 
                    ? 'ml-auto bg-indigo-500 text-white' 
                    : 'bg-gray-100 text-gray-800'
              } ${
                isCloseGuess && !isCorrectWord && !gameContext?.isDrawing 
                  ? 'bg-yellow-400 text-gray-800 border border-yellow-500' 
                  : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs truncate max-w-[80px]">
                  {isCurrentUser ? 'You' : guess.user}:
                </span>
                <span className="text-sm">
                  {guess.guess}
                </span>
                {shouldHighlight && (
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