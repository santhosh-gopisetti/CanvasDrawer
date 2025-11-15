# Collaborative Canvas - Architecture

This document outlines the technical architecture, data flow, and design decisions for the Live Canvas Drawer application.

## System Architecture

The app uses a client-server model. Clients (browsers) communicate with a central Node.js server via WebSockets. The server is the single source of truth for the drawing state and user management.

┌─────────────────────────────────────────────────────────────┐
│                       Browser Clients                       │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│   │   Client 1   │   │   Client 2   │   │   Client N   │   │
│   │ (main.js)    │   │ (main.js)    │   │ (main.js)    │   │
│   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   │
└──────────┼─────────────────┼─────────────────┼─────────────┘
           │      Socket.io WebSocket Connection     │
┌──────────┼─────────────────┼─────────────────┼─────────────┐
│          ▼                 ▼                 ▼              │
│ ┌──────────────────────────────────────────────────┐        │
│ │          Socket.io Server (server.js)            │        │
│ │   - Connection & Event Handling                  │        │
│ │   - Broadcasting to Rooms                        │        │
│ └────────┬─────────────────────────┬─────────────┘        │
│          │                         │                      │
│ ┌────────▼──────────┐     ┌────────▼───────────┐          │
│ │   RoomManager     │     │   DrawingState     │          │
│ │    (rooms.js)     │     │ (drawing-state.js) │          │
│ │ - User tracking   │     │ - Operation stack  │          │
│ │ - Room state      │     │ - Undo/Redo stack  │          │
│ └───────────────────┘     └────────────────────┘          │
│                      Node.js Server                       │
└─────────────────────────────────────────────────────────────┘

---

## Data Flow Diagrams

### New User Join Flow

┌──────────────┐
│  New user    │
│  connects    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│ Client: Socket connects                          │
│ - Emits 'join-room' event with name              │
└──────┬───────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│ Server: Processes join-room                      │
│ - RoomManager.addUser()                          │
│ - Get/Create DrawingState for room               │
│ - Emit 'init-canvas' to new user ONLY            │
│   * Send all historical operations               │
│ - Broadcast 'users-update' to ALL in room        │
└──────┬───────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│ New Client: Receives 'init-canvas'               │
│ - Store operations[] locally                     │
│ - Canvas.redrawCanvas(operations)                │
│   * Replay entire drawing history                │
└──────────────────────────────────────────────────┘


### Drawing Operation Flow

┌──────────────┐
│ User starts  │
│  drawing     │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│ Client: mousedown event                          │
│ - WebSocket.emitDrawingStart(...)                │
└──────┬───────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│ Client: mousemove events (while drawing)         │
│ - Canvas.draw(point) [local immediate render]    │
│ - WebSocket.emitDrawingProgress(point) [batched] │
└──────┬───────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│ Server: Receives 'drawing-progress'              │
│ - Broadcasts to other clients in room            │
└──────┬───────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│ Other Clients: Receive 'drawing-progress'        │
│ - Canvas.drawRemoteStrokeProgress()              │
└──────┬───────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│ Client: mouseup event                            │
│ - WebSocket.emitDrawingEnd(stroke)               │
└──────┬───────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│ Server: Receives 'drawing-end'                   │
│ - DrawingState.addOperation(operation)           │
│ - Broadcasts operation to ALL clients (for sync) │
└──────────────────────────────────────────────────┘


---

## WebSocket Protocol

### Client → Server Events

* **`join-room`**: `{ roomId, name }`
    * Sent on connect. Registers the user with their chosen name.
* **`drawing-start`**: `{ roomId, point, color, width, tool }`
    * Sent on `mousedown`.
* **`drawing-progress`**: `{ roomId, points: [...] }`
    * Sent on `mousemove`, batched into arrays of points.
* **`drawing-end`**: `{ roomId, stroke: { points, color, width, tool } }`
    * Sent on `mouseup`. This is the "final" operation.
* **`cursor-move`**: `{ roomId, x, y }`
    * Sent on `mousemove` (relative 0-1 coordinates).
* **`undo`**: `{ roomId }`
* **`redo`**: `{ roomId }`
* **`clear-canvas`**: `{ roomId }`

### Server → Client Events

* **`init-canvas`**: `{ operations: [...], userId, userColor }`
    * Sent **only to the new user** on join. Contains the entire drawing history.
* **`drawing-start`**: `{ userId, point, color, width, tool }`
    * Broadcast to *other* users.
* **`drawing-progress`**: `{ userId, points: [...], color, width, tool }`
    * Broadcast to *other* users.
* **`drawing-end`**: `{ userId, stroke: { ... } }`
    * Broadcast to **all users** to finalize the stroke in history.
* **`users-update`**: `Array<{ id, name, color }>`
    * Broadcast to all users when anyone joins or leaves.
* **`cursor-move`**: `{ userId, x, y }`
    * Broadcast to *other* users.
* **`cursor-remove`**: `{ userId }`
    * Broadcast to all users when a user disconnects.
* **`undo` / `redo`**: `{ canUndo, canRedo }`
    * Broadcast to **all users** to trigger a history change.
* **`clear-canvas`**: `{}`
    * Broadcast to **all users**.

---

## Global Undo/Redo Strategy

The server is the single source of truth for history.

1.  **Stateful Server**: The `drawing-state.js` class on the server maintains two arrays:
    * `operations[]`: The main list of all strokes currently on the canvas.
    * `redoStack[]`: A temporary list of strokes that have been undone.

2.  **Undo Flow**:
    * A client emits `undo`.
    * The server `pop()`s the last stroke from `operations[]` and `push()`es it onto `redoStack[]`.
    * The server broadcasts an `undo` event to **all clients**.
    * **All clients** (simultaneously) pop the last stroke from their *local* history and completely redraw the canvas.

3.  **Redo Flow**:
    * A client emits `redo`.
    * The server `pop()`s from `redoStack[]` and `push()`es it back onto `operations[]`.
    * The server broadcasts a `redo` event.
    * All clients add the stroke back to their history and redraw.

4.  **New Drawing**: When any user completes a new stroke, the `redoStack[]` on the server is cleared.

This strategy is simple and guarantees that all clients see the exact same canvas state.

---

## Performance Decisions

* **Optimistic Local Rendering**: When you draw, the line appears on your screen *immediately* (on `mousemove`). The data is sent to the server in the background. This makes the app feel fast, with zero perceived latency for the person drawing.
* **Drawing Update Batching**: Instead of emitting a WebSocket event for every single pixel the mouse moves (which could be 100+ events/sec), `websocket.js` collects points in an array and sends them in batches every `25ms`. This dramatically reduces network traffic.
* **Canvas Redraw on History Change**: When undoing, we don't try to "erase" the last stroke. We simply clear the entire canvas and redraw all (N-1) operations. This is faster and far less error-prone than trying to reverse a complex drawing operation.
* **Relative Cursor Coordinates**: Cursors are sent as relative (0.0 to 1.0) coordinates, so they map correctly even if users have different screen sizes or browser windows.

---

## Conflict Resolution

This architecture avoids conflicts by design.

* **Server Authority**: The server is the single source of truth. A stroke is not "real" until the server has received it and broadcast it as a final `drawing-end` event.
* **Event Serialization**: Socket.io handles events in the order they are received. If two users finish drawing at the *exact same time*, the server will process one, add it to the history, and then process the other.
* **No "Merge" Needed**: Because all events are put into a single, ordered list (`operations[]`) on the server, there is no such thing as a "merge conflict." All clients receive the same list of operations in the same order and will always render the same image.# Collaborative Canvas - Architecture

This document outlines the technical architecture, data flow, and design decisions for the Live Canvas Drawer application.
