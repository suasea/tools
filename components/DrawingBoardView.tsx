
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { 
  PaletteIcon, 
  BrushIcon, 
  EraserIcon, 
  TrashIcon, 
  SaveIcon, 
  CloseIcon, 
  HandIcon,
  ShapesIcon
} from './Icons';

interface DrawingBoardViewProps {
  onClose: () => void;
}

const COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#000000', // Black
  '#ffffff', // White
];

const TEMPLATES = [
  { id: 'flower', name: '花朵', draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.translate(w/2, h/2);
      ctx.scale(2, 2);
      // Petals
      for(let i=0; i<6; i++) {
         ctx.beginPath();
         ctx.ellipse(0, -40, 20, 40, 0, 0, Math.PI*2);
         ctx.stroke();
         ctx.rotate(Math.PI/3);
      }
      // Center
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI*2);
      ctx.stroke();
      // Stem
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(w/2, h/2 + 80);
      ctx.quadraticCurveTo(w/2 + 20, h/2 + 150, w/2, h - 50);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 10;
      ctx.stroke();
  }},
  { id: 'cat', name: '猫咪', draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.translate(w/2, h/2);
      ctx.scale(1.5, 1.5);
      
      // Head
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI*2);
      ctx.stroke();
      
      // Ears
      ctx.beginPath();
      ctx.moveTo(-40, -30);
      ctx.lineTo(-60, -80);
      ctx.lineTo(-20, -45);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(40, -30);
      ctx.lineTo(60, -80);
      ctx.lineTo(20, -45);
      ctx.stroke();

      // Eyes
      ctx.beginPath();
      ctx.arc(-20, -10, 5, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(20, -10, 5, 0, Math.PI*2);
      ctx.fill();

      // Nose
      ctx.beginPath();
      ctx.moveTo(-5, 10);
      ctx.lineTo(5, 10);
      ctx.lineTo(0, 15);
      ctx.closePath();
      ctx.fill();
      
      // Whiskers
      ctx.beginPath();
      ctx.moveTo(-30, 10); ctx.lineTo(-70, 0);
      ctx.moveTo(-30, 15); ctx.lineTo(-70, 15);
      ctx.moveTo(-30, 20); ctx.lineTo(-70, 30);
      
      ctx.moveTo(30, 10); ctx.lineTo(70, 0);
      ctx.moveTo(30, 15); ctx.lineTo(70, 15);
      ctx.moveTo(30, 20); ctx.lineTo(70, 30);
      ctx.stroke();
      
      ctx.restore();
  }},
];

export const DrawingBoardView: React.FC<DrawingBoardViewProps> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentColor, setCurrentColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(8);
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [isPinching, setIsPinching] = useState(false);
  
  // Drawing State
  const lastPoint = useRef<{x: number, y: number} | null>(null);

  // Initialize MediaPipe and Camera
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        if (!mounted) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        handLandmarkerRef.current = landmarker;

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
           const stream = await navigator.mediaDevices.getUserMedia({
             video: { 
                 width: { ideal: 1920 },
                 height: { ideal: 1080 }
             }
           });
           if (videoRef.current && mounted) {
             videoRef.current.srcObject = stream;
             videoRef.current.onloadeddata = () => {
                setIsLoaded(true);
                predictWebcam();
             };
           }
        }
      } catch (err) {
        console.error("Initialization failed:", err);
      }
    };

    init();

    return () => {
      mounted = false;
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Update canvas size on resize
  useEffect(() => {
     const handleResize = () => {
         if (canvasRef.current && videoRef.current) {
             canvasRef.current.width = window.innerWidth;
             canvasRef.current.height = window.innerHeight;
         }
     };
     window.addEventListener('resize', handleResize);
     handleResize();
     return () => window.removeEventListener('resize', handleResize);
  }, []);

  const predictWebcam = () => {
    if (!handLandmarkerRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    const startTimeMs = performance.now();
    
    if (video.videoWidth > 0) {
        const results = handLandmarkerRef.current.detectForVideo(video, startTimeMs);
        
        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // 8: Index Tip, 4: Thumb Tip
            const indexTip = landmarks[8];
            const thumbTip = landmarks[4];
            
            // Map coordinates (Note: MediaPipe X is normalized and needs mirroring)
            const x = (1 - indexTip.x) * canvas.width;
            const y = indexTip.y * canvas.height;
            
            const thumbX = (1 - thumbTip.x) * canvas.width;
            const thumbY = thumbTip.y * canvas.height;
            
            // Calculate distance for pinch detection
            const dist = Math.hypot(x - thumbX, y - thumbY);
            const isPinchNow = dist < 60; // Threshold for pinch

            setIsPinching(isPinchNow);

            if (isPinchNow) {
                // Draw
                ctx.beginPath();
                ctx.moveTo(lastPoint.current?.x || x, lastPoint.current?.y || y);
                ctx.lineTo(x, y);
                
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                if (tool === 'eraser') {
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.lineWidth = brushSize * 3;
                } else {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.strokeStyle = currentColor;
                    ctx.lineWidth = brushSize;
                }
                
                ctx.stroke();
                
                // Reset composite op
                ctx.globalCompositeOperation = 'source-over';
            }
            
            lastPoint.current = { x, y };

            // Draw cursor (Visual feedback)
            // We need to draw this on a separate layer or handle it carefully so it doesn't stick
            // For simplicity in this single-canvas MVP, we won't draw a persistent cursor that clears itself
            // relying on the user seeing the line appearing.
            // OR better: use a second canvas for UI overlay if we had more time.
            // Here, we just rely on the line.
        } else {
            lastPoint.current = null;
            setIsPinching(false);
        }
    }
    
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const saveImage = () => {
    if (canvasRef.current && videoRef.current) {
        // Create a temporary canvas to merge video + drawing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasRef.current.width;
        tempCanvas.height = canvasRef.current.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (tempCtx) {
            // Draw Video (Mirrored)
            tempCtx.save();
            tempCtx.translate(tempCanvas.width, 0);
            tempCtx.scale(-1, 1);
            tempCtx.drawImage(videoRef.current, 0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.restore();
            
            // Draw Drawing
            tempCtx.drawImage(canvasRef.current, 0, 0);
            
            const link = document.createElement('a');
            link.download = `ai-drawing-${Date.now()}.png`;
            link.href = tempCanvas.toDataURL();
            link.click();
        }
    }
  };

  const loadTemplate = (templateId: string) => {
      const t = TEMPLATES.find(t => t.id === templateId);
      if (t && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
             t.draw(ctx, canvasRef.current.width, canvasRef.current.height);
          }
      }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      {/* Background Video */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
        autoPlay
        playsInline
        muted
      />

      {/* Drawing Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full touch-none"
      />

      {/* Loading Overlay */}
      {!isLoaded && (
          <div className="absolute inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center text-white">
              <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-xl font-bold">启动魔法画板...</p>
              <p className="text-gray-400 mt-2">正在连接摄像头与 AI 模型</p>
          </div>
      )}

      {/* UI Controls (Top Bar) */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-xl pointer-events-auto flex flex-col gap-4 border border-white/50 w-64">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <HandIcon className="w-5 h-5 text-primary-600" />
                  <span className="font-bold text-gray-800">魔法画板</span>
              </div>
              
              {/* Tool Selection */}
              <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setTool('brush')}
                    className={`flex-1 flex items-center justify-center py-2 rounded-md transition-all ${tool === 'brush' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}
                  >
                      <BrushIcon className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setTool('eraser')}
                    className={`flex-1 flex items-center justify-center py-2 rounded-md transition-all ${tool === 'eraser' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}
                  >
                      <EraserIcon className="w-5 h-5" />
                  </button>
              </div>

              {/* Color Picker */}
              <div>
                  <label className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                      <PaletteIcon className="w-3 h-3" /> 颜色
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                      {COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => { setCurrentColor(c); setTool('brush'); }}
                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${currentColor === c && tool === 'brush' ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
                          />
                      ))}
                  </div>
              </div>

              {/* Size Slider */}
              <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">
                      粗细: {brushSize}px
                  </label>
                  <input 
                    type="range" 
                    min="2" max="40" 
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                  <button 
                    onClick={clearCanvas}
                    className="flex items-center justify-center gap-1 py-2 px-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
                  >
                      <TrashIcon className="w-4 h-4" /> 清除
                  </button>
                  <button 
                    onClick={saveImage}
                    className="flex items-center justify-center gap-1 py-2 px-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium shadow-md"
                  >
                      <SaveIcon className="w-4 h-4" /> 保存
                  </button>
              </div>
          </div>

          {/* Right Side: Templates & Close */}
          <div className="flex flex-col gap-4 pointer-events-auto items-end">
              <button 
                onClick={onClose}
                className="bg-white/90 backdrop-blur-sm text-gray-800 p-3 rounded-full shadow-lg hover:bg-red-50 hover:text-red-500 transition-colors"
                title="退出画板"
              >
                  <CloseIcon className="w-6 h-6" />
              </button>

              <div className="bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-xl flex flex-col gap-3 w-40">
                   <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                      <ShapesIcon className="w-4 h-4 text-primary-600" />
                      <span className="font-bold text-gray-800 text-sm">简笔画模板</span>
                   </div>
                   {TEMPLATES.map(t => (
                       <button
                         key={t.id}
                         onClick={() => loadTemplate(t.id)}
                         className="w-full py-2 px-3 bg-gray-50 hover:bg-primary-50 text-gray-700 hover:text-primary-700 rounded-lg text-sm font-medium transition-colors text-left flex items-center justify-between group"
                       >
                           {t.name}
                           <span className="text-gray-300 group-hover:text-primary-400 text-lg">→</span>
                       </button>
                   ))}
              </div>
          </div>
      </div>

      {/* Interaction Hint */}
      <div className={`absolute bottom-8 left-1/2 transform -translate-x-1/2 pointer-events-none transition-opacity duration-300 ${isPinching ? 'opacity-100' : 'opacity-50'}`}>
          <div className={`px-6 py-2 rounded-full backdrop-blur-md border border-white/20 shadow-lg text-white font-medium flex items-center gap-3
              ${isPinching ? 'bg-primary-600/80 scale-110' : 'bg-black/60'}
          `}>
              <span className="text-2xl">{isPinching ? '✍️' : '✋'}</span>
              <span>{isPinching ? '正在绘制' : '捏合手指开始绘制'}</span>
          </div>
      </div>
    </div>
  );
};
