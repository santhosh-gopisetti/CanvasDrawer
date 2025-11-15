const express=require('express');
const http=require('http');
const socketIo=require('socket.io');
const path=require('path');
const DrawingState=require('./drawing-state');
const RoomManager=require('./rooms');

const app=express();
const server=http.createServer(app);
const io=socketIo(server,{
  cors:{origin:'*',methods:['GET','POST']},
});

const roomManager=new RoomManager();
const DEFAULT_ROOM='default';

app.use(express.static(path.join(__dirname,'../client')));

app.get('/',(req,res)=>{
  res.sendFile(path.join(__dirname,'../client/index.html'));
});

io.on('connection',(socket)=>{
  console.log(`User connected: ${socket.id}`);

  socket.currentStroke=null;

  socket.on('join-room',(data)=>{
    const roomId=data.roomId||DEFAULT_ROOM;
    socket.join(roomId);

    let drawingState=roomManager.getDrawingState(roomId);
    if(!drawingState){
      drawingState=new DrawingState();
      roomManager.setDrawingState(roomId,drawingState);
    }

    const user=roomManager.addUser(roomId,socket.id,{
      name:data.name,
      color:data.color||`hsl(${Math.floor(Math.random()*360)}, 70%, 60%)`,
    });

    socket.emit('init-canvas',{
      operations:drawingState.getOperations(),
      userId:socket.id,
      userColor:user.color,
    });

    io.to(roomId).emit('users-update',roomManager.getUsers(roomId));
  });

  socket.on('drawing-start',(data)=>{
    const roomId=data.roomId||DEFAULT_ROOM;
    
    socket.currentStroke={
      color:data.color,
      width:data.width,
      tool:data.tool,
    };

    socket.to(roomId).emit('drawing-start',{
      userId:socket.id,
      ...data,
    });
  });

  socket.on('drawing-progress',(data)=>{
    const roomId=data.roomId||DEFAULT_ROOM;
    
    if(!socket.currentStroke||!data.points){
      return;
    }

    socket.to(roomId).emit('drawing-progress',{
      userId:socket.id,
      points:data.points,
      ...socket.currentStroke,
    });
  });

  socket.on('drawing-end',(data)=>{
    const roomId=data.roomId||DEFAULT_ROOM;
    const drawingState=roomManager.getDrawingState(roomId);
    if(!drawingState){
      return;
    }

    socket.currentStroke=null;

    const operation={
      type:'stroke',
      ...(data.stroke||{
        points:data.points||[],
        color:data.color,
        width:data.width,
        tool:data.tool,
      }),
      timestamp:Date.now(),
    };

    drawingState.addOperation(operation);

    io.to(roomId).emit('drawing-end',{
      userId:socket.id,
      stroke:operation,
    });
  });

  socket.on('clear-canvas',(data)=>{
    const roomId=data.roomId||DEFAULT_ROOM;
    const drawingState=roomManager.getDrawingState(roomId);
    if(drawingState){
      drawingState.clear();
      io.to(roomId).emit('clear-canvas');
    }
  });

  socket.on('undo',(data)=>{
    const roomId=data.roomId||DEFAULT_ROOM;
    const drawingState=roomManager.getDrawingState(roomId);
    if(!drawingState){
      return;
    }
    
    const op=drawingState.undo();
    if(op){
      io.to(roomId).emit('undo',{
        operation:op,
        canUndo:drawingState.canUndo(),
        canRedo:drawingState.canRedo(),
      });
    }
  });

  socket.on('redo',(data)=>{
    const roomId=data.roomId||DEFAULT_ROOM;
    const drawingState=roomManager.getDrawingState(roomId);
    if(!drawingState){
      return;
    }
    
    const op=drawingState.redo();
    if(op){
      io.to(roomId).emit('redo',{
        operation:op,
        canUndo:drawingState.canUndo(),
        canRedo:drawingState.canRedo(),
      });
    }
  });

  socket.on('cursor-move',(data)=>{
    const roomId=data.roomId||DEFAULT_ROOM;
    socket.to(roomId).emit('cursor-move',{
      userId:socket.id,
      x:data.x,
      y:data.y,
    });
  });

  socket.on('disconnect',()=>{
    console.log(`User disconnected: ${socket.id}`);
    socket.currentStroke=null;

    socket.rooms.forEach((roomId)=>{
      if(roomId===socket.id){
        return;
      }

      roomManager.removeUser(roomId,socket.id);
      
      io.to(roomId).emit('users-update',roomManager.getUsers(roomId));
      io.to(roomId).emit('cursor-remove',{userId:socket.id});
    });
  });
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>
  console.log(`Server running at http://localhost:${PORT}`)
);