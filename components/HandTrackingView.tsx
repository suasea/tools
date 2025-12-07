import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { HandIcon } from './Icons';

// Configuration for the particle system
const PARTICLE_COUNT = 300;
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

export const HandTrackingView: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("准备就绪");
  const requestRef = useRef<number>(0);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  // Initialize Particles
  useEffect(() => {
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        color: `rgba(${Math.floor(Math.random() * 50 + 100)}, ${Math.floor(Math.random() * 100 + 155)}, 255, 0.8)`
      });
    }
    particlesRef.current = particles;

    return () => {
      stopCamera(); // Cleanup on unmount
    };
  }, []);

  const initializeHandLandmarker = async () => {
    try {
      setIsLoading(true);
      setStatusMessage("正在加载 AI 模型...");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      
      handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      });
      
      setStatusMessage("模型加载完成，启动摄像头...");
      startCamera();
    } catch (error) {
      console.error(error);
      setStatusMessage("模型加载失败，请检查网络。");
      setIsLoading(false);
    }
  };

  const startCamera = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            setIsCameraActive(true);
            setIsLoading(false);
            setStatusMessage("请将手掌放入摄像头区域");
            predictWebcam();
          };
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setStatusMessage("权限被拒绝，请在浏览器地址栏允许使用摄像头。");
        } else if (err.name === 'NotFoundError') {
            setStatusMessage("未检测到摄像头设备。");
        } else {
            setStatusMessage("无法访问摄像头: " + (err.message || "未知错误"));
        }
        setIsLoading(false);
      }
    } else {
        setStatusMessage("您的浏览器不支持摄像头访问。");
        setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setStatusMessage("准备就绪");
    if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
    }
  };

  const detectHandState = (landmarks: any[]) => {
    if (!landmarks || landmarks.length === 0) return 'none';

    // Simple heuristic: distance between wrist (0) and finger tips (4, 8, 12, 16, 20)
    // Landmarks: 0=wrist, 12=middle_tip, 9=middle_mcp
    const wrist = landmarks[0];
    const middleTip = landmarks[12];
    const middleMcp = landmarks[9]; // Knuckle

    const distTipToWrist = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y);
    const distMcpToWrist = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y);

    // If tip is closer to wrist than extended, it's likely closed
    // A robust fist check usually checks all fingers, but this is a good approximation for UX
    if (distTipToWrist < distMcpToWrist * 1.2) {
      return 'closed'; // Fist
    }
    return 'open'; // Palm
  };

  const predictWebcam = () => {
    // Safety check to ensure we don't run if component is unmounted or camera stopped
    if (!isCameraActive && !videoRef.current?.srcObject) return;

    if (!handLandmarkerRef.current || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startTimeMs = performance.now();
    let handCenter = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    let handState = 'none';

    if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
       try {
           const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
           
           if (results.landmarks && results.landmarks.length > 0) {
             const landmarks = results.landmarks[0];
             handState = detectHandState(landmarks);
             
             // Calculate simple center of palm (approximate using wrist + middle finger knuckle)
             handCenter = {
               x: (landmarks[0].x + landmarks[9].x) / 2 * CANVAS_WIDTH,
               y: (landmarks[0].y + landmarks[9].y) / 2 * CANVAS_HEIGHT
             };
             
             // Mirror X for UX
             handCenter.x = CANVAS_WIDTH - handCenter.x;
           }
       } catch (e) {
           console.warn("Detection error:", e);
       }
    }

    // Update Particles
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw background hint
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    particlesRef.current.forEach(p => {
      // Physics
      if (handState === 'closed') {
        // Attraction to hand center (Condense)
        const dx = handCenter.x - p.x;
        const dy = handCenter.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
            p.vx += (dx / dist) * 1.5;
            p.vy += (dy / dist) * 1.5;
        }
        // Dampening
        p.vx *= 0.9;
        p.vy *= 0.9;
      } else if (handState === 'open') {
        // Repulsion/Diffusion from hand center
        const dx = p.x - handCenter.x;
        const dy = p.y - handCenter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Push away strongly if close
        if (dist < 200) {
            const force = (200 - dist) / 20;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
        } else {
             // Return to random noise
             p.vx += (Math.random() - 0.5) * 0.5;
             p.vy += (Math.random() - 0.5) * 0.5;
        }
        // Friction to stop them flying off screen too fast
        p.vx *= 0.95;
        p.vy *= 0.95;
      } else {
        // Idle floating
        p.vx += (Math.random() - 0.5) * 0.2;
        p.vy += (Math.random() - 0.5) * 0.2;
        // Keep slightly centered
        const dx = (CANVAS_WIDTH / 2) - p.x;
        const dy = (CANVAS_HEIGHT / 2) - p.y;
        p.vx += dx * 0.0005;
        p.vy += dy * 0.0005;
         p.vx *= 0.98;
        p.vy *= 0.98;
      }

      // Update position
      p.x += p.vx;
      p.y += p.vy;

      // Bounds
      if (p.x < 0) { p.x = 0; p.vx *= -1; }
      if (p.x > CANVAS_WIDTH) { p.x = CANVAS_WIDTH; p.vx *= -1; }
      if (p.y < 0) { p.y = 0; p.vy *= -1; }
      if (p.y > CANVAS_HEIGHT) { p.y = CANVAS_HEIGHT; p.vy *= -1; }

      // Draw
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      
      // Color shift based on state
      if (handState === 'closed') {
         ctx.fillStyle = `rgba(255, 100, 100, 0.9)`; // Reddish for tension/condense
      } else if (handState === 'open') {
         ctx.fillStyle = `rgba(100, 255, 255, 0.9)`; // Cyan for open/energy
      } else {
         ctx.fillStyle = p.color;
      }
      ctx.fill();
    });

    // Draw UI Hint on Canvas
    ctx.fillStyle = 'white';
    ctx.font = '16px monospace';
    ctx.fillText(`状态: ${handState === 'open' ? '扩散 (Open)' : handState === 'closed' ? '凝聚 (Fist)' : '未检测'}`, 20, 30);

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
             <HandIcon className="w-6 h-6 text-primary-600" />
             AI 手势粒子追踪
           </h2>
           <p className="text-gray-500 mt-1">
             通过摄像头捕捉手势。张开手掌粒子扩散，握拳粒子凝聚。
           </p>
        </div>
        <div className="flex items-center gap-4">
             <span className={`text-sm font-mono ${statusMessage.includes('拒绝') ? 'text-red-500' : isCameraActive ? 'text-green-600' : 'text-gray-400'}`}>
                {statusMessage}
             </span>
             <button
                onClick={isCameraActive ? stopCamera : initializeHandLandmarker}
                disabled={isLoading}
                className={`px-6 py-2 rounded-lg font-medium text-white transition-all shadow-md
                  ${isLoading 
                    ? 'bg-gray-400 cursor-wait' 
                    : isCameraActive 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-primary-600 hover:bg-primary-700'}`}
             >
                {isLoading ? '加载中...' : isCameraActive ? '停止追踪' : '开启摄像头'}
             </button>
        </div>
      </div>

      <div className="flex-1 bg-gray-900 rounded-xl overflow-hidden relative flex items-center justify-center border border-gray-800 shadow-inner">
        {/* Live Camera Feed (Picture in Picture style) */}
        <video 
           ref={videoRef} 
           className={`absolute bottom-4 right-4 w-32 sm:w-48 rounded-lg border-2 border-white/20 shadow-lg z-20 transition-all duration-500 object-cover -scale-x-100 ${isCameraActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
           autoPlay 
           playsInline
           muted
           width={CANVAS_WIDTH}
           height={CANVAS_HEIGHT}
        ></video>
        
        {/* Canvas for visualization */}
        <canvas
           ref={canvasRef}
           width={CANVAS_WIDTH}
           height={CANVAS_HEIGHT}
           className="w-full h-full object-contain"
        />

        {!isCameraActive && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-100/5 backdrop-blur-sm">
                <HandIcon className="w-16 h-16 mb-4 opacity-50" />
                <p>点击上方按钮开启体验</p>
                <div className="mt-8 grid grid-cols-2 gap-8 text-sm text-gray-400">
                    <div className="text-center">
                        <div className="w-12 h-12 border-2 border-dashed border-cyan-500/50 rounded-full mx-auto mb-2 flex items-center justify-center text-xl">✋</div>
                        <p>张开手掌</p>
                        <p className="text-xs">粒子扩散</p>
                    </div>
                    <div className="text-center">
                        <div className="w-12 h-12 border-2 border-dashed border-red-500/50 rounded-full mx-auto mb-2 flex items-center justify-center text-xl">✊</div>
                        <p>握紧拳头</p>
                        <p className="text-xs">粒子凝聚</p>
                    </div>
                </div>
            </div>
        )}
      </div>
      <p className="mt-4 text-xs text-center text-gray-400">
        技术驱动: Google MediaPipe Hand Landmarker & HTML5 Canvas
      </p>
    </div>
  );
};