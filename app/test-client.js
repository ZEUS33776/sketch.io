const { io } = require("socket.io-client");

// Connect to the server
const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("Connected to server with ID:", socket.id);
  
  // Set up event handlers
  socket.on("sid", (data) => {
    console.log("Received socket ID:", data.sid);
  });
  
  socket.on("roomJoined", (data) => {
    console.log("Joined room:", data);
    
    // Listen for drawer assignment
    socket.on("drawerAssigned", (data) => {
      console.log("Drawer assigned:", data);
    });
    
    socket.on("assignedAsDrawer", (data) => {
      console.log("I am assigned as drawer:", data);
      
      // If we have word options, select the first one
      if (data.wordOptions && data.wordOptions.length > 0) {
        console.log("Selecting word:", data.wordOptions[0]);
        socket.emit("selectWord", { roomId: room.id, wordIndex: 0 });
      }
    });
    
    socket.on("wordSelected", (data) => {
      console.log("Word selected:", data);
      
      // Set up test guesser after a short delay
      if (data.word) {
        setTimeout(() => {
          console.log("Testing incorrect and correct guesses...");
          
          // Test an incorrect guess
          socket.emit("guess", { roomId: room.id, guess: "wrong guess" });
          
          // Test the correct guess
          setTimeout(() => {
            console.log("Sending correct guess:", data.word);
            socket.emit("guess", { roomId: room.id, guess: data.word });
          }, 2000);
        }, 2000);
      }
    });
    
    socket.on("guess", (data) => {
      console.log("Received guess:", data);
    });
    
    socket.on("playerGuessedCorrectly", (data) => {
      console.log("Player guessed correctly:", data);
    });
    
    socket.on("roundComplete", (data) => {
      console.log("Round complete:", data);
    });
    
    // Start a 2-player game
    setTimeout(() => {
      console.log("Starting game...");
      socket.emit("startGame", { roomId: room.id });
    }, 1000);
  });
  
  // Create a room and join it
  const user = {
    userName: "TestUser",
    avatar: "https://example.com/avatar.jpg"
  };
  
  const room = {
    id: null
  };
  
  console.log("Creating room...");
  socket.emit("createRoom", {
    user: user.userName,
    avatar: user.avatar,
    settings: {
      maxPlayers: 8,
      roundTime: 60,
      rounds: 3,
      wordOptions: 3
    }
  });
  
  socket.on("roomCreated", (data) => {
    console.log("Room created:", data);
    room.id = data.roomId;
    
    // Create a second player
    const socket2 = io("http://localhost:3000");
    
    socket2.on("connect", () => {
      console.log("Player 2 connected with ID:", socket2.id);
      
      socket2.on("roomJoined", (data) => {
        console.log("Player 2 joined room:", data);
      });
      
      socket2.on("wordSelected", (data) => {
        console.log("Player 2 received word info:", data);
      });
      
      socket2.on("drawerAssigned", (data) => {
        console.log("Player 2: Drawer assigned:", data);
      });
      
      socket2.on("playerGuessedCorrectly", (data) => {
        console.log("Player 2: Player guessed correctly:", data);
      });
      
      console.log("Player 2 joining room:", room.id);
      socket2.emit("joinRoom", {
        roomId: room.id,
        user: "TestPlayer2",
        avatar: "https://example.com/avatar2.jpg"
      });
    });
  });
});

socket.on("error", (error) => {
  console.error("Socket error:", error);
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
}); 