import {CanvasManager} from './canvas.js';
import {WebSocketManager} from './websocket.js';

class CollaborativeCanvas{
  constructor(){
    this.dom={
      canvas:document.getElementById('canvas'),
      cursorsOverlay:document.getElementById('cursors-overlay'),
      brushBtn:document.getElementById('brush-btn'),
      eraserBtn:document.getElementById('eraser-btn'),
      colorPicker:document.getElementById('color-picker'),
      widthSlider:document.getElementById('width-slider'),
      widthValue:document.getElementById('width-value'),
      undoBtn:document.getElementById('undo-btn'),
      redoBtn:document.getElementById('redo-btn'),
      clearBtn:document.getElementById('clear-btn'),
      saveBtn:document.getElementById('save-btn'),
      userList:document.getElementById('user-list'),
      userCount:document.getElementById('user-count'),
      connectionIndicator:document.getElementById('connection-indicator'),
      connectionText:document.getElementById('connection-text'),
    };

    this.canvas=new CanvasManager(this.dom.canvas);
    this.ws=new WebSocketManager();

    this.operations=[];
    this.users=[];
    this.cursorElements=new Map();

    this.setupWebSocketHandlers();
    this.setupUIHandlers();
    this.setupCanvasHandlers();

    let userName=prompt("Please enter your name:","Guest");
    if(!userName||userName.trim()===""){
      userName="Guest";
    }

    this.ws.connect(userName);
  }

  setupWebSocketHandlers(){
    this.ws.on('onInit',({operations})=>{
      this.operations=operations||[];
      this.canvas.redrawCanvas(this.operations);
      this.updateConnectionStatus(true);
      this.updateUndoRedoButtons(this.operations.length>0,false);
    });

    this.ws.on('onDrawingStart',(data)=>{this.canvas.drawRemoteStrokeStart(data.userId,data)});
    this.ws.on('onDrawingProgress',(data)=>{this.canvas.drawRemoteStrokeProgress(data.userId,data)});

    this.ws.on('onDrawingEnd',(data)=>{
      const strokeOp=data.stroke||data.operation;
      if(strokeOp){
        this.operations.push(strokeOp);
        this.canvas.drawRemoteStrokeEnd(data.userId,strokeOp);
        this.updateUndoRedoButtons(true,false);
      }else{
        this.canvas.drawRemoteStrokeEnd(data.userId,null);
      }
    });

    this.ws.on('onUndo',(data)=>{
      if(Array.isArray(data.operations)){
        this.operations=data.operations;
      }else{
        this.operations.pop();
      }
      this.canvas.redrawCanvas(this.operations);
      this.updateUndoRedoButtons(data.canUndo,data.canRedo);
    });

    this.ws.on('onRedo',(data)=>{
      if(Array.isArray(data.operations)){
        this.operations=data.operations;
      }else if(data.operation){
        this.operations.push(data.operation);
      }
      this.canvas.redrawCanvas(this.operations);
      this.updateUndoRedoButtons(data.canUndo,data.canRedo);
    });

    this.ws.on('onClear',()=>{
      this.operations=[];
      this.canvas.clear();
      this.updateUndoRedoButtons(false,false);
    });

    this.ws.on('onUsersUpdate',(users)=>{
      this.users=users;
      this.updateUserList();
    });

    this.ws.on('onCursorMove',({userId,x,y})=>{this.updateRemoteCursor(userId,x,y)});
    this.ws.on('onCursorRemove',({userId})=>{this.removeRemoteCursor(userId)});
    this.ws.on('onConnect',()=>{this.updateConnectionStatus(true)});
    this.ws.on('onDisconnect',()=>{this.updateConnectionStatus(false)});
  }

  setupUIHandlers(){
    this.dom.brushBtn.addEventListener('click',()=>{this.setTool('brush')});
    this.dom.eraserBtn.addEventListener('click',()=>{this.setTool('eraser')});

    this.dom.colorPicker.addEventListener('input',(e)=>{this.canvas.setColor(e.target.value)});
    this.dom.widthSlider.addEventListener('input',(e)=>{
      const width=parseInt(e.target.value,10);
      this.dom.widthValue.textContent=width;
      this.canvas.setWidth(width);
    });

    this.dom.undoBtn.addEventListener('click',()=>{this.ws.emitUndo()});
    this.dom.redoBtn.addEventListener('click',()=>{this.ws.emitRedo()});
    this.dom.clearBtn.addEventListener('click',()=>{
      if(confirm('Clear the entire canvas for all users?')){
        this.ws.emitClear();
      }
    });
    this.dom.saveBtn.addEventListener('click',()=>{this.handleSaveCanvas()});
    
    document.addEventListener('keydown',(e)=>{this.handleKeydown(e)});
  }
  
  setupCanvasHandlers(){
    this.dom.canvas.addEventListener('mousedown',(e)=>{this.handleDrawingStart(e)});
    this.dom.canvas.addEventListener('mousemove',(e)=>{this.handleDrawingMove(e)});
    this.dom.canvas.addEventListener('mouseup',(e)=>{this.handleDrawingEnd(e)});
    this.dom.canvas.addEventListener('mouseleave',(e)=>{this.handleDrawingEnd(e)});

    window.addEventListener('resize',()=>{
      const ops=[...this.operations];
      this.canvas.setupCanvas();
      this.canvas.redrawCanvas(ops);
    });
  }

  handleDrawingStart(e){
    const point=this.canvas.getCanvasCoordinates(e);
    this.canvas.startDrawing(point);
    this.ws.emitDrawingStart(point,this.canvas.color,this.canvas.width,this.canvas.tool);
  }

  handleDrawingMove(e){
    const point=this.canvas.getCanvasCoordinates(e);
    const relCoords=this.canvas.getRelativeCoordinates(point.x,point.y);
    this.ws.emitCursorMove(relCoords.x,relCoords.y);

    if(this.canvas.isDrawing){
      this.canvas.draw(point);
      this.ws.emitDrawingProgress(point);
    }
  }

  handleDrawingEnd(e){
    const stroke=this.canvas.stopDrawing();
    if(stroke){
      this.ws.emitDrawingEnd(stroke);
      this.updateUndoRedoButtons(true,false);
    }

    if(e){
      const point=this.canvas.getCanvasCoordinates(e);
      const relCoords=this.canvas.getRelativeCoordinates(point.x,point.y);
      this.ws.emitCursorMove(relCoords.x,relCoords.y);
    }
  }

  handleKeydown(e){
    const isModKey=e.ctrlKey||e.metaKey;
    if(isModKey&&e.key==='z'&&!e.shiftKey){
      e.preventDefault();
      this.ws.emitUndo();
    }else if(isModKey&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){
      e.preventDefault();
      this.ws.emitRedo();
    }
  }

  handleSaveCanvas(){
    try{
      const srcCanvas=this.canvas.canvas;
      const tempCanvas=document.createElement('canvas');
      tempCanvas.width=srcCanvas.width;
      tempCanvas.height=srcCanvas.height;
      const ctx=tempCanvas.getContext('2d');
      
      ctx.fillStyle='#ffffff';
      ctx.fillRect(0,0,tempCanvas.width,tempCanvas.height);
      ctx.drawImage(srcCanvas,0,0);

      tempCanvas.toBlob((blob)=>{
        if(!blob){
          return alert('Save failed: Could not create image blob.');
        }
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;
        a.download=`canvas_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
      },'image/png');
    }catch(err){
      console.error('Save failed:',err);
      alert('Save failed. See console for details.');
    }
  }

  setTool(tool){
    document.querySelectorAll('.tool-btn').forEach((btn)=>{btn.classList.remove('active')});
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
    this.canvas.setTool(tool);
  }

  updateUndoRedoButtons(canUndo,canRedo){
    this.dom.undoBtn.disabled=!canUndo;
    this.dom.redoBtn.disabled=!canRedo;
  }

  updateConnectionStatus(connected){
    this.dom.connectionIndicator.classList.toggle('connected',connected);
    this.dom.connectionIndicator.classList.toggle('disconnected',!connected);
    this.dom.connectionText.textContent=connected?'Connected':'Disconnected';
  }

  updateUserList(){
    this.dom.userCount.textContent=this.users.length;
    this.dom.userList.innerHTML=this.users.map((user)=>{
      const isCurrentUser=user.id===this.ws.userId;
      return `
        <li>
          <span class="user-color-badge" style="background-color: ${user.color}"></span>
          <span class="user-name">${user.name}</span>
          ${isCurrentUser?'<span class="user-you">(You)</span>':''}
        </li>`;
      })
      .join('');
  }

  updateRemoteCursor(userId,relX,relY){
    const user=this.users.find((u)=>{return u.id===userId});
    if(!user){
      return;
    }

    const canvasRect=this.dom.canvas.getBoundingClientRect();
    const overlayRect=this.dom.cursorsOverlay.getBoundingClientRect();

    const xOnCanvas=relX*canvasRect.width;
    const yOnCanvas=relY*canvasRect.height;

    const x=(canvasRect.left-overlayRect.left)+xOnCanvas;
    const y=(canvasRect.top-overlayRect.top)+yOnCanvas;

    let cursorGroup=this.cursorElements.get(userId);
    if(!cursorGroup){
      cursorGroup=document.createElementNS('http://www.w3.org/2000/svg','g');
      cursorGroup.innerHTML=`
        <circle cx="0" cy="0" r="6" fill="${user.color}" stroke="white" stroke-width="2" />
        <text x="12" y="5" class="cursor-label">${user.name}</text>
      `;
      this.dom.cursorsOverlay.appendChild(cursorGroup);
      this.cursorElements.set(userId,cursorGroup);
    }
    
    cursorGroup.setAttribute('transform',`translate(${x},${y})`);
  }

  removeRemoteCursor(userId){
    const cursorGroup=this.cursorElements.get(userId);
    if(cursorGroup){
      cursorGroup.remove();
      this.cursorElements.delete(userId);
    }
  }
}

new CollaborativeCanvas();