import left from "../assets/left.png"
import right from "../assets/right.png"
import character from "../assets/character.png"
import character1 from "../assets/character1.png"
import wizard from "../assets/wizard.png"
import faun from "../assets/faun.png"
import fear from "../assets/fear.png"
import knight from "../assets/knight.png"
import robot from "../assets/robot.png"
import robot1 from "../assets/robot1.png"
import ninja from "../assets/ninja.png"
import superhero from "../assets/superhero.png"
import { useState, useEffect, useContext, useRef, createContext } from "react"
import { PageContext } from "../pages/AvatarPage"
import socket from "./socket";
import { Settings, Users, Clock } from "lucide-react";
import { toast } from "react-hot-toast";

// Export the avatars array to make it accessible to other components
export const avatarsList = [character, character1, wizard, faun, fear, knight, robot, ninja, robot1, superhero];
export const RoomDetailsContext = createContext()

const AvatarSelect = () => {
    const [currentAvatar, setCurrentAvatar] = useState(0)
    const [userName, setUserName] = useState('');
    const [roomId, setRoomId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
    const [roomSettings, setRoomSettings] = useState({
        maxPlayers: 8,
        roundTime: 60,
        rounds: 3,
        wordOptions: 3
    });
    const inputBox = useRef(null)
    let { currentPage, setCurrentPage } = useContext(PageContext);

    // Generate or get existing userId for persistence
    const [userId] = useState(() => {
        const storedId = localStorage.getItem("userId");
        if (storedId) return storedId;

        const newUserId = `user_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem("userId", newUserId);
        return newUserId;
    });

    useEffect(() => {
        // Handle socket ID assignment
        const handleSocketId = (data) => {
            if (data && data.sid) {
                localStorage.setItem("sid", data.sid);
                console.log("Socket ID stored:", data.sid);
            }
        };
        
        // Handle room creation success
        const handleRoomCreated = (data) => {
            console.log("Room created:", data);
            setLoading(false);
            
            if (data && data.roomId) {
                localStorage.setItem("roomId", data.roomId);
                
                // Explicitly store host status when creating a room
                if (data.isHost) {
                    localStorage.setItem("isHost", "true");
                    console.log("Setting isHost to true in localStorage");
                }
                
                setRoomId(data.roomId);
                setCurrentPage("InRoomPage");
                toast.success(`Room created! ID: ${data.roomId}`);
            } else {
                toast.error("Failed to create room");
            }
        };

        // Handle room joining success
        const handleRoomJoined = (data) => {
            console.log("Joined room:", data);
            setLoading(false);
            
            if (data) {
                // Set host status if applicable
                if (data.isHost) {
                    localStorage.setItem("isHost", "true");
                }
                
                setCurrentPage("InRoomPage");
                toast.success("Joined room successfully!");
            }
        };

        // Handle join errors
        const handleJoinError = (error) => {
            console.error("Failed to join room:", error);
            setLoading(false);
            
            toast.error(`Failed to join room: ${error.error}`);
        };

        // Set up event listeners
        socket.on("sid", handleSocketId);
        socket.on("roomCreated", handleRoomCreated);
        socket.on("roomJoined", handleRoomJoined);
        socket.on("joinError", handleJoinError);

        // Cleanup listeners
        return () => {
            socket.off("sid", handleSocketId);
            socket.off("roomCreated", handleRoomCreated);
            socket.off("roomJoined", handleRoomJoined);
            socket.off("joinError", handleJoinError);
        };
    }, [setCurrentPage]);

    const handleCreateRoom = () => {
        if (!userName || userName.trim() === "") {
            toast.error("Please enter a username");
            return;
        }

        setLoading(true);

        try {
            // Store user info in localStorage for persistence
            const trimmedUserName = userName.trim();
            localStorage.setItem("userName", trimmedUserName);
            localStorage.setItem("avatarIndex", currentAvatar.toString());

            // Create room via socket
            socket.emit("createRoom", { 
                user: trimmedUserName, 
                avatar: avatarsList[currentAvatar],
                userId: userId,
                settings: roomSettings
            });
            
            // Set a timeout to handle no response from server
            setTimeout(() => {
                if (loading) {
                    setLoading(false);
                    toast.error("Server did not respond. Please try again.");
                }
            }, 10000);
        } catch (error) {
            console.error("Error creating room:", error);
            setLoading(false);
            toast.error("Failed to create room");
        }
    }

    const handleJoinRoom = () => {
        const enteredRoomId = inputBox.current ? inputBox.current.value.trim() : '';
        
        if (!userName || userName.trim() === "") {
            toast.error("Please enter a username");
            return;
        }

        if (!enteredRoomId) {
            toast.error("Please enter a room ID");
            return;
        }

        setLoading(true);

        try {
            // Store user info in localStorage for persistence
            const trimmedUserName = userName.trim();
            localStorage.setItem("userName", trimmedUserName);
            localStorage.setItem("avatarIndex", currentAvatar.toString());
            localStorage.setItem("roomId", enteredRoomId);

            // Join room via socket
            socket.emit('joinRoom', { 
                user: trimmedUserName,
                avatar: avatarsList[currentAvatar],
                roomId: enteredRoomId,
                userId: userId
            });
            
            // Set a timeout to handle no response from server
            setTimeout(() => {
                if (loading) {
                    setLoading(false);
                    toast.error("Server did not respond. Please try again.");
                }
            }, 10000);
        } catch (error) {
            console.error("Error joining room:", error);
            setLoading(false);
            toast.error("Failed to join room");
        }
    }

    const handleInputChange = (e) => {
        setUserName(e.target.value)
    }

    const handleLeftClick = () => {
        setCurrentAvatar(prev => (prev > 0 ? prev - 1 : prev))
    }
   
    const handleRightClick = () => {
        setCurrentAvatar(prev => (prev < avatarsList.length - 1 ? prev + 1 : prev))
    }

    const handleSettingChange = (e) => {
        const { name, value } = e.target;
        let numValue = parseInt(value, 10);

        // Apply min/max constraints
        if (name === 'maxPlayers') {
            numValue = Math.max(2, Math.min(12, numValue));
        } else if (name === 'roundTime') {
            numValue = Math.max(30, Math.min(120, numValue));
        } else if (name === 'rounds') {
            numValue = Math.max(1, Math.min(10, numValue));
        } else if (name === 'wordOptions') {
            numValue = Math.max(1, Math.min(5, numValue));
        }

        setRoomSettings({
            ...roomSettings,
            [name]: numValue
        });
    }

    // When component mounts, check for stored user info
    useEffect(() => {
        const storedUserName = localStorage.getItem("userName");
        const storedAvatarIndex = localStorage.getItem("avatarIndex");

        if (storedUserName) {
            setUserName(storedUserName);
        }

        if (storedAvatarIndex) {
            const index = parseInt(storedAvatarIndex, 10);
            if (!isNaN(index) && index >= 0 && index < avatarsList.length) {
                setCurrentAvatar(index);
            }
        }
    }, []);

    return (
        <RoomDetailsContext.Provider value={roomId}>
            <div className="h-auto min-h-[65vh] w-[50vw] bg-custom-blue pt-5 flex flex-col font-body rounded-lg">
                <input 
                    type="text" 
                    placeholder="Enter Your Name" 
                    className="w-[85%] self-center rounded-lg p-3 text-center text-gray-800 font-extrabold text-2xl focus:outline-none mt-5" 
                    onChange={handleInputChange}
                    value={userName}
                    maxLength={15}
                    required
                />
                <div className="flex gap-4 mt-8 mx-2 items-center justify-center">
                    <img src={left} className="h-20 cursor-pointer" onClick={handleLeftClick} alt="Left arrow" />
                    <img src={avatarsList[currentAvatar]} className="h-[10rem]" alt="Selected avatar" />
                    <img src={right} className="h-20 cursor-pointer" onClick={handleRightClick} alt="Right arrow" />
                </div>

                {/* Create Room section */}
                <div className="w-[85%] self-center mt-6">
                <button 
                    onClick={handleCreateRoom}
                    disabled={loading}
                    className={`w-full ${loading ? 'bg-gray-500' : 'bg-emerald-500 hover:bg-emerald-600'} text-white rounded-md text-2xl font-extrabold p-2 transition-colors`}
                >
                    {loading ? 'Creating Room...' : 'Create Private Room!'}
                </button>

                    <button
                        onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                        className="flex items-center justify-center gap-2 mt-2 w-full bg-indigo-500 text-white rounded-md p-2 text-sm hover:bg-indigo-600 transition-colors"
                        disabled={loading}
                    >
                        <Settings size={16} />
                        {showAdvancedSettings ? "Hide Room Settings" : "Show Room Settings"}
                    </button>

                    {/* Advanced Room Settings */}
                    {showAdvancedSettings && (
                        <div className="mt-4 bg-indigo-800 bg-opacity-40 p-3 rounded-lg">
                            <h3 className="text-white text-sm mb-2 font-semibold">Room Settings:</h3>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Users size={16} className="text-white" />
                                    <label className="text-white text-xs">Max Players:</label>
                                    <input
                                        type="range"
                                        name="maxPlayers"
                                        min="2"
                                        max="12"
                                        value={roomSettings.maxPlayers}
                                        onChange={handleSettingChange}
                                        className="flex-grow"
                                        disabled={loading}
                                    />
                                    <span className="text-white text-xs font-semibold">{roomSettings.maxPlayers}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Clock size={16} className="text-white" />
                                    <label className="text-white text-xs">Round Time (s):</label>
                                    <input
                                        type="range"
                                        name="roundTime"
                                        min="30"
                                        max="120"
                                        step="10"
                                        value={roomSettings.roundTime}
                                        onChange={handleSettingChange}
                                        className="flex-grow"
                                        disabled={loading}
                                    />
                                    <span className="text-white text-xs font-semibold">{roomSettings.roundTime}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-white text-xs">Number of Rounds:</label>
                                    <input
                                        type="range"
                                        name="rounds"
                                        min="1"
                                        max="10"
                                        value={roomSettings.rounds}
                                        onChange={handleSettingChange}
                                        className="flex-grow"
                                        disabled={loading}
                                    />
                                    <span className="text-white text-xs font-semibold">{roomSettings.rounds}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <label className="text-white text-xs">Word Options:</label>
                                    <input
                                        type="range"
                                        name="wordOptions"
                                        min="1"
                                        max="5"
                                        value={roomSettings.wordOptions}
                                        onChange={handleSettingChange}
                                        className="flex-grow"
                                        disabled={loading}
                                    />
                                    <span className="text-white text-xs font-semibold">{roomSettings.wordOptions}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Join Room section */}
                <div className="flex gap-2 items-center justify-center mt-6 w-[85%] self-center mb-6">
                    <input 
                        ref={inputBox} 
                        className="w-[65%] p-2 rounded-md focus:outline-none"
                        placeholder="Enter Room ID" 
                        disabled={loading}
                    />
                    <button 
                        className={`${loading ? 'bg-gray-500' : 'bg-custom-pink hover:bg-pink-700'} w-[35%] text-white rounded-md p-2 transition-colors`}
                        onClick={handleJoinRoom}
                        disabled={loading}
                    >
                        {loading ? 'Joining...' : 'Enter Room'}
                    </button>
                </div>
            </div>
        </RoomDetailsContext.Provider>
    )
}

export default AvatarSelect;