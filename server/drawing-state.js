const MAX_HISTORY=5000;

class DrawingState{
  constructor(){
    this.operations=[];
    this.redoStack=[];
  }

  addOperation(operation){
    this.operations.push(operation);

    if(this.operations.length>MAX_HISTORY){
      this.operations.shift();
    }

    this.redoStack=[];
  }

  undo(){
    if(this.operations.length===0){
      return null;
    }
    const operation=this.operations.pop();
    this.redoStack.push(operation);
    return operation;
  }

  redo(){
    if(this.redoStack.length===0){
      return null;
    }
    const operation=this.redoStack.pop();
    this.operations.push(operation);
    return operation;
  }

  getOperations(){
    return JSON.parse(JSON.stringify(this.operations));
  }

  canUndo(){
    return this.operations.length>0;
  }

  canRedo(){
    return this.redoStack.length>0;
  }

  clear(){
    this.operations=[];
    this.redoStack=[];
  }
}

module.exports=DrawingState;