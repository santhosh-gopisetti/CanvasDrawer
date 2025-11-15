# Real Time Collaborative Canvas Drawer

A simple real-time collaborative canvas drawing app. This project lets multiple users draw on the same canvas at the same time. Built with vanilla JavaScript, Node.js, and Socket.io.

## Features

* **Real-time Collaboration**: See what others draw, as they draw it.
* **Online User List**: Asks for your name on entry and shows who is currently online.
* **Live Cursors**: See the mouse position of every other user.
* **Tools**: Brush and Eraser with adjustable color and stroke width.
* **Global Undo/Redo**: All users share the same drawing history.
* **Save as PNG**: A "Save" button to download the current canvas.

## Setup & Testing

1.  **Clone the repo**:
    ```bash
    git clone [https://github.com/santhosh-gopisetti/CanvasDrawer.git](https://github.com/santhosh-gopisetti/CanvasDrawer.git)
    cd canvasd
    ```

2.  **Install & Run**:
    This single command will install all dependencies and start the server.
    ```bash
    npm install && npm start
    ```
    The server will be running at `https://canvasdrawer.onrender.com/`.

3.  **Test with Multiple Users**:
    To test the collaboration features, just **open `https://canvasdrawer.onrender.com/` in multiple browser tabs**. Each tab will act as a separate user.

## Controls

* **Tools**: Use the "Brush" and "Eraser" buttons to switch modes.
* **Color Picker**: Selects the color for the brush.
* **Width Slider**: Adjusts the stroke width for both brush and eraser.
* **Undo/Redo**: Click the buttons or use keyboard shortcuts:
    * **Undo**: `Ctrl/Cmd + Z`
    * **Redo**: `Ctrl/Cmd + Y`
* **Clear**: Wipes the entire canvas for all users (requires confirmation).

## Known Limitations

This is a simple project, so it has a few limitations:

* **No Persistence**: Drawings are stored in memory. If the server restarts, the canvas is cleared.
* **Single Room**: Everyone who joins is put into the same global canvas.
* **Simple Auth**: Uses a basic `prompt` for a username. There is no secure login system.
* **Desktop Only**: The app is not optimized for mobile or touch-screen devices.

## Time Spent

* **Total Time Spent**: 4 DAYS

## Tech Stack

* **Frontend**: Vanilla JavaScript, HTML5 Canvas, CSS
* **Backend**: Node.js, Express.js
* **Real-time**: Socket.io
