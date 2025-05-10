# Sketch.io - Real-time Drawing and Guessing Game

Sketch.io is a collaborative drawing and guessing game where users can create rooms, invite friends, and play a game similar to Pictionary. One player draws a chosen word while others try to guess it through the chat.

## Features

- **Create and Join Rooms**: Set up private rooms with custom settings and share the room ID with friends
- **Drawing Canvas**: Intuitive drawing tools with various colors, stroke sizes, and eraser
- **Real-time Guessing**: Players can guess the word in real-time with intelligent feedback
- **Reconnection Support**: If a player disconnects, they have 2 minutes 30 seconds to reconnect without losing points
- **Customizable Game Settings**: Hosts can customize max players, round time, number of rounds and word options

## How to Play

1. **Create or Join a Room**
   - The host creates a room and shares the room ID with friends
   - Friends can join by entering the room ID
   
2. **Room Setup**
   - Set your display name and select an avatar
   - The host can customize game settings
   
3. **Game Flow**
   - The host starts the game
   - One player becomes the drawer and picks a word to draw
   - Other players guess the word in the chat
   - Points are awarded for correct guesses
   - Players take turns drawing until all rounds are complete
   
4. **Reconnection Support**
   - If disconnected, players have 2 minutes 30 seconds to rejoin using the same room ID
   - Progress and points are automatically restored upon reconnection

## Technical Overview

Sketch.io is built with:

- React (frontend)
- Express (backend)
- Socket.io (real-time communication)
- Tailwind CSS (styling)

## Getting Started

### Prerequisites

- Node.js (v14 or newer)
- npm or yarn

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/sketch.io.git
   cd sketch.io
   ```

2. Install server dependencies
   ```
   cd server
   npm install
   ```

3. Install client dependencies
   ```
   cd ../app/scribble
   npm install
   ```

### Running the Application

1. Start the server (from the server directory)
   ```
   npm run dev
   ```

2. Start the client (from the app/scribble directory)
   ```
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`

## Development

- The server runs on port 3000
- The client runs on port 5173 (default Vite port)
- Socket.io is configured to use WebSocket transport only for better performance

## License

This project is licensed under the MIT License - see the LICENSE file for details.
