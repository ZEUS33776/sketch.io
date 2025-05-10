import { useState, useEffect } from "react";
import socket from "./socket";
import MainCanvasPage from "../pages/MainCanvasPage";
import RoomSettings from "./RoomSettings";
import { toast, Toaster } from "react-hot-toast";
import { Users, Copy, AlertCircle, RefreshCw, Medal, Settings } from "lucide-react";
import { avatarsList } from "./AvatarSelect";

const InRoom = () => {
    const [currentPage, setCurrentPage] = useState("InRoomPage");
    const [usersInRoom, setUsersInRoom] = useState([]);
    const [isHost, setIsHost] = useState(false);
    const [roomSettings, setRoomSettings] = useState(null);
    const [userId] = useState(() => localStorage.getItem("userId") || generateUserId());
    const [joinError, setJoinError] = useState(null);
    const [progressRestored, setProgressRestored] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [reconnectionTimer, setReconnectionTimer] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [countdown, setCountdown] = useState(null);
    const [settingsChanged, setSettingsChanged] = useState(false);

    // Generate and store a persistent user ID
    function generateUserId() {
        const newUserId = `user_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem("userId", newUserId);
        return newUserId;
    }

    useEffect(() => {
        // Get the initial room users
        const roomId = localStorage.getItem("roomId");
        const sid = localStorage.getItem("sid");

        console.log("Component mounted. User ID:", userId);
        console.log("Socket ID from localStorage:", sid);

        // Handle room join success
        const handleRoomJoined = (data) => {
            console.log("Joined room successfully:", data);
            setIsHost(data.isHost);
            if (data.settings) {
                setRoomSettings(data.settings);
            }
            setIsReconnecting(false);
            clearReconnectionTimer();
        };

        // Handle room creation success
        const handleRoomCreated = (data) => {
            console.log("Room created successfully:", data);
            setIsHost(true); // Explicitly set isHost to true
            localStorage.setItem("isHost", "true"); // Store host status
            setIsReconnecting(false);
            clearReconnectionTimer();
        };

        // Handle join errors
        const handleJoinError = (error) => {
            console.error("Failed to join room:", error);
            setJoinError(error.error);
            toast.error(`Failed to join: ${error.error}`);
        };

        // Handle settings updates
        const handleSettingsUpdate = (settings) => {
            console.log("Room settings updated:", settings);
            setRoomSettings(settings);
            setSettingsChanged(false); // Reset the settings changed flag when we get official settings
            toast.success("Room settings updated!");
        };

        // Handle progress restoration
        const handleProgressRestored = (progress) => {
            console.log("Progress restored:", progress);
            toast.success(`Welcome back ${progress.userName}! Your progress has been restored.`);
            setProgressRestored(true);
            setIsReconnecting(false);
            clearReconnectionTimer();
        };

        // Handle game state updates
        const handleGameStateUpdate = (state) => {
            console.log("Game state updated:", state);
            if (state.gameStarted !== undefined) {
                setGameStarted(state.gameStarted);
                
                // If game is starting, show countdown
                if (state.gameStarted && state.countdown) {
                    startCountdown(state.countdown);
                }
            }
        };

        // Listen for new room users
        const handleRoomUsers = (allUsers) => {
            console.log("Received room users:", allUsers);
            setUsersInRoom(allUsers);
            localStorage.setItem("roomUsers", JSON.stringify(allUsers));

            // Check if current user is host based on multiple criteria
            const socketId = localStorage.getItem("sid");
            const storedIsHost = localStorage.getItem("isHost") === "true";

            // Find the current user by socket ID or userId
            const currentUserBySocketId = allUsers.find(user => user.userId === socketId);
            const currentUserByUserId = allUsers.find(user => user.userId === userId);
            const currentUser = currentUserBySocketId || currentUserByUserId;

            if (currentUser) {
                console.log("Current user found with isHost:", currentUser.isHost);
                setIsHost(currentUser.isHost || storedIsHost);
            } else if (storedIsHost) {
                console.log("User not found in list, but localStorage indicates host status");
                setIsHost(true);
            }
        };

        const handleDisconnect = (reason) => {
            console.log("Disconnected from server:", reason);
            if (reason === "io server disconnect" || reason === "transport close") {
                startReconnectionTimer();
            }
        };

        const handleReconnect = () => {
            console.log("Reconnected to server");
            const roomId = localStorage.getItem("roomId");
            if (roomId) {
                rejoinRoom();
            }
        };

        // Handle host assignment
        const handleHostAssigned = (data) => {
            console.log("Host assignment update:", data);
            if (data.isHost) {
                setIsHost(true);
                localStorage.setItem("isHost", "true");
                toast.success("You are now the host of this room!");
            }
        };

        // Add event listeners
        socket.on("roomUsers", handleRoomUsers);
        socket.on("roomJoined", handleRoomJoined);
        socket.on("roomCreated", handleRoomCreated);
        socket.on("joinError", handleJoinError);
        socket.on("roomSettingsUpdated", handleSettingsUpdate);
        socket.on("progressRestored", handleProgressRestored);
        socket.on("gameState", handleGameStateUpdate);
        socket.on("disconnect", handleDisconnect);
        socket.on("connect", handleReconnect);
        socket.on("hostAssigned", handleHostAssigned);

        // Request room users, settings, and game state
        if (roomId) {
            socket.emit("getRoomUsers", { roomId });
            socket.emit("requestRoomSettings", { roomId });
            socket.emit("requestGameState", { roomId });
        }

        // Check if user is already known to be host
        const storedIsHost = localStorage.getItem("isHost") === "true";
        if (storedIsHost) {
            console.log("Setting isHost=true from localStorage");
            setIsHost(true);
        }

        // Clean up event listeners
        return () => {
            socket.off("roomUsers", handleRoomUsers);
            socket.off("roomJoined", handleRoomJoined);
            socket.off("roomCreated", handleRoomCreated);
            socket.off("joinError", handleJoinError);
            socket.off("roomSettingsUpdated", handleSettingsUpdate);
            socket.off("progressRestored", handleProgressRestored);
            socket.off("gameState", handleGameStateUpdate);
            socket.off("disconnect", handleDisconnect);
            socket.off("connect", handleReconnect);
            socket.off("hostAssigned", handleHostAssigned);
            clearReconnectionTimer();
        };
    }, [userId]);

    const startCountdown = (seconds) => {
        setCountdown(seconds);
        
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setCurrentPage("CanvasPage");
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const startReconnectionTimer = () => {
        setIsReconnecting(true);
        const timer = setTimeout(() => {
            toast.error("Reconnection timed out. Please refresh the page.");
            setIsReconnecting(false);
        }, 150000); // 2 minutes 30 seconds
        setReconnectionTimer(timer);
    };

    const clearReconnectionTimer = () => {
        if (reconnectionTimer) {
            clearTimeout(reconnectionTimer);
            setReconnectionTimer(null);
        }
    };

    const rejoinRoom = () => {
        const roomId = localStorage.getItem("roomId");
        const userName = localStorage.getItem("userName");
        const avatarIndex = localStorage.getItem("avatarIndex") || "0";
        
        if (roomId && userName) {
            // Use the exported avatars list
            const avatarIdx = parseInt(avatarIndex, 10);
            const avatar = avatarsList[avatarIdx < avatarsList.length ? avatarIdx : 0];
            
            socket.emit("joinRoom", {
                roomId,
                user: userName,
                avatar: avatar,
                userId: userId
            });
            
            toast.loading("Reconnecting to room...");
        }
    };
    
    // Save user state when navigating away
    useEffect(() => {
        const handleBeforeUnload = () => {
            const roomId = localStorage.getItem("roomId");
            if (roomId) {
                socket.emit("leaveRoom", { roomId });
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    const handleStartClicked = () => {
        console.log("Start button clicked. Current isHost value:", isHost);
        if (!isHost) return;
        
        // If settings have been changed but not saved, show a toast
        if (settingsChanged) {
            toast.error("Please save settings changes before starting the game");
            return;
        }
        
        // Emit game start event to server
        const roomId = localStorage.getItem("roomId");
        socket.emit("startGame", { roomId });
        
        // Server will send back a gameState update which will handle the transition
    };

    const handleCopy = async () => {
        try {
            const roomId = localStorage.getItem("roomId");
            if (roomId) {
                await navigator.clipboard.writeText(roomId);
                toast.success("Room ID copied to clipboard!");
                console.log("Room ID copied to clipboard!");
            } else {
                console.log("No Room ID found in localStorage.");
                toast.error("No Room ID found!");
            }
        } catch (error) {
            console.error("Failed to copy room ID:", error);
            toast.error("Failed to copy room ID");
        }
    };

    const handleManualReconnect = () => {
        rejoinRoom();
    };

    const toggleSettings = () => {
        setShowSettings(prev => !prev);
        setShowLeaderboard(false);
    };

    const toggleLeaderboard = () => {
        setShowLeaderboard(prev => !prev);
        setShowSettings(false);
    };

    // Sort users by points for leaderboard
    const sortedUsers = [...usersInRoom].sort((a, b) => b.points - a.points);

    // Display error message if joining failed
    if (joinError) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <div className="bg-red-100 p-6 rounded-lg shadow-md max-w-md mx-auto text-center">
                    <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                    <h2 className="text-2xl font-bold text-red-700 mb-2">Failed to Join Room</h2>
                    <p className="text-red-600 mb-4">{joinError}</p>
                    <button
                        onClick={() => window.history.back()}
                        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    // Show reconnecting overlay if needed
    if (isReconnecting) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-900 bg-opacity-70 fixed inset-0 z-50">
                <div className="bg-white p-6 rounded-lg shadow-md max-w-md mx-auto text-center">
                    <RefreshCw className="mx-auto mb-4 text-blue-500 animate-spin" size={48} />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Reconnecting...</h2>
                    <p className="text-gray-600 mb-4">
                        Attempting to reconnect you to the room. Please wait...
                    </p>
                    <button
                        onClick={handleManualReconnect}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                        Reconnect Manually
                    </button>
                </div>
            </div>
        );
    }

    // Show countdown overlay when game is starting
    if (countdown !== null) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-indigo-900 bg-opacity-80 fixed inset-0 z-50">
                <div className="text-center">
                    <h2 className="text-6xl font-bold text-white mb-4">Game Starting</h2>
                    <div className="bg-white rounded-full h-36 w-36 flex items-center justify-center mx-auto mb-6">
                        <span className="text-6xl font-bold text-indigo-600">{countdown}</span>
                    </div>
                    <p className="text-white text-xl">Get ready to draw or guess!</p>
                </div>
            </div>
        );
    }

    // Function to handle settings changes from the RoomSettings component
    const handleSettingsChanged = (changed) => {
        console.log("Settings changed state:", changed);
        setSettingsChanged(changed);
    };

    return currentPage === "InRoomPage" ? (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <Toaster position="top-center" />
            
            {/* Header */}
            <header className="bg-custom-blue p-4 shadow-md">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-4xl text-white font-bold">sketch.io</h1>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCopy}
                            className="px-3 py-1 bg-white text-custom-blue rounded flex items-center gap-1 hover:bg-gray-100"
                        >
                            <Copy size={16} />
                            <span className="hidden md:inline">Copy Room ID</span>
                        </button>
                        <button
                            onClick={toggleLeaderboard}
                            className={`px-3 py-1 rounded flex items-center gap-1 ${showLeaderboard ? 'bg-yellow-500 text-white' : 'bg-white text-custom-blue hover:bg-gray-100'}`}
                        >
                            <Medal size={16} />
                            <span className="hidden md:inline">Leaderboard</span>
                        </button>
                        {isHost && (
                            <button
                                onClick={toggleSettings}
                                className={`px-3 py-1 rounded flex items-center gap-1 ${showSettings ? 'bg-green-500 text-white' : 'bg-white text-custom-blue hover:bg-gray-100'}`}
                            >
                                <Settings size={16} />
                                <span className="hidden md:inline">Settings</span>
                            </button>
                        )}
                    </div>
                </div>
            </header>
            
            <main className="flex-grow container mx-auto py-6 px-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Player List */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-md p-4 h-full">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold text-gray-800">Players</h2>
                                <div className="bg-indigo-500 text-white px-3 py-1 rounded-full flex items-center gap-1">
                                    <Users size={16} />
                                    <span>{usersInRoom.length}/{roomSettings?.maxPlayers || 8}</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {usersInRoom.map((user, i) => (
                                    <div
                                        key={i}
                                        className="flex flex-col items-center p-3 bg-gray-50 rounded-lg border border-gray-200"
                                    >
                                        <div className="relative">
                                            <img
                                                src={user.avatar}
                                                className={`h-16 w-16 object-contain rounded-full bg-gray-100 p-1 ${user.isHost ? 'ring-2 ring-yellow-400' : ''}`}
                                                alt=""
                                            />
                                            {user.isHost && (
                                                <span className="absolute -top-1 -right-1 bg-yellow-400 text-xs px-1 py-0.5 rounded-full">
                                                    Host
                                                </span>
                                            )}
                                            {progressRestored && user.userId === userId && (
                                                <span className="absolute -bottom-1 -right-1 bg-green-500 text-white text-xs px-1 py-0.5 rounded-full">
                                                    Restored
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="mt-2 text-sm font-medium text-gray-800 truncate max-w-full">
                                            {user.userName}
                                        </h3>
                                        <p className="text-xs font-semibold text-yellow-600">
                                            {user.points} pts
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    {/* Side Panel - Settings or Leaderboard */}
                    <div className="lg:col-span-1">
                        {showSettings && isHost ? (
                            <div className="bg-white rounded-lg shadow-md p-4 h-full">
                                <h2 className="text-xl font-semibold text-gray-800 mb-4">Room Settings</h2>
                                <RoomSettings isHost={isHost} inPanel={true} onSettingsChanged={handleSettingsChanged} />
                            </div>
                        ) : showLeaderboard ? (
                            <div className="bg-white rounded-lg shadow-md p-4 h-full">
                                <h2 className="text-xl font-semibold text-gray-800 mb-4">Leaderboard</h2>
                                <div className="space-y-2">
                                    {sortedUsers.map((user, index) => (
                                        <div key={index} className="flex items-center p-2 bg-gray-50 rounded border border-gray-200">
                                            <div className="w-6 h-6 flex items-center justify-center mr-3 rounded-full bg-blue-100 text-blue-800 font-bold text-sm">
                                                {index + 1}
                                            </div>
                                            <img 
                                                src={user.avatar} 
                                                className="h-8 w-8 object-contain mr-3" 
                                                alt={user.userName}
                                            />
                                            <span className="flex-grow font-medium">{user.userName}</span>
                                            <span className="font-bold text-yellow-600">{user.points} pts</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-md p-4 h-full">
                                <h2 className="text-xl font-semibold text-gray-800 mb-4">Game Info</h2>
                                {roomSettings && (
                                    <div className="mb-6 space-y-3">
                                        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                            <span className="text-gray-600">Max Players:</span>
                                            <span className="font-semibold">{roomSettings.maxPlayers}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                            <span className="text-gray-600">Round Time:</span>
                                            <span className="font-semibold">{roomSettings.roundTime} seconds</span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                            <span className="text-gray-600">Rounds:</span>
                                            <span className="font-semibold">{roomSettings.rounds}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                            <span className="text-gray-600">Word Options:</span>
                                            <span className="font-semibold">{roomSettings.wordOptions}</span>
                                        </div>
                                    </div>
                                )}
                                <div className="text-center text-gray-600">
                                    <p className="mb-2">Waiting for host to start the game...</p>
                                    {isHost ? (
                                        <button
                                            onClick={handleStartClicked}
                                            className={`w-full py-3 ${settingsChanged ? 'bg-yellow-500' : 'bg-emerald-500'} text-white rounded-md font-semibold hover:bg-emerald-600 transition-colors`}
                                        >
                                            {settingsChanged ? "SAVE SETTINGS FIRST" : "START GAME"}
                                        </button>
                                    ) : (
                                        <div className="animate-pulse text-sm mt-2">
                                            Only the host can start the game
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <footer className="bg-gray-100 border-t border-gray-200 p-4 text-center text-gray-500 text-sm">
                <p>Sketch.io - Real-time drawing and guessing game</p>
            </footer>
        </div>
    ) : (
        <MainCanvasPage isHost={isHost} roomSettings={roomSettings} />
    );
};

export default InRoom;