# Sketch.io

A real-time drawing and guessing game with reconnection support and customizable rooms.

## Project Structure

This repository contains both the client and server components of the Sketch.io application:

- `/server` - Express and Socket.io backend
- `/app/scribble` - React/Vite frontend

## Quick Start

1. Install server dependencies:
   ```
   cd server
   npm install
   ```

2. Install client dependencies:
   ```
   cd ../app/scribble
   npm install
   ```

3. Run the server (from server directory):
   ```
   npm run dev
   ```

4. Run the client (from app/scribble directory):
   ```
   npm run dev
   ```

5. Open your browser to http://localhost:5173

For complete documentation, see the README in `/app/scribble`. 