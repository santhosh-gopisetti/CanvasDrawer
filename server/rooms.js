class RoomManager{
  constructor(){
    this.rooms=new Map();
  }

  _getOrCreateRoom(roomId){
    if(!this.rooms.has(roomId)){
      this.rooms.set(roomId,{
        users:new Map(),
        drawingState:null,
      });
    }
    return this.rooms.get(roomId);
  }

  addUser(roomId,socketId,userData){
    const room=this._getOrCreateRoom(roomId);
    
    const newUser={
      id:socketId,
      name:userData.name,
      color:userData.color,
    };

    room.users.set(socketId,newUser);
    console.log(`Added user ${newUser.name} (${socketId}) to room ${roomId}`);
    return newUser;
  }

  removeUser(roomId,socketId){
    const room=this.rooms.get(roomId);
    if(!room){
      return;
    }

    const user=room.users.get(socketId);
    room.users.delete(socketId);
    console.log(`Removed user ${user?.name||socketId} from room ${roomId}`);

    if(room.users.size===0){
      this.rooms.delete(roomId);
      console.log(`Deleted empty room: ${roomId}`);
    }
  }

  getUsers(roomId){
    const room=this.rooms.get(roomId);
    return room?Array.from(room.users.values()):[];
  }

  setDrawingState(roomId,drawingState){
    const room=this._getOrCreateRoom(roomId);
    room.drawingState=drawingState;
  }

  getDrawingState(roomId){
    const room=this.rooms.get(roomId);
    return room?room.drawingState:null;
  }
}

module.exports=RoomManager;