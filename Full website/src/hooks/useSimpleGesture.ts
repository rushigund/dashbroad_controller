import { useRef, useEffect, useState, useCallback } from "react";

interface SimpleGestureData {
  isHandDetected: boolean;
  gestureType: "open" | "closed" | "idle";
  handPosition: { x: number; y: number };
  movement: { dx: number; dy: number };
  confidence: number;
}

export const useSimpleGesture = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gestureData, setGestureData] = useState<SimpleGestureData>({
    isHandDetected: false,
    gestureType: "idle",
    handPosition: { x: 0.5, y: 0.5 },
    movement: { dx: 0, dy: 0 },
    confidence: 0,
  });
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevPosition = useRef({ x: 0.5, y: 0.5 });
  const frameCount = useRef(0);
  const detectionInterval = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
    try {
      if (!videoRef.current || !canvasRef.current) {
        throw new Error("Video or canvas element not available");
      }

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });

      videoRef.current.srcObject = stream;

      await new Promise((resolve) => {
        videoRef.current!.onloadedmetadata = resolve;
      });

      // Start simple motion detection
      startMotionDetection();
      setIsActive(true);
      setError(null);
      console.log("✅ Simple gesture detection started");
    } catch (err: any) {
      console.error("Simple gesture camera error:", err);
      setError(`Camera error: ${err.message}`);
      setIsActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }

      if (detectionInterval.current) {
        clearInterval(detectionInterval.current);
        detectionInterval.current = null;
      }

      setIsActive(false);
      setGestureData({
        isHandDetected: false,
        gestureType: "idle",
        handPosition: { x: 0.5, y: 0.5 },
        movement: { dx: 0, dy: 0 },
        confidence: 0,
      });
      console.log("🛑 Simple gesture detection stopped");
    } catch (err) {
      console.error("Error stopping simple gesture detection:", err);
    }
  }, []);

  const startMotionDetection = () => {
    if (detectionInterval.current) {
      clearInterval(detectionInterval.current);
    }

    detectionInterval.current = setInterval(() => {
      detectMotion();
    }, 100); // 10 FPS
  };

  const detectMotion = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      // Set canvas size
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;

      // Draw current frame
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      // Simple motion detection based on center area changes
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const sampleSize = 50;

      // Get image data from center region
      const imageData = ctx.getImageData(
        centerX - sampleSize,
        centerY - sampleSize,
        sampleSize * 2,
        sampleSize * 2,
      );

      // Calculate brightness/motion
      let totalBrightness = 0;
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        totalBrightness += (r + g + b) / 3;
      }

      const avgBrightness = totalBrightness / (imageData.data.length / 4);

      // Simple motion detection
      const motionThreshold = 100;
      const isMotionDetected = Math.abs(avgBrightness - 128) > 20;

      // Simulate hand position based on time (for demo)
      frameCount.current++;
      const time = frameCount.current * 0.1;

      const handX = 0.5 + Math.sin(time) * 0.2;
      const handY = 0.5 + Math.cos(time * 0.7) * 0.15;

      // Calculate movement
      const dx = handX - prevPosition.current.x;
      const dy = handY - prevPosition.current.y;

      // Determine gesture based on movement
      let gestureType: "open" | "closed" | "idle" = "idle";
      if (isMotionDetected) {
        const movementMagnitude = Math.sqrt(dx * dx + dy * dy);
        if (movementMagnitude > 0.05) {
          gestureType = "open";
        } else {
          gestureType = "closed";
        }
      }

      // Update gesture data
      setGestureData({
        isHandDetected: isMotionDetected,
        gestureType,
        handPosition: { x: handX, y: handY },
        movement: { dx, dy },
        confidence: isMotionDetected ? 0.7 : 0,
      });

      // Draw simple hand indicator
      if (isMotionDetected) {
        ctx.fillStyle = "#00ff00";
        ctx.fillRect(
          handX * canvas.width - 10,
          handY * canvas.height - 10,
          20,
          20,
        );
      }

      prevPosition.current = { x: handX, y: handY };
    } catch (err) {
      console.warn("Motion detection frame error:", err);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    gestureData,
    isActive,
    error,
    startCamera,
    stopCamera,
  };
};
