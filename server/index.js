const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const customSocketIds = new Map();
// Track rooms with their settings
const rooms = new Map();
// Track user progress
const userProgress = new Map();
// Track drawings
const roomDrawings = new Map();
// Track disconnected users and their reconnection timeouts
const disconnectedUsers = new Map();
// Reconnection timeout in milliseconds (2 minutes 30 seconds)
const RECONNECTION_TIMEOUT = 150000;
// Track words and drawers for each room
const roomWords = new Map();
// Track correct guesses in each room
const roomGuesses = new Map();
// Track player order in each room
const roomPlayerOrder = new Map();
// Track active timers for rounds
const roomTimers = new Map();

// Add word list
const wordList = [
  "cat", "dog", "house", "tree", "car", "boat", "sun", "moon", "star", 
  "fish", "bird", "flower", "mountain", "beach", "computer", "phone",
  "book", "chair", "table", "door", "window", "pizza", "hamburger", 
  "airplane", "train", "bicycle", "robot", "monster", "dragon", "unicorn",
  "rainbow", "cloud", "rain", "snow", "fire", "guitar", "drum", "piano",
  "tiger", "lion", "elephant", "giraffe", "octopus", "dolphin", "shark",
  "king", "queen", "castle", "knight", "wizard", "superhero", "pirate"
];

// CORS options configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:5174",
    ];
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
};

// Apply CORS middleware to Express
app.use(cors(corsOptions));
app.use(express.json());

// Socket.IO setup with CORS options
const io = new Server(server, {
  cors: {
    origin: corsOptions.origin,
    methods: corsOptions.methods,
    allowedHeaders: corsOptions.allowedHeaders,
    credentials: corsOptions.credentials,
  },
  transports: ["websocket"], // Use only WebSocket to avoid polling issues
  pingTimeout: 60000, // Increase ping timeout to handle network hiccups
  pingInterval: 25000, // Ping client more frequently to detect disconnects faster
});

// Start the server
server.listen(3000, () => {
  console.log("Server running on port 3000");
});

// Add a graceful shutdown handler
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Socket.IO connection event
io.on("connection", (socket) => {
  console.log("A user connected with ID:", socket.id);

  socket.emit("sid", { sid: socket.id });

  // Handle room creation with settings
  socket.on("createRoom", ({ user, avatar, settings, userId }) => {
    try {
      if (!user) {
        socket.emit("joinError", { error: "Username is required" });
        return;
      }

      const roomId = generateUniqueRoomId();
      customSocketIds.set(socket.id, {
        userName: user,
        avatar: avatar,
        points: 0,
        isHost: true, // Mark as host
        userId: userId || socket.id // Store unique user ID
      });

      // Store room settings
      rooms.set(roomId, {
        hostId: socket.id,
        settings: settings || {
          maxPlayers: 8, // Default max players
          roundTime: 60, // Default round time in seconds
          rounds: 3,     // Default number of rounds
          wordOptions: 3 // Default number of word options
        },
        currentRound: 0,
        gameStarted: false,
        createdAt: Date.now()
      });

      // Initialize room drawing
      roomDrawings.set(roomId, []);

      socket.join(roomId);
      console.log(`User ${user} created and joined room: ${roomId} with settings:`, rooms.get(roomId).settings);
      socket.emit("roomCreated", { roomId, isHost: true });
    } catch (error) {
      console.error("Error in createRoom:", error);
      socket.emit("joinError", { error: "Failed to create room. Please try again." });
    }
  });

  // Handle joining room
  socket.on("joinRoom", ({ user, avatar, roomId, userId }) => {
    try {
      if (!user) {
        socket.emit("joinError", { error: "Username is required" });
        return;
      }

      if (!roomId) {
        console.error("No room ID provided when joining");
        socket.emit("joinError", { error: "No room ID provided" });
        return;
      }

      // Check if room exists
      if (!rooms.has(roomId)) {
        console.error(`Room ${roomId} does not exist`);
        socket.emit("joinError", { error: "Room does not exist" });
        return;
      }

      // Check if room is full
      const room = rooms.get(roomId);
      const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      if (roomSize >= room.settings.maxPlayers) {
        console.error(`Room ${roomId} is full`);
        socket.emit("joinError", { error: "Room is full" });
        return;
      }

      // Clear any pending reconnection timeout for this user
      if (userId && disconnectedUsers.has(userId)) {
        clearTimeout(disconnectedUsers.get(userId).timeout);
        disconnectedUsers.delete(userId);
        console.log(`Cleared reconnection timeout for user ${userId}`);
      }

      // Check if this user is the room host (ONLY if this is the original host rejoining)
      const isHost = room.hostId === userId;

      // Check if user is rejoining
      const isRejoining = userId && userProgress.has(userId);
      let userInfo = {
        userName: user,
        avatar: avatar,
        points: 0,
        isHost: isHost,
        userId: userId || socket.id,
        lastActive: Date.now()
      };

      // If user is rejoining, restore their progress
      if (isRejoining) {
        const progress = userProgress.get(userId);
        userInfo = {
          ...userInfo,
          points: progress.points || 0,
          // Only preserve host status if they were the original host
          isHost: isHost
        };
        console.log(`User ${user} is rejoining with previous progress:`, progress);
        socket.emit("progressRestored", progress);
      }

      // If this user is the host, update the room's hostId
      if (userInfo.isHost) {
        room.hostId = socket.id;
        rooms.set(roomId, room);
        console.log(`User ${user} identified as host for room ${roomId}`);
      }

      customSocketIds.set(socket.id, userInfo);
      socket.join(roomId);

      // Send the current canvas state to the new user
      const currentDrawing = roomDrawings.get(roomId);
      if (currentDrawing && currentDrawing.length > 0) {
        socket.emit("canvasState", currentDrawing);
      }

      console.log(`User ${user} joined room: ${roomId}, isHost: ${userInfo.isHost}`);
      socket.emit("roomJoined", {
        roomId,
        isHost: userInfo.isHost,
        settings: room.settings
      });

      updateRoomUsers(roomId);
    } catch (error) {
      console.error("Error in joinRoom:", error);
      socket.emit("joinError", { error: "Failed to join room. Please try again." });
    }
  });

  // Handle fetching room users
  socket.on("getRoomUsers", async ({ roomId }) => {
    try {
      const room = io.sockets.adapter.rooms.get(roomId);
      if (!room) {
        console.error(`Room ${roomId} not found`);
        return;
      }
      await updateRoomUsers(roomId);
    } catch (error) {
      console.error("Error in getRoomUsers:", error);
    }
  });

  // Handle room settings update
  socket.on("updateRoomSettings", ({ roomId, settings }) => {
    try {
      // Check if room exists
      if (!rooms.has(roomId)) {
        console.error(`Room ${roomId} does not exist`);
        return;
      }

      // Check if user is the host
      const userInfo = customSocketIds.get(socket.id);
      const room = rooms.get(roomId);

      if (!userInfo || !userInfo.isHost || room.hostId !== socket.id) {
        console.error(`User ${socket.id} is not authorized to change room settings`);
        socket.emit("settingsError", { error: "Not authorized to change settings" });
        return;
      }

      // Update settings
      room.settings = {
        ...room.settings,
        ...settings
      };
      rooms.set(roomId, room);

      console.log(`Room ${roomId} settings updated:`, room.settings);
      io.to(roomId).emit("roomSettingsUpdated", room.settings);
    } catch (error) {
      console.error("Error in updateRoomSettings:", error);
      socket.emit("settingsError", { error: "Failed to update settings" });
    }
  });

  // Save user progress when they leave or disconnect
  const saveUserProgress = () => {
    try {
      // Find all rooms the user is in
      const userInfo = customSocketIds.get(socket.id);
      if (!userInfo) return;

      // Save user progress
      userProgress.set(userInfo.userId, {
        points: userInfo.points,
        userName: userInfo.userName,
        avatar: userInfo.avatar,
        isHost: userInfo.isHost,
        lastActive: Date.now()
      });

      console.log(`Saved progress for user ${userInfo.userName}:`, userProgress.get(userInfo.userId));

      // Set a reconnection timeout for this user
      if (userInfo.userId) {
        // Clear any existing timeout
        if (disconnectedUsers.has(userInfo.userId)) {
          clearTimeout(disconnectedUsers.get(userInfo.userId).timeout);
        }

        // Set new timeout
        const timeout = setTimeout(() => {
          console.log(`Reconnection timeout for user ${userInfo.userId}`);
          userProgress.delete(userInfo.userId);
          disconnectedUsers.delete(userInfo.userId);
          // Update room users for all rooms this user was in
          socket.rooms.forEach(roomId => {
            if (roomId !== socket.id) {
              updateRoomUsers(roomId);
            }
          });
        }, RECONNECTION_TIMEOUT);

        disconnectedUsers.set(userInfo.userId, {
          timeout,
          userName: userInfo.userName,
          disconnectedAt: Date.now()
        });

        console.log(`Set reconnection timeout for user ${userInfo.userName} (${userInfo.userId})`);
      }
    } catch (error) {
      console.error("Error in saveUserProgress:", error);
    }
  };

  // Handle user disconnection
  socket.on("disconnect", () => {
    try {
      console.log("User disconnected:", socket.id);

      // Check if this user was a host of any room
      const userInfo = customSocketIds.get(socket.id);
      if (userInfo) {
        const wasHost = userInfo.isHost;
        
        // Get all rooms the user was in
        const userRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
        
        for (const roomId of userRooms) {
          const room = rooms.get(roomId);
          
          // If this user was the host of this room, need to handle host transfer
          if (room && room.hostId === socket.id) {
            console.log(`Host ${socket.id} disconnected from room ${roomId}`);
            
            // Mark that this room needs a new host, but don't assign yet
            // updateRoomUsers will handle the host reassignment
            room.needsNewHost = true;
            rooms.set(roomId, room);
          }
        }
      }
      
      saveUserProgress();
      
      // Get all rooms the user was in before deleting from customSocketIds
      const userRooms = Array.from(socket.rooms).filter(room => room !== socket.id);
      
      customSocketIds.delete(socket.id);

      // Update all rooms the user was part of
      userRooms.forEach((roomId) => {
        updateRoomUsers(roomId);
      });
    } catch (error) {
      console.error("Error in disconnect handler:", error);
    }
  });

  // Handle explicit leaving
  socket.on("leaveRoom", ({ roomId }) => {
    try {
      console.log(`User ${socket.id} leaving room ${roomId}`);
      saveUserProgress();
      socket.leave(roomId);
      updateRoomUsers(roomId);
    } catch (error) {
      console.error("Error in leaveRoom:", error);
    }
  });

  // Handle drawing events with canvas state tracking
  socket.on("draw", (data) => {
    try {
      console.log(`Draw event from ${socket.id} in room ${data.roomId}`);

      // Store drawing actions to recreate for users who join later
      if (data.roomId && roomDrawings.has(data.roomId)) {
        roomDrawings.get(data.roomId).push(data);

        // Cap the array size to prevent memory issues
        const maxDrawingActions = 1000;
        if (roomDrawings.get(data.roomId).length > maxDrawingActions) {
          // Keep only the most recent actions
          roomDrawings.set(
            data.roomId,
            roomDrawings.get(data.roomId).slice(-maxDrawingActions)
          );
        }
      }

      socket.to(data.roomId).emit("draw", data); // Emit to all clients in the room except the sender
    } catch (error) {
      console.error("Error in draw handler:", error);
    }
  });

  // Handle canvas clear
  socket.on("clearCanvas", ({ roomId }) => {
    try {
      if (roomId && roomDrawings.has(roomId)) {
        roomDrawings.set(roomId, []);
      }
      socket.to(roomId).emit("clearCanvas");
    } catch (error) {
      console.error("Error in clearCanvas:", error);
    }
  });

  // Handle guessing events with scoring
  socket.on("guess", (data) => {
    try {
      console.log(`Guess event from ${socket.id} in room ${data.roomId}: ${data.guess}`);

      const userInfo = customSocketIds.get(socket.id);
      if (!userInfo) {
        console.error(`No user info for socket ${socket.id}`);
        return;
      }

      const roomData = roomWords.get(data.roomId);
      if (!roomData) {
        // If game hasn't started, just broadcast the guess
        io.to(data.roomId).emit("guess", {
          user: userInfo.userName || "Unknown",
          guess: data.guess,
        });
        return;
      }

      // Don't allow the drawer to guess
      if (roomData.drawerId === socket.id) {
        socket.emit("guess", {
          user: "System",
          guess: "You are the drawer! You can't guess.",
        });
        return;
      }

      // Broadcast guess to all users
      io.to(data.roomId).emit("guess", {
        user: userInfo.userName || "Unknown",
        guess: data.guess,
      });
      
      // Check if the guess is correct
      if (roomData.currentWord && data.guess.trim().toLowerCase() === roomData.currentWord.toLowerCase()) {
        console.log(`Correct guess by ${userInfo.userName} in room ${data.roomId}: ${data.guess}`);
        
        // Check if user already guessed correctly for this round
        if (roomGuesses.has(data.roomId) && roomGuesses.get(data.roomId).has(socket.id)) {
          console.log(`User ${userInfo.userName} already guessed correctly this round`);
          return;
        }
        
        // Process correct guess
        handleCorrectGuess(socket, data.roomId, roomData.currentWord);
      }
    } catch (error) {
      console.error("Error in guess handler:", error);
    }
  });

  // Add a helper function to handle correct guesses 
  const handleCorrectGuess = async (socket, roomId, word) => {
    try {
      // Check if room exists
      if (!rooms.has(roomId) || !roomWords.has(roomId)) {
        return;
      }
      
      const roomData = roomWords.get(roomId);
      const currentWord = roomData.currentWord;
      
      // Verify this is the correct word
      if (!currentWord || word.toLowerCase() !== currentWord.toLowerCase()) {
        return;
      }
      
      // Get user info
      const userInfo = customSocketIds.get(socket.id);
      if (!userInfo) return;
      
      console.log(`Processing correct guess by ${userInfo.userName} in room ${roomId}`);
      
      // Initialize room guesses map if it doesn't exist
      if (!roomGuesses.has(roomId)) {
        roomGuesses.set(roomId, new Map());
      }
      
      // Check if user already guessed correctly
      const userGuesses = roomGuesses.get(roomId);
      if (userGuesses.has(socket.id)) {
        return; // User already guessed correctly this round
      }
      
      // Current time of the guess
      const guessTime = Date.now();
      
      // Add user to correct guesses map with their guess time
      userGuesses.set(socket.id, guessTime);
      roomGuesses.set(roomId, userGuesses);
      
      // Calculate points based on how quickly they guessed (0-200 scale)
      const room = rooms.get(roomId);
      const roundTime = room.settings.roundTime;
      const roundStartTime = roomData.roundStartTime || roomData.wordSelectedTime;
      const totalPoints = calculateGuesserScore(roundStartTime, guessTime, roundTime);
      
      // Update user's points
      userInfo.points += totalPoints;
      customSocketIds.set(socket.id, userInfo);
      
      // Save progress
      userProgress.set(userInfo.userId, {
        points: userInfo.points,
        userName: userInfo.userName,
        avatar: userInfo.avatar,
        isHost: userInfo.isHost,
        lastActive: Date.now()
      });
      
      console.log(`Awarded ${totalPoints} points to ${userInfo.userName} for correct guess`);
      
      // Emit updated leaderboard to all clients
      const leaderboard = await getRoomLeaderboard(roomId);
      io.to(roomId).emit("roomUsers", leaderboard);
      
      // Check if all users except drawer have guessed correctly
      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (!roomSockets) return;
      const drawerId = roomData.drawerId;
      let totalGuessers = 0;
      let correctGuessers = 0;
      for (const socketId of roomSockets) {
        if (socketId === drawerId) continue;
        totalGuessers++;
        if (userGuesses.has(socketId)) {
          correctGuessers++;
        }
      }
      const allGuessedCorrectly = totalGuessers > 0 && correctGuessers >= totalGuessers;
      
      console.log(`Room ${roomId} status: ${correctGuessers}/${totalGuessers} have guessed correctly`);
      
      // Always notify clients about the correct guess
      io.to(roomId).emit("playerGuessedCorrectly", {
        user: userInfo.userName,
        points: totalPoints,
        allGuessedCorrectly: allGuessedCorrectly
      });
      
      if (allGuessedCorrectly) {
        console.log(`All players in room ${roomId} have guessed correctly, ending round`);
        
        // Clear the round timer if it exists
        if (roomTimers.has(roomId)) {
          clearInterval(roomTimers.get(roomId).interval);
          clearTimeout(roomTimers.get(roomId).timeout);
          roomTimers.delete(roomId);
        }
        
        // Award points to drawer based on percentage of correct guessers and average guess time
        const drawerInfo = customSocketIds.get(drawerId);
        if (drawerInfo) {
          let totalGuessTime = 0;
          userGuesses.forEach((guessTime) => {
            totalGuessTime += guessTime - roundStartTime;
          });
          const avgGuessTime = totalGuessTime / userGuesses.size / 1000;
          const drawerPoints = calculateDrawerScore(correctGuessers, totalGuessers, avgGuessTime, roundTime);
          drawerInfo.points += drawerPoints;
          customSocketIds.set(drawerId, drawerInfo);
          userProgress.set(drawerInfo.userId, {
            points: drawerInfo.points,
            userName: drawerInfo.userName,
            avatar: drawerInfo.avatar,
            isHost: drawerInfo.isHost,
            lastActive: Date.now()
          });
          
          console.log(`Awarded ${drawerPoints} points to drawer ${drawerInfo.userName}`);
          
          io.to(roomId).emit("drawerEarnedPoints", {
            user: drawerInfo.userName,
            points: drawerPoints
          });
        }
        // Immediately notify clients that all users guessed correctly to stop the timer
        io.to(roomId).emit("roundComplete", {
          word: currentWord,
          autoCompleted: true,
          allGuessedCorrectly: true,
          immediate: true
        });
        // Emit updated leaderboard again
        const leaderboard2 = await getRoomLeaderboard(roomId);
        io.to(roomId).emit("roomUsers", leaderboard2);
        // Show leaderboard
        getRoomLeaderboard(roomId).then(leaderboard => {
          io.to(roomId).emit("showRoundLeaderboard", {
            leaderboard,
            duration: 5000
          });
          setTimeout(() => {
            advanceToNextDrawer(roomId);
          }, 5000);
        });
      }
    } catch (error) {
      console.error("Error in handleCorrectGuess:", error);
    }
  };

  // Handle when all players have guessed correctly
  socket.on("allPlayersGuessedCorrectly", async ({ roomId }) => {
    try {
      console.log(`All players guessed correctly notification from client in room ${roomId}`);
      
      // Get room data
      const roomData = roomWords.get(data.roomId);
      if (!roomData || !roomData.currentWord) {
        console.error(`No room data or current word for room ${roomId}`);
        return;
      }
      
      // Clear any round timer
      if (roomTimers.has(roomId)) {
        console.log(`Clearing timer for room ${roomId}`);
        clearInterval(roomTimers.get(roomId).interval);
        clearTimeout(roomTimers.get(roomId).timeout);
        roomTimers.delete(roomId);
      }
      
      // Notify all clients that all guesses are correct
      console.log(`Broadcasting allPlayersGuessedCorrectly to room ${roomId}`);
      io.to(roomId).emit("allPlayersGuessedCorrectly", {
        allGuessedCorrectly: true
      });
      
      // Get the current word and broadcast round complete
      const currentWord = roomData.currentWord;
      console.log(`Broadcasting roundComplete to room ${roomId}, word: ${currentWord}`);
      io.to(roomId).emit("roundComplete", {
        word: currentWord,
        autoCompleted: true,
        allGuessedCorrectly: true,
        immediate: true
      });
      
      // Show leaderboard after a brief delay
      console.log(`Scheduling leaderboard display for room ${roomId}`);
      setTimeout(async () => {
        const leaderboard = await getRoomLeaderboard(roomId);
        io.to(roomId).emit("showRoundLeaderboard", {
          leaderboard,
          duration: 5000
        });
        
        // Advance to next round/drawer after leaderboard is shown
        console.log(`Scheduling advancement to next drawer for room ${roomId}`);
        setTimeout(() => {
          console.log(`Advancing to next drawer for room ${roomId}`);
          advanceToNextDrawer(roomId);
        }, 5000);
      }, 1000);
    } catch (error) {
      console.error("Error in allPlayersGuessedCorrectly handler:", error);
    }
  });

  // Handle correct guesses
  socket.on("correctGuess", async ({ roomId, word }) => {
    // Use the shared handling function
    handleCorrectGuess(socket, roomId, word);
  });

  // Handle timer complete (this is now just a backup in case clients still send this)
  socket.on("timerComplete", ({ roomId }) => {
    handleTimerCompletion(roomId);
  });

  // Handle getting user information
  socket.on("getUser", () => {
    try {
      console.log("Fetching user for socket:", socket.id);
      const userInfo = customSocketIds.get(socket.id);
      socket.emit("getUserInfo", {
        userName: userInfo?.userName || "Unknown",
        points: userInfo?.points || 0,
        isHost: userInfo?.isHost || false
      });
    } catch (error) {
      console.error("Error in getUser:", error);
    }
  });

  // Handle canvas state request
  socket.on("requestCanvasState", ({ roomId }) => {
    try {
      const currentDrawing = roomDrawings.get(roomId);
      if (currentDrawing && currentDrawing.length > 0) {
        socket.emit("canvasState", currentDrawing);
      }
    } catch (error) {
      console.error("Error in requestCanvasState:", error);
    }
  });

  // Handle room settings request
  socket.on("requestRoomSettings", ({ roomId }) => {
    try {
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        socket.emit("roomSettingsUpdated", room.settings);
      }
    } catch (error) {
      console.error("Error in requestRoomSettings:", error);
    }
  });

  // Handle game state request
  socket.on("requestGameState", ({ roomId }) => {
    try {
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        socket.emit("gameState", {
          gameStarted: room.gameStarted || false,
          currentRound: room.currentRound || 0,
          totalRounds: room.settings.rounds
        });
      }
    } catch (error) {
      console.error("Error in requestGameState:", error);
    }
  });

  // Handle game start
  socket.on("startGame", ({ roomId }) => {
    try {
      // Check if room exists
      if (!rooms.has(roomId)) {
        console.error(`Room ${roomId} does not exist`);
        socket.emit("gameError", { error: "Room does not exist" });
        return;
      }

      // Check if user is the host
      const userInfo = customSocketIds.get(socket.id);
      const room = rooms.get(roomId);

      if (!userInfo || !userInfo.isHost || room.hostId !== socket.id) {
        console.error(`User ${socket.id} is not authorized to start the game`);
        socket.emit("gameError", { error: "Not authorized to start the game" });
        return;
      }

      // Update room state
      room.gameStarted = true;
      room.currentRound = 1;
      room.startTime = Date.now();
      
      console.log(`Game start requested for room ${roomId} by host ${userInfo.userName}`);
      
      // Get all players in the room and randomize their order
      io.in(roomId).fetchSockets().then(sockets => {
        const socketCount = sockets.length;
        if (socketCount === 0) {
          console.error(`No sockets found in room ${roomId} for game start`);
          socket.emit("gameError", { error: "No players in room" });
          return;
        }
        
        if (socketCount < 2) {
          console.error(`Only ${socketCount} socket in room ${roomId}, need at least 2 to play`);
          socket.emit("gameError", { error: "Need at least 2 players to start game" });
          return;
        }
        
        console.log(`Found ${socketCount} players in room ${roomId} for game start`);
        
        // Randomize player order
        const shuffledSockets = [...sockets].sort(() => 0.5 - Math.random());
        const playerOrder = shuffledSockets.map(s => s.id);
        
        // Log player order details
        console.log(`Randomized player order for room ${roomId}:`, 
          playerOrder.map(id => {
            const userInfo = customSocketIds.get(id);
            return userInfo ? userInfo.userName : id;
          })
        );
        
        // Store player order for the room
        roomPlayerOrder.set(roomId, {
          order: playerOrder,
          currentDrawerIndex: 0
        });
        
        // Save the room settings
        rooms.set(roomId, room);
        
        // Add a 5-second countdown before game actually starts
        console.log(`Broadcasting 5-second game countdown to room ${roomId}`);
        io.to(roomId).emit("gameState", {
          gameStarted: true,
          countdown: 5,
          currentRound: 1,
          totalRounds: room.settings.rounds
        });
        
        // Select the first drawer after 5 seconds
        setTimeout(() => {
          console.log(`Starting round 1 for room ${roomId} after countdown`);
          selectNextDrawerForRoom(roomId);
        }, 5000);
      }).catch(error => {
        console.error(`Error fetching sockets for room ${roomId}:`, error);
        socket.emit("gameError", { error: "Error starting game" });
      });
    } catch (error) {
      console.error("Error in startGame:", error);
      socket.emit("gameError", { error: "Failed to start game" });
    }
  });

  // Handle round completion
  socket.on("completeRound", async ({ roomId }) => {
    try {
      // Check if room exists
      if (!rooms.has(roomId)) {
        console.error(`Room ${roomId} does not exist`);
        return;
      }

      // Check if user is the host
      const userInfo = customSocketIds.get(socket.id);
      const room = rooms.get(roomId);

      if (!userInfo || !userInfo.isHost || room.hostId !== socket.id) {
        console.error(`User ${socket.id} is not authorized to control rounds`);
        return;
      }
      
      // First, get the leaderboard if not auto-completed
      const roomData = roomWords.get(roomId);
      if (roomData && roomData.currentWord) {
        // Award points to drawer if they didn't get points yet
        const drawerId = roomData.drawerId;
        const drawerInfo = customSocketIds.get(drawerId);
        
        // Get number of correct guesses
        const userGuesses = roomGuesses.get(roomId) || new Set();
        const numUsersInRoom = io.sockets.adapter.rooms.get(roomId)?.size || 0;
        const numCorrectGuesses = userGuesses.size;
        
        if (drawerInfo && numCorrectGuesses > 0) {
          // Award points to drawer based on percentage of users who guessed correctly
          const guessPercentage = numCorrectGuesses / (numUsersInRoom - 1);
          const drawerPoints = Math.floor(50 * guessPercentage);
          
          drawerInfo.points += drawerPoints;
          customSocketIds.set(drawerId, drawerInfo);
          
          // Notify everyone about drawer points
          io.to(roomId).emit("drawerEarnedPoints", {
            user: drawerInfo.userName,
            points: drawerPoints
          });
        }
        
        // Show round word if not yet shown
        io.to(roomId).emit("roundComplete", {
          word: roomData.currentWord
        });
        
        // Show leaderboard
        const leaderboard = await getRoomLeaderboard(roomId);
        io.to(roomId).emit("showRoundLeaderboard", {
          leaderboard,
          duration: 5000
        });
        
        // Wait 5 seconds before starting next round
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Clear guesses for this room
      roomGuesses.delete(roomId);
      
      // Update round counter
      room.currentRound += 1;
      const isGameOver = room.currentRound > room.settings.rounds;
      
      if (isGameOver) {
        room.gameStarted = false;
        room.currentRound = 0;
        
        // Game over - emit final scores
        const leaderboard = await getRoomLeaderboard(roomId);
        io.to(roomId).emit("gameState", {
          gameStarted: false,
          isGameOver: true,
          gameResults: leaderboard
        });
      } else {
        // Clear canvas for next round
        roomDrawings.set(roomId, []);
        io.to(roomId).emit("clearCanvas");
        
        // Select a new drawer
        selectNextDrawerForRoom(roomId);
        
        // Start next round with countdown
        io.to(roomId).emit("gameState", {
          gameStarted: true,
          countdown: 5,
          currentRound: room.currentRound,
          totalRounds: room.settings.rounds
        });
      }
      
      rooms.set(roomId, room);
    } catch (error) {
      console.error("Error in completeRound:", error);
    }
  });

  // Handle word selection
  socket.on("selectWord", ({ roomId, wordIndex }) => {
    try {
      console.log(`Word selection request - Room: ${roomId}, Index: ${wordIndex}`);
      
      // Check if room exists and user is the current drawer
      if (!rooms.has(roomId) || !roomWords.has(roomId)) {
        console.error(`Room ${roomId} not found or no word data`);
        return;
      }
      
      const roomData = roomWords.get(roomId);
      if (roomData.drawerId !== socket.id) {
        console.error(`User ${socket.id} is not the designated drawer ${roomData.drawerId}`);
        return;
      }
      
      // Get the selected word
      const wordOptions = roomData.wordOptions;
      if (!wordOptions || wordIndex >= wordOptions.length) {
        console.error(`Invalid word index ${wordIndex} (max: ${wordOptions?.length - 1})`);
        return;
      }
      
      const selectedWord = wordOptions[wordIndex];
      roomData.currentWord = selectedWord;
      
      // Set both timestamps to make sure they're properly initialized
      const now = Date.now();
      roomData.wordSelectedTime = now;
      roomData.roundStartTime = now;
      
      roomWords.set(roomId, roomData);
      
      console.log(`Word "${selectedWord}" selected for room ${roomId}`);
      
      // Notify drawer about the selected word
      socket.emit("wordSelected", { word: selectedWord });
      
      // Let ALL clients know a word was selected with updated game state
      io.to(roomId).emit("gameState", {
        wordSelected: true,
        currentDrawer: roomData.drawerName
      });

      // Let guessers know the word length and hint
      socket.to(roomId).emit("wordSelected", { 
        length: selectedWord.length,
        hint: selectedWord.replace(/[a-zA-Z]/g, '_')
      });
      
      // Clear the canvas for a fresh start with the new word
      roomDrawings.set(roomId, []);
      io.to(roomId).emit("clearCanvas");
      
      // Start the server-side timer for this round
      startRoundTimer(roomId);
    } catch (error) {
      console.error("Error in selectWord:", error);
    }
  });
}); 