export class CanvasManager{
  constructor(canvasElement){
    this.canvas=canvasElement;
    this.ctx=canvasElement.getContext("2d");
    this.isDrawing=false;
    this.currentStroke=[];
    this.tool="brush";
    this.color="#000000";
    this.width=3;
    this.remoteStrokes=new Map();
    this.setupCanvas();
  }

  setupCanvas(){
    const container=this.canvas.parentElement;
    const rect=container.getBoundingClientRect();
    this.canvas.width=Math.min(rect.width-40,1600);
    this.canvas.height=Math.min(rect.height-40,900);
    this.ctx.lineCap="round";
    this.ctx.lineJoin="round";
  }

  setTool(tool){
    this.tool=tool;
  }
  setColor(color){
    this.color=color;
  }
  setWidth(width){
    this.width=width;
  }
  clear(){
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
  }

  getCanvasCoordinates(e){
    const rect=this.canvas.getBoundingClientRect();
    const scaleX=this.canvas.width/rect.width;
    const scaleY=this.canvas.height/rect.height;
    return{
      x:(e.clientX-rect.left)*scaleX,
      y:(e.clientY-rect.top)*scaleY,
    };
  }

  startDrawing(point){
    this.isDrawing=true;
    this.currentStroke=[point];
    this.ctx.beginPath();
    this.ctx.moveTo(point.x,point.y);
  }

  draw(point){
    if(!this.isDrawing){
      return;
    }
    this.currentStroke.push(point);
    this.ctx.strokeStyle=(this.tool==="eraser")?"#FFFFFF":this.color;
    this.ctx.lineWidth=this.width;
    this.ctx.globalCompositeOperation=(this.tool==="eraser")?"destination-out":"source-over";

    if(this.currentStroke.length>1){
      const prevPoint=this.currentStroke[this.currentStroke.length-2];
      this.drawSmoothLine(prevPoint,point);
    }
  }

  drawSmoothLine(from,to){
    this.ctx.beginPath();
    this.ctx.moveTo(from.x,from.y);

    if(this.currentStroke.length>2){
      const prev=this.currentStroke[this.currentStroke.length-3];
      const midX=(prev.x+from.x)/2;
      const midY=(prev.y+from.y)/2;
      this.ctx.quadraticCurveTo(prev.x,prev.y,midX,midY);
    }

    this.ctx.lineTo(to.x,to.y);
    this.ctx.stroke();
  }

  stopDrawing(){
    if(!this.isDrawing){
      return null;
    }

    this.isDrawing=false;
    const stroke={
      points:[...this.currentStroke],
      color:this.color,
      width:this.width,
      tool:this.tool,
    };

    this.currentStroke=[];
    return stroke;
  }

  drawRemoteStrokeStart(userId,data){
    this.remoteStrokes.set(userId,{
      points:[data.point],
      color:data.color,
      width:data.width,
      tool:data.tool,
    });
  }

  drawRemoteStrokeProgress(userId,data){
    const stroke=this.remoteStrokes.get(userId);
    if(!stroke){
      return;
    }

    const newPoints=data.points||(data.point?[data.point]:[]);
    stroke.points.push(...newPoints);

    const isEraser=data.tool==="eraser";
    this.ctx.lineWidth=data.width;
    this.ctx.strokeStyle=isEraser?"#000000":data.color;
    this.ctx.globalCompositeOperation=isEraser?"destination-out":"source-over";

    if(stroke.points.length<2){
      return;
    }

    const prev=stroke.points[stroke.points.length-2];
    const curr=stroke.points[stroke.points.length-1];
    this.ctx.beginPath();
    this.ctx.moveTo(prev.x,prev.y);
    this.ctx.lineTo(curr.x,curr.y);
    this.ctx.stroke();
  }

  drawRemoteStrokeEnd(userId,stroke){
    this.remoteStrokes.delete(userId);
    if(!stroke||!stroke.points?.length){
      return;
    }
    this.drawOperation(stroke);
  }

  redrawCanvas(operations){
    this.clear();
    operations.forEach((op)=>{this.drawOperation(op)});
  }

  drawOperation(operation){
    if(operation.type!=="stroke"||!operation.points.length){
      return;
    }

    const points=this.getSmoothedPoints(operation.points);
    const isEraser=operation.tool==="eraser";

    this.ctx.strokeStyle=isEraser?"#FFFFFF":operation.color;
    this.ctx.lineWidth=operation.width;
    this.ctx.globalCompositeOperation=isEraser?"destination-out":"source-over";

    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x,points[0].y);

    for(let i=1;i<points.length;i++){
      const midX=(points[i-1].x+points[i].x)/2;
      const midY=(points[i-1].y+points[i].y)/2;
      this.ctx.quadraticCurveTo(points[i-1].x,points[i-1].y,midX,midY);
    }
    
    this.ctx.stroke();
    this.ctx.globalCompositeOperation="source-over";
  }

  getSmoothedPoints(points){
    if(points.length<3){
      return points;
    }
    const smoothed=[points[0]];
    for(let i=1;i<points.length-1;i++){
      const prev=points[i-1];
      const curr=points[i];
      const next=points[i+1];
      smoothed.push({
        x:(prev.x+curr.x+next.x)/3,
        y:(prev.y+curr.y+next.y)/3,
      });
    }
    smoothed.push(points[points.length-1]);
    return smoothed;
  }

  getRelativeCoordinates(x,y){
    return{
      x:x/this.canvas.width,
      y:y/this.canvas.height,
    };
  }

  getAbsoluteCoordinates(relX,relY){
    return{
      x:relX*this.canvas.width,
      y:relY*this.canvas.height,
    };
  }
}