import React, { useState, useEffect, useCallback, useContext } from 'react';
import socket from './socket';
import { toast } from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';
import { GameContext } from '../pages/MainCanvasPage';

const LeaderBoard = () => {
  const [users, setUsers] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const gameContext = useContext(GameContext);
  
  // Debug helper
  const debugLog = (message, data) => {
    console.log(`%c[LeaderBoard] ${message}`, 'background: #6366f1; color: white; padding: 3px;', data || '');
  };
  
  // Function to request updated user list
  const refreshUserList = useCallback(() => {
    const roomId = localStorage.getItem("roomId");
    if (roomId) {
      debugLog("Requesting updated user list");
      setIsRefreshing(true);
      socket.emit("getRoomUsers", { roomId });
      
      // Reset refreshing state after a delay
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    } else {
      console.warn("Cannot refresh users: No room ID found");
    }
  }, []);
  
  useEffect(() => {
    // Get the initial room users
    refreshUserList();

    // Listen for new room users
    const handleRoomUsers = (allUsers) => {
      debugLog("Received room users:", allUsers);
      if (!allUsers || !Array.isArray(allUsers)) {
        console.error("Received invalid room users data", allUsers);
        return;
      }
      // Sort users by points
      const sortedUsers = [...allUsers].sort((a, b) => b.points - a.points);
      setUsers(sortedUsers);
      localStorage.setItem("roomUsers", JSON.stringify(sortedUsers));
      debugLog("Updated leaderboard with users:", sortedUsers);
    };
    
    // Listen for correct guesses to show notifications
    const handleCorrectGuess = (data) => {
      if (data.user && data.points) {
        debugLog("Player guessed correctly:", data);
        
        // Only show toast for other players' correct guesses if I'm the drawer
        if (gameContext?.isDrawing || data.user === localStorage.getItem("userName")) {
          toast.success(
            <div>
              <div className="font-bold">{data.user} guessed correctly!</div>
              <div>+{data.points} points</div>
            </div>,
            {
              duration: 3000,
              icon: '🎉'
            }
          );
        }
        
        // Request updated user list immediately and after a short delay
        refreshUserList();
        setTimeout(refreshUserList, 500);
        setTimeout(refreshUserList, 1500); // Try one more time after a longer delay
      }
    };
    
    // Listen for drawer points earned
    const handleDrawerEarnedPoints = (data) => {
      if (data.user && data.points) {
        debugLog("Drawer earned points:", data);
        
        // Show toast for drawer points (visible to everyone)
        toast.success(
          <div>
            <div className="font-bold">{data.user} earned points for drawing!</div>
            <div>+{data.points} points</div>
          </div>,
          {
            duration: 3000,
            icon: '🎨'
          }
        );
        
        // Request updated user list multiple times to ensure it updates
        refreshUserList();
        setTimeout(refreshUserList, 500);
        setTimeout(refreshUserList, 1500);
      }
    };
    
    // Listen for round completed event
    const handleRoundComplete = (data) => {
      debugLog("Round completed:", data);
      // Refresh user list when round completes
      refreshUserList();
      setTimeout(refreshUserList, 1000);
      setTimeout(refreshUserList, 2000);
    };

    // Listen for all players guessed correctly
    const handleAllGuessedCorrectly = (data) => {
      debugLog("All players guessed correctly:", data);
      // Refresh user list
      refreshUserList();
      setTimeout(refreshUserList, 500);
    };

    // Add the event listeners
    socket.on("roomUsers", handleRoomUsers);
    socket.on("playerGuessedCorrectly", handleCorrectGuess);
    socket.on("drawerEarnedPoints", handleDrawerEarnedPoints);
    socket.on("roundComplete", handleRoundComplete);
    socket.on("allPlayersGuessedCorrectly", handleAllGuessedCorrectly);
    
    // Request room users after a connection/reconnection
    socket.on("connect", refreshUserList);
    
    // Set up an interval to refresh user list periodically
    const refreshInterval = setInterval(refreshUserList, 5000);

    // Clean up the event listeners when component unmounts
    return () => {
      socket.off("roomUsers", handleRoomUsers);
      socket.off("playerGuessedCorrectly", handleCorrectGuess);
      socket.off("drawerEarnedPoints", handleDrawerEarnedPoints);
      socket.off("roundComplete", handleRoundComplete);
      socket.off("allPlayersGuessedCorrectly", handleAllGuessedCorrectly);
      socket.off("connect", refreshUserList);
      clearInterval(refreshInterval);
    };
  }, [refreshUserList, gameContext?.isDrawing]);

  // Manual refresh when component is clicked
  const handleManualRefresh = () => {
    refreshUserList();
  };

  return (
    <div className="bg-white rounded-md overflow-hidden h-full flex flex-col">
      <div 
        className="bg-custom-blue text-white p-2 flex items-center justify-between cursor-pointer hover:bg-indigo-700 transition-colors"
        onClick={handleManualRefresh}
        title="Click to refresh points"
      >
        <span className="font-bold">Leaderboard</span>
        <RefreshCw 
          size={16} 
          className={`${isRefreshing ? 'animate-spin' : ''}`} 
        />
      </div>
      {users.length === 0 ? (
        <div className="flex-grow flex items-center justify-center text-gray-500 p-4 text-center">
          Waiting for players...
        </div>
      ) : (
        <ul className="overflow-y-auto flex-grow divide-y">
          {users.map((user, index) => (
            <li key={index} className="flex items-center p-2 hover:bg-gray-50">
              <div className={`w-6 h-6 flex items-center justify-center mr-2 rounded-full ${
                index === 0 ? 'bg-yellow-100 text-yellow-800' : 
                index === 1 ? 'bg-gray-100 text-gray-800' : 
                index === 2 ? 'bg-amber-100 text-amber-800' : 
                'bg-gray-50 text-gray-600'
              } font-bold text-sm`}>
                {index + 1}
              </div>
              
              <img 
                src={user.avatar} 
                alt="avatar" 
                className="w-8 h-8 rounded-full mr-2 object-cover border border-gray-200" 
              />
              
              <div className="flex-grow flex justify-between items-center">
                <span className="text-sm font-medium truncate max-w-[100px]">
                  {user.userName}
                  {user.isHost && (
                    <span className="ml-1 text-xs bg-yellow-100 text-yellow-800 px-1 rounded">Host</span>
                  )}
                </span>
                <span className="text-sm font-bold text-indigo-600">{user.points}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LeaderBoard;