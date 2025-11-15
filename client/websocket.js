export class WebSocketManager{
  constructor(){
    this.socket=null;
    this.roomId="default";
    this.userId=null;
    this.userColor=null;
    this.userName=null;
    this.connected=false;
    this.sendBuffer=[];
    this.sendInterval=null;
    this.callbacks={};
  }

  connect(userName){
    this.socket=io();
    this.userName=userName;

    this.socket.on("connect",()=>{
      console.log("Connected to server");
      this.connected=true;
      this._emit("join-room",{
        name:this.userName,
      });
      this.callbacks.onConnect?.();
    });

    this.socket.on("disconnect",()=>{
      console.log("Disconnected from server");
      this.connected=false;
      this.callbacks.onDisconnect?.();
    });

    this.socket.on("connect_error",(err)=>{console.error("Connection error:",err.message)});
    this.socket.io.on("reconnect_attempt",()=>{console.log("Attempting to reconnect...")});
    this.socket.io.on("reconnect_error",(err)=>{console.error("Reconnect failed:",err.message)});

    this.socket.io.on("reconnect",()=>{
      console.log("Reconnected successfully!");
      this._emit("join-room",{
        name:this.userName,
      });
    });

    this.socket.on("init-canvas",(data)=>{
      this.userId=data.userId;
      this.userColor=data.userColor;
      this.callbacks.onInit?.(data);
    });

    this.socket.on("drawing-start",(data)=>{
      if(data.userId!==this.userId){
        this.callbacks.onDrawingStart?.(data);
      }
    });

    this.socket.on("drawing-progress",(data)=>{
      if(data.userId!==this.userId&&Array.isArray(data.points)){
        data.points.forEach((point)=>{
          this.callbacks.onDrawingProgress?.({
            userId:data.userId,
            point:point,
            color:data.color,
            width:data.width,
            tool:data.tool,
          });
        });
      }
    });

    this.socket.on("drawing-end",(data)=>{
      if(data.userId!==this.userId){
        this.callbacks.onDrawingEnd?.(data);
      }
    });

    this.socket.on("undo",(data)=>{this.callbacks.onUndo?.(data)});
    this.socket.on("redo",(data)=>{this.callbacks.onRedo?.(data)});
    this.socket.on("clear-canvas",()=>{this.callbacks.onClear?.()});
    this.socket.on("users-update",(users)=>{this.callbacks.onUsersUpdate?.(users)});
    this.socket.on("cursor-move",(data)=>{this.callbacks.onCursorMove?.(data)});
    this.socket.on("cursor-remove",(data)=>{this.callbacks.onCursorRemove?.(data)});
  }

  _emit(event,data={}){
    if(!this.connected){
      return;
    }
    this.socket.emit(event,{...data,roomId:this.roomId});
  }

  emitDrawingStart(point,color,width,tool){
    if(!this.connected){
      return;
    }

    this.socket.emit("drawing-start",{
      roomId:this.roomId,
      point,
      color,
      width,
      tool,
    });

    this.sendBuffer=[];
    if(!this.sendInterval){
      this.sendInterval=setInterval(()=>{this.flushDrawingBuffer()},25);
    }
  }

  emitDrawingProgress(point){
    if(!this.connected){
      return;
    }
    this.sendBuffer.push({x:point.x,y:point.y});
  }

  flushDrawingBuffer(){
    if(!this.connected||this.sendBuffer.length===0){
      return;
    }

    const batch=this.sendBuffer;
    this.sendBuffer=[];

    this.socket.emit("drawing-progress",{
      roomId:this.roomId,
      points:batch,
    });
  }

  emitDrawingEnd(stroke){
    if(!this.connected){
      return;
    }

    this.flushDrawingBuffer();
    if(this.sendInterval){
      clearInterval(this.sendInterval);
      this.sendInterval=null;
    }

    this.socket.emit("drawing-end",{
      roomId:this.roomId,
      stroke,
    });
  }

  emitCursorMove(x,y){this._emit("cursor-move",{x:y});}
  emitUndo(){this._emit("undo");}
  emitRedo(){this._emit("redo");}
  emitClear(){this._emit("clear-canvas");}

  on(event,callback){
    this.callbacks[event]=callback;
  }

  disconnect(){
    if(this.socket){
      clearInterval(this.sendInterval);
      this.socket.disconnect();
      this.socket=null;
    }
  }
}