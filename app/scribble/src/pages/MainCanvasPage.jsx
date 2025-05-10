import React, { createContext, useState, useEffect, useMemo, useCallback } from "react";
import DrawableCanvas from "../components/DrawableCanvas";
import { target } from "../components/data";
import Header from "../components/Header";
import TopPanel from "../components/TopPanel";
import LeaderBoard from "../components/LeaderBoard";
import GuessArea from "../components/GuessArea";
import Clock from "../components/clock/CountdownCircleTimer";
import WordModal from "../components/wordsModal";
import socket from "../components/socket";
import safeToast from "../components/utils/toastUtils";
import { toast } from "react-hot-toast";

// Fix context initialization with default values
export const TargetContext = createContext({
    word: "",
    setWord: () => {},
    isCorrectGuess: false, 
    setCorrectGuess: () => {}
});

export const GameContext = createContext({
    currentRound: 1,
    totalRounds: 3,
    roundTime: 60,
    isHost: false,
    isDrawing: false,
    setIsDrawing: () => {},
    roundEnded: false,
    gameOver: false,
    gameResults: [],
    allGuessedCorrectly: false,
    wordSelected: false,
    hasWordOptions: false,
    currentDrawer: ""
});
    
const MainCanvasPage = ({ isHost, roomSettings }) => {
    const [word, setWord] = useState(target);
    const [isCorrectGuess, setCorrectGuess] = useState(false);
    const [currentRound, setCurrentRound] = useState(1);
    const [totalRounds, setTotalRounds] = useState(roomSettings?.rounds || 3);
    const [roundTime, setRoundTime] = useState(roomSettings?.roundTime || 60);
    const [isDrawing, setIsDrawing] = useState(false);
    const [roundComplete, setRoundComplete] = useState(false);
    const [roundEnded, setRoundEnded] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [gameResults, setGameResults] = useState([]);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [roundLeaderboard, setRoundLeaderboard] = useState([]);
    const [showRoundLeaderboard, setShowRoundLeaderboard] = useState(false);
    const [allGuessedCorrectly, setAllGuessedCorrectly] = useState(false);
    const [wordSelected, setWordSelected] = useState(false);
    const [hasWordOptions, setHasWordOptions] = useState(false);
    const [currentDrawer, setCurrentDrawer] = useState(null);
    const [timerKey, setTimerKey] = useState(0); // Specific key just for timer resets
    const [timerSynced, setTimerSynced] = useState(false);
    const [timerRemainingSeconds, setTimerRemainingSeconds] = useState(60);
    const [roundEndTime, setRoundEndTime] = useState(null);
    const [serverTimeOffset, setServerTimeOffset] = useState(0);
    const [displayTimer, setDisplayTimer] = useState(60);
    const [correctGuessers, setCorrectGuessers] = useState([]);
    
    // Debug logging for important state changes
    const logStateChange = useCallback((stateName, value) => {
        console.log(`%c[STATE UPDATE] ${stateName}: ${JSON.stringify(value)}`, 'background: #4f46e5; color: white; padding: 3px;');
    }, []);
    
    // Create an explicit state updater for drawer status to ensure it's always consistent
    const updateDrawerStatus = useCallback((isCurrentDrawer, drawerName) => {
        console.log(`%c[DRAWER UPDATE] Setting drawer: ${drawerName}, isDrawing: ${isCurrentDrawer}`, 'background: #059669; color: white; padding: 3px;');
        setIsDrawing(isCurrentDrawer);
        setCurrentDrawer(drawerName);
        
        // Reset word selection if becoming drawer
        if (isCurrentDrawer) {
            setWordSelected(false);
        }
    }, []);
    
    // Initialize with room settings
    useEffect(() => {
        if (roomSettings) {
            setTotalRounds(roomSettings.rounds);
            setRoundTime(roomSettings.roundTime);
        }
    }, [roomSettings]);
    
    // Listen for game state updates
    useEffect(() => {
        const handleGameState = (state) => {
            console.log("Game state update:", state);
            
            if (state.currentRound) {
                setCurrentRound(state.currentRound);
            }
            
            if (state.isGameOver) {
                setGameOver(true);
                setGameResults(state.gameResults || []);
                setShowLeaderboard(true);
            }
        };
        
        // Drawer assignments
        const handleDrawerAssigned = (data) => {
            console.log("Drawer assigned:", data);
            if (data.drawerName) {
                // Use the explicit drawer status updater
                const isCurrentDrawer = data.drawerId === socket.id;
                updateDrawerStatus(isCurrentDrawer, data.drawerName);
                logStateChange('drawerAssigned', { drawerName: data.drawerName, isCurrentDrawer });
            }
        };
        
        // My drawer assignment
        const handleAssignedAsDrawer = (data) => {
            console.log("Assigned as drawer:", data);
            
            // Use the explicit drawer status updater
            if (data.isDrawing !== undefined) {
                updateDrawerStatus(data.isDrawing, data.drawerName || currentDrawer);
                logStateChange('assignedAsDrawer', data);
            }
            
            // Handle word options
            if (data.isDrawing && data.wordOptions && data.wordOptions.length > 0) {
                console.log("I am drawer with word options:", data.wordOptions);
                setHasWordOptions(true);
                // Ensure word selection is reset
                setWordSelected(false);
            } else {
                setHasWordOptions(false);
                if (!data.isDrawing) {
                    setWord("");
                }
            }
        };
        
        // Word selection
        const handleWordSelected = (data) => {
            console.log("Word selected event:", data);
            logStateChange('wordSelectedEvent', data);
            
            // Update word selection status
            setWordSelected(true);
            setHasWordOptions(false);
            setRoundEnded(false);
            
            // Only drawer gets the actual word
            if (data.word) {
                console.log("I am drawer, got word:", data.word);
                setWord(data.word);
                
                // Force update of isDrawing status to ensure context is correct
                setIsDrawing(true);
            } else if (data.length) {
                // Non-drawers just get word length
                console.log(`I am not drawer, word is ${data.length} letters`);
                // Make sure non-drawers have drawing disabled
                setIsDrawing(false);
            }
            
            // Force timer reset when word is selected
            setTimerKey(prevKey => {
                console.log(`Resetting timer key from ${prevKey} to ${prevKey + 1}`);
                return prevKey + 1;
            });
            
            // Request timer sync from server
            const roomId = localStorage.getItem("roomId");
            if (roomId) {
                socket.emit("requestTimerSync", { roomId });
            }
            
            // Force a context update to propagate the changes
            setTimeout(() => {
                console.log('%c[WORD SELECTED STATE UPDATE]', 'background: #dc2626; color: white; padding: 3px;', {
                    wordSelected: true,
                    hasWordOptions: false,
                    isDrawing: data.word ? true : false,
                    word: data.word || ''
                });
            }, 50);
        };
        
        // Add gameStarted handler
        const handleGameStarted = (data) => {
            console.log("Game started event:", data);
            setRoundEnded(false);
            setAllGuessedCorrectly(false);
            
            // Set timer directly from server data
            if (data.timer) {
                setTimerRemainingSeconds(data.timer);
                setTimerSynced(true);
                setTimerKey(prevKey => prevKey + 1);
            }
        };
        
        // Round completion
        const handleRoundComplete = (data) => {
            console.log("Round complete event:", data);
            
            if (data.word) {
                // Show word to everyone
                setWord(data.word);
            }
            
            // Handle all players guessed correctly case
            if (data.allGuessedCorrectly) {
                setAllGuessedCorrectly(true);
                console.log("All players guessed correctly");
            }
            
            // Always stop timer and mark round as ended
            setRoundEnded(true);
            setTimerKey(prevKey => prevKey + 1000); // Big jump to ensure reset
        };
        
        // Round leaderboard
        const handleRoundLeaderboard = (data) => {
            console.log("Round leaderboard:", data);
            setRoundLeaderboard(data.leaderboard || []);
            setShowRoundLeaderboard(true);
            
            setTimeout(() => {
                setShowRoundLeaderboard(false);
                setAllGuessedCorrectly(false);
            }, data.duration || 5000);
        };
        
        // Player guessed correctly
        const handlePlayerGuessedCorrectly = ({ userId }) => {
            setCorrectGuessers(prev => prev.includes(userId) ? prev : [...prev, userId]);
        };
        
        // Handle allPlayersGuessedCorrectly event
        const handleAllPlayersGuessedCorrectly = () => {
            setAllGuessedCorrectly(true);
        };
        
        // Add timer sync handlers
        const handleTimerSync = (data) => {
            console.log("Timer sync received:", data);
            
            // Don't update timer if round has ended
            if (roundEnded || allGuessedCorrectly) {
                console.log("Not updating timer because round has ended or all guessed correctly");
                return;
            }
            
            // Calculate precise remaining time based on server's timestamp and data
            let remainingSeconds;
            
            // Prefer using the direct server timer value for consistency
            remainingSeconds = data.timer;
            
            // Only update if this is initial sync or there's a significant difference
            if (!timerSynced || Math.abs(remainingSeconds - timerRemainingSeconds) > 1) {
                console.log(`Updating timer: ${timerRemainingSeconds}s → ${remainingSeconds}s`);
                setTimerRemainingSeconds(remainingSeconds);
                setTimerSynced(true);
                
                // Only reset timer key if the difference is significant (to avoid visual jumps)
                if (Math.abs(remainingSeconds - timerRemainingSeconds) > 2) {
                    setTimerKey(prevKey => prevKey + 1);
                }
            }
            
            // If the server says all players have guessed correctly, immediately end the round
            if (data.correctGuesses && data.totalGuessers && 
                data.correctGuesses >= data.totalGuessers && 
                data.totalGuessers > 0) {
                console.log("Server reports all players have guessed correctly");
                setAllGuessedCorrectly(true);
                setRoundEnded(true);
                setTimerKey(prevKey => prevKey + 1000); // Force timer reset
            }
            
            logStateChange('timerSync', { 
                remainingSeconds, 
                timePercent: (data.remainingMs || 0) / (roundTime * 1000) 
            });
        };
        
        // Regular timer updates
        const handleTimerUpdate = (data) => {
            setRoundEndTime(data.roundEndTime);
            setServerTimeOffset(Date.now() - data.serverTime);
            // Only update timer if not all guessed correctly
            if (!allGuessedCorrectly) {
                setDisplayTimer(data.remaining);
            }
        };
        
        socket.on("gameState", handleGameState);
        socket.on("drawerAssigned", handleDrawerAssigned);
        socket.on("assignedAsDrawer", handleAssignedAsDrawer);
        socket.on("wordSelected", handleWordSelected);
        socket.on("gameStarted", handleGameStarted);
        socket.on("roundComplete", handleRoundComplete);
        socket.on("showRoundLeaderboard", handleRoundLeaderboard);
        socket.on("playerGuessedCorrectly", handlePlayerGuessedCorrectly);
        socket.on("allPlayersGuessedCorrectly", handleAllPlayersGuessedCorrectly);
        socket.on("timerSync", handleTimerSync);
        socket.on("timerUpdate", handleTimerUpdate);
        
        // Get initial state
        const roomId = localStorage.getItem("roomId");
        if (roomId) {
            console.log("Requesting initial drawer info");
            socket.emit("getDrawerInfo", { roomId });
        }
        
        return () => {
            socket.off("gameState", handleGameState);
            socket.off("drawerAssigned", handleDrawerAssigned);
            socket.off("assignedAsDrawer", handleAssignedAsDrawer);
            socket.off("wordSelected", handleWordSelected);
            socket.off("gameStarted", handleGameStarted);
            socket.off("roundComplete", handleRoundComplete);
            socket.off("showRoundLeaderboard", handleRoundLeaderboard);
            socket.off("playerGuessedCorrectly", handlePlayerGuessedCorrectly);
            socket.off("allPlayersGuessedCorrectly", handleAllPlayersGuessedCorrectly);
            socket.off("timerSync", handleTimerSync);
            socket.off("timerUpdate", handleTimerUpdate);
        };
    }, []);
    
    // Handle timer completion
    const handleTimerComplete = () => {
        if (!roundEnded && !allGuessedCorrectly) {
            console.log("Timer complete!");
            setRoundEnded(true);
            setRoundComplete(true);
            toast("Time's up!");
            // Notify server about timer completion (as a backup)
            const roomId = localStorage.getItem("roomId");
            socket.emit("timerComplete", { roomId });
            setTimeout(() => {
                setRoundComplete(false);
                setRoundEnded(false);
                setAllGuessedCorrectly(false);
                setWord("");
            }, 5000);
        }
    };
    
    // Reset round state when round changes
    useEffect(() => {
        console.log("Round changed to:", currentRound, "- Resetting states");
        setRoundEnded(false);
        setRoundComplete(false);
        setCorrectGuess(false);
        setAllGuessedCorrectly(false);
        setWordSelected(false);
        setWord("");
        setHasWordOptions(false);
        setTimerKey(prevKey => prevKey + 1); // Reset timer
        setCorrectGuessers([]);
        
        // Get fresh drawer info on round change with a slight delay
        // to ensure server has updated its state
        const roomId = localStorage.getItem("roomId");
        if (roomId) {
            console.log("Requesting drawer info for new round");
            
            // Try immediately
            socket.emit("getDrawerInfo", { roomId });
            
            // And also with a delay to ensure we get updated info
            setTimeout(() => {
                console.log("Re-requesting drawer info after delay");
                socket.emit("getDrawerInfo", { roomId });
            }, 1000);
        }
    }, [currentRound]);
    
    // Listen to all guessed correctly event
    useEffect(() => {
        if (allGuessedCorrectly && !roundEnded) {
            console.log("All guessed correctly flag set - ending round");
            setRoundEnded(true);
            setTimerKey(prevKey => prevKey + 1000); // Force timer reset
            
            // Emit event to server just as a backup
            const roomId = localStorage.getItem("roomId");
            socket.emit("allPlayersGuessedCorrectly", { roomId });
        }
    }, [allGuessedCorrectly, roundEnded]);

    // Add debug useEffect for drawer states
    useEffect(() => {
        console.log("Drawer state updated:", {
            isDrawing,
            hasWordOptions,
            wordSelected,
            currentDrawer
        });
    }, [isDrawing, hasWordOptions, wordSelected, currentDrawer]);

    // Add additional logging useEffect for drawer info responses
    useEffect(() => {
        const handleDrawerInfo = (data) => {
            console.log("DrawerInfo response received:", data);
            logStateChange('drawerInfo', data);
            
            // Update drawer status using the centralized function
            if (data.isCurrentDrawer !== undefined || data.drawerName) {
                updateDrawerStatus(
                    data.isCurrentDrawer || false, 
                    data.drawerName || currentDrawer
                );
            }
            
            // Update word options
            if (data.isCurrentDrawer && data.wordOptions && data.wordOptions.length > 0) {
                console.log("Setting hasWordOptions to true from drawerInfo");
                setHasWordOptions(true);
                // If we have word options, reset wordSelected
                setWordSelected(false);
            }
            
            // Update word selected status if provided
            if (data.wordSelected !== undefined) {
                setWordSelected(data.wordSelected);
            }
            
            // Log the complete state after update
            setTimeout(() => {
                console.log('%c[DRAWER STATE AFTER UPDATE]', 'background: #f97316; color: white; padding: 3px;', {
                    isDrawing: data.isCurrentDrawer,
                    hasWordOptions: data.wordOptions?.length > 0,
                    wordSelected: data.wordSelected,
                    currentDrawer: data.drawerName,
                    gameContextUpdate: gameContextValue
                });
            }, 50);
        };
        
        socket.on("drawerInfo", handleDrawerInfo);
        
        return () => {
            socket.off("drawerInfo", handleDrawerInfo);
        };
    }, []);
    
    // Log important state changes
    useEffect(() => {
        logStateChange('isDrawing', isDrawing);
    }, [isDrawing, logStateChange]);
    
    useEffect(() => {
        logStateChange('wordSelected', wordSelected);
    }, [wordSelected, logStateChange]);
    
    useEffect(() => {
        logStateChange('currentDrawer', currentDrawer);
    }, [currentDrawer, logStateChange]);
    
    useEffect(() => {
        logStateChange('hasWordOptions', hasWordOptions);
    }, [hasWordOptions, logStateChange]);

    useEffect(() => {
        logStateChange('roundEnded', roundEnded);
    }, [roundEnded, logStateChange]);
    
    // Memoize the game context value to prevent unnecessary re-renders
    const gameContextValue = useMemo(() => ({
        currentRound,
        totalRounds,
        roundTime: timerSynced ? timerRemainingSeconds : roundTime,
        isHost,
        isDrawing,
        setIsDrawing,
        roundEnded,
        gameOver,
        gameResults,
        allGuessedCorrectly,
        wordSelected,
        hasWordOptions,
        currentDrawer
    }), [
        currentRound, 
        totalRounds, 
        roundTime, 
        isHost, 
        isDrawing, 
        roundEnded, 
        gameOver, 
        gameResults, 
        allGuessedCorrectly, 
        wordSelected,
        hasWordOptions,
        currentDrawer,
        timerSynced,
        timerRemainingSeconds
    ]);
    
    // Log whenever the context value changes
    useEffect(() => {
        console.log('%c[CONTEXT UPDATE] GameContext value changed:', 'background: #8b5cf6; color: white; padding: 3px;', gameContextValue);
    }, [gameContextValue]);

    useEffect(() => {
        if (!roundEndTime) return;
        const interval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((roundEndTime - (now - serverTimeOffset)) / 1000));
            setDisplayTimer(remaining);
        }, 200);
        return () => clearInterval(interval);
    }, [roundEndTime, serverTimeOffset]);

    // Show end game results
    if (gameOver && showLeaderboard) {
        return (
            <div className="h-screen w-screen bg-indigo-900 flex flex-col items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                    <h2 className="text-3xl font-bold text-center mb-6">Game Results</h2>
                    <div className="space-y-4 mb-8">
                        {gameResults.slice(0, 3).map((user, index) => (
                            <div 
                                key={index} 
                                className={`flex items-center p-4 rounded-lg border ${
                                    index === 0 ? 'bg-yellow-100 border-yellow-400' : 
                                    index === 1 ? 'bg-gray-100 border-gray-400' : 
                                    'bg-amber-100 border-amber-400'
                                }`}
                            >
                                <div className="w-8 h-8 flex items-center justify-center mr-4 rounded-full bg-indigo-600 text-white font-bold">
                                    {index + 1}
                                </div>
                                <img 
                                    src={user.avatar} 
                                    className="h-12 w-12 object-contain mr-4 rounded-full" 
                                    alt={user.userName}
                                />
                                <span className="flex-grow font-semibold text-xl">{user.userName}</span>
                                <span className="text-2xl font-bold text-indigo-600">{user.points} pts</span>
                            </div>
                        ))}
                    </div>
                    
                    {gameResults.length > 3 && (
                        <div className="mt-4 border-t pt-4">
                            <h3 className="text-lg font-semibold mb-2">Other Players</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {gameResults.slice(3).map((user, index) => (
                                    <div key={index + 3} className="flex items-center p-2 bg-gray-50 rounded">
                                        <div className="w-6 h-6 flex items-center justify-center mr-2 rounded-full bg-gray-200 text-gray-700 font-medium text-sm">
                                            {index + 4}
                                        </div>
                                        <img 
                                            src={user.avatar} 
                                            className="h-8 w-8 object-contain mr-3" 
                                            alt={user.userName}
                                        />
                                        <span className="flex-grow">{user.userName}</span>
                                        <span className="font-semibold">{user.points} pts</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className="mt-8 text-center">
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-md font-semibold hover:bg-indigo-700 transition-colors"
                        >
                            Play Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Round leaderboard overlay
    const renderRoundLeaderboard = () => {
        if (!showRoundLeaderboard || !roundLeaderboard.length) return null;
        
        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                    <h2 className="text-2xl font-bold text-center mb-4">Round {currentRound} Results</h2>
                    <div className="space-y-3 mb-4">
                        {roundLeaderboard.slice(0, 5).map((user, index) => (
                            <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="w-7 h-7 flex items-center justify-center mr-3 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                                    {index + 1}
                                </div>
                                <img 
                                    src={user.avatar} 
                                    className="h-10 w-10 object-contain mr-3 rounded-full" 
                                    alt={user.userName}
                                />
                                <span className="flex-grow font-medium">{user.userName}</span>
                                <span className="font-bold text-indigo-600">{user.points} pts</span>
                            </div>
                        ))}
                    </div>
                    <div className="text-center text-gray-500">
                        {currentRound < totalRounds ? (
                            <p>Next round starting soon...</p>
                        ) : (
                            <p>Game ending soon...</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const getRemaining = () => {
        if (!roundEndTime) return 60; // fallback to 60 if not set
        const now = Date.now();
        const val = Math.max(0, Math.ceil((roundEndTime - (now - serverTimeOffset)) / 1000));
        return isNaN(val) ? 60 : val;
    };

    const renderClock = () => (
        <div className="absolute top-4 right-4 md:static md:w-auto z-10">
            <Clock
                key={`timer-${displayTimer}`}
                duration={60}
                initialRemainingTime={displayTimer}
                isPlaying={wordSelected && !roundEnded && !allGuessedCorrectly}
                colors={["#059669", "#facc15", "#f43f5e"]}
                colorsTime={[60, 30, 0]}
                size={80}
                strokeWidth={8}
                onComplete={handleTimerComplete}
            />
        </div>
    );

    return (
        <GameContext.Provider value={gameContextValue}>
            <TargetContext.Provider value={{ word, setWord, isCorrectGuess, setCorrectGuess }}>
                <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-100">
                    <Header />
                    <TopPanel />
                    
                    {renderRoundLeaderboard()}
                    
                    <div className="flex h-[calc(100vh-128px)] w-full overflow-hidden">
                        {/* Left panel - Leaderboard */}
                        <div className="w-1/5 h-full min-w-[200px] max-w-[300px] flex-shrink-0 p-2">
                            <div className="w-full h-full bg-white rounded-md overflow-hidden flex flex-col">
                                <LeaderBoard correctGuessers={correctGuessers} />
                            </div>
                        </div>
                        
                        {/* Middle - Canvas */}
                        <div className="flex-grow h-full p-2 flex-shrink-0">
                            <div className="w-full h-full bg-white rounded-md overflow-hidden relative">
                                {isDrawing && hasWordOptions && !wordSelected && (
                                    <WordModal wordCount={roomSettings?.wordOptions || 3} />
                                )}
                                <DrawableCanvas 
                                    isDisabled={!isDrawing || !wordSelected || roundEnded || allGuessedCorrectly} 
                                />
                                
                                {/* Debug drawer status - visible only in dev mode */}
                                {process.env.NODE_ENV === 'development' && (
                                    <div className="absolute top-0 right-0 bg-gray-800 text-white text-xs p-1 opacity-70">
                                        {isDrawing ? "You are drawer" : `Drawer: ${currentDrawer || 'None'}`}
                                        {isDrawing && hasWordOptions && !wordSelected && " | Select Word"}
                                        {isDrawing && !hasWordOptions && !wordSelected && " | Waiting for word options"}
                                        {isDrawing && wordSelected && " | Drawing mode"}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Right panel - Timer and Guesses */}
                        <div className="w-1/5 h-full min-w-[260px] max-w-[300px] flex-shrink-0 p-2 flex flex-col">
                            {/* Timer */}
                            <div className="bg-gray-50 rounded-t-md p-4 flex flex-col items-center">
                                <div className="text-center mb-2">
                                    <span className="text-sm font-medium text-gray-500">Round</span>
                                    <div className="text-lg font-bold text-indigo-700">{currentRound}/{totalRounds}</div>
                                </div>
                                {renderClock()}
                                
                                {/* Timer status message */}
                                <div className="text-xs text-center mt-2 font-medium">
                                    {!wordSelected && !roundEnded && (
                                        <span className="text-amber-600">
                                            {isDrawing ? "Select a word to start timer" : 
                                            (currentDrawer ? `Waiting for ${currentDrawer} to pick a word...` : "Waiting for drawer...")}
                                        </span>
                                    )}
                                    
                                    {wordSelected && !roundEnded && !allGuessedCorrectly && (
                                        <span className="text-green-600">Timer running!</span>
                                    )}
                                    
                                    {allGuessedCorrectly && (
                                        <span className="text-green-600 font-bold">Everyone guessed correctly!</span>
                                    )}
                                    
                                    {roundEnded && !allGuessedCorrectly && (
                                        <span className="text-amber-600">Round ended</span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Guess Area */}
                            <div className="flex-grow h-0 min-h-0 bg-white rounded-b-md overflow-hidden">
                                <GuessArea disabled={!wordSelected || roundEnded || allGuessedCorrectly || isDrawing} />
                            </div>
                        </div>
                    </div>
                </div>
            </TargetContext.Provider>
        </GameContext.Provider>
    );
};

export default MainCanvasPage;