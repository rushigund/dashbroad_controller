import { useRef, useEffect, useState, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Grid, Text } from "@react-three/drei";
import * as THREE from "three";

interface RobotModelProps {
  gestureData: {
    landmarks: any[];
    isHandDetected: boolean;
    gestureType: "pinch" | "open" | "fist" | "point" | "idle";
    handPosition: { x: number; y: number; z: number };
    confidence: number;
  };
  urdfData?: string;
}

interface RobotPart {
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number, number];
  color: string;
}

const SimpleRobot = ({ gestureData }: { gestureData: any }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [wheelRotation, setWheelRotation] = useState(0);

  useFrame((state) => {
    if (!groupRef.current) return;

    const { handPosition, gestureType, isHandDetected } = gestureData;

    if (isHandDetected) {
      // Move robot to follow hand position
      const targetX = (handPosition.x - 0.5) * 8;
      const targetY = (0.5 - handPosition.y) * 4 + 1;

      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        targetX,
        0.1,
      );
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        targetY,
        0.1,
      );

      // Gesture-based actions
      switch (gestureType) {
        case "open":
          groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime) * 0.1;
          groupRef.current.rotation.x = THREE.MathUtils.lerp(
            groupRef.current.rotation.x,
            0,
            0.05,
          );
          break;

        case "pinch":
          groupRef.current.rotation.y += 0.03;
          setWheelRotation((prev) => prev + 0.1);
          break;

        case "fist":
          groupRef.current.rotation.x =
            Math.sin(state.clock.elapsedTime * 2) * 0.1;
          break;

        case "point":
          groupRef.current.rotation.z =
            Math.sin(state.clock.elapsedTime * 3) * 0.15;
          break;

        default:
          groupRef.current.rotation.x = THREE.MathUtils.lerp(
            groupRef.current.rotation.x,
            0,
            0.1,
          );
          groupRef.current.rotation.z = THREE.MathUtils.lerp(
            groupRef.current.rotation.z,
            0,
            0.1,
          );
          break;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Robot Base */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2, 1, 1.5]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>

      {/* Wheels */}
      {[
        [-1.2, 0.3, 1.0],
        [1.2, 0.3, 1.0],
        [-1.2, 0.3, -1.0],
        [1.2, 0.3, -1.0],
      ].map((position, index) => (
        <mesh key={index} position={position} rotation={[0, 0, wheelRotation]}>
          <cylinderGeometry args={[0.3, 0.3, 0.2]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
      ))}

      {/* Sensor Tower */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.3, 1, 0.3]} />
        <meshStandardMaterial color="#059669" />
      </mesh>

      {/* Camera */}
      <mesh position={[0, 2.2, 0.2]}>
        <boxGeometry args={[0.2, 0.15, 0.1]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>

      {/* Status indicators */}
      <mesh position={[0, 3, 0]}>
        <sphereGeometry args={[0.08]} />
        <meshBasicMaterial
          color={gestureData.isHandDetected ? "#00ff00" : "#ff0000"}
        />
      </mesh>

      {/* Lighting */}
      <pointLight position={[0, 3, 0]} intensity={0.5} color="#00ff88" />
    </group>
  );
};

const CameraController = ({ gestureData }: { gestureData: any }) => {
  const { camera } = useThree();

  useFrame(() => {
    if (gestureData.isHandDetected && gestureData.gestureType === "fist") {
      // Zoom camera when fist gesture is detected
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, 8, 0.05);
    } else {
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, 12, 0.05);
    }
  });

  return null;
};

const RobotModel3D: React.FC<RobotModelProps> = ({ gestureData, urdfData }) => {
  const [showGrid, setShowGrid] = useState(true);

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg overflow-hidden relative">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 space-y-2">
        <button
          onClick={() => setShowGrid(!showGrid)}
          className="px-3 py-1 bg-black/50 text-white rounded text-sm hover:bg-black/70 transition-colors"
        >
          {showGrid ? "Hide Grid" : "Show Grid"}
        </button>
      </div>

      {/* Gesture Status */}
      <div className="absolute top-4 left-4 z-10 bg-black/50 text-white p-3 rounded text-sm">
        <div className="flex items-center gap-2 mb-1">
          <div
            className={`w-2 h-2 rounded-full ${
              gestureData.isHandDetected ? "bg-green-400" : "bg-red-400"
            }`}
          />
          <span>
            {gestureData.isHandDetected ? "Hand Detected" : "No Hand"}
          </span>
        </div>
        <div>Gesture: {gestureData.gestureType}</div>
        <div>Confidence: {(gestureData.confidence * 100).toFixed(0)}%</div>
      </div>

      <Canvas
        camera={{ position: [8, 6, 12], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.3} />

          {/* Environment */}
          <Environment preset="city" />

          {/* Grid */}
          {showGrid && (
            <Grid
              args={[20, 20]}
              position={[0, 0, 0]}
              cellSize={1}
              cellThickness={0.5}
              cellColor="#6366f1"
              sectionSize={5}
              sectionThickness={1}
              sectionColor="#8b5cf6"
              fadeDistance={25}
              fadeStrength={1}
            />
          )}

          {/* Robot Model */}
          <SimpleRobot gestureData={gestureData} />

          {/* Controls */}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={50}
          />

          {/* Camera Controller */}
          <CameraController gestureData={gestureData} />

          {/* Instructions Text */}
          <Text
            position={[0, -3, 0]}
            fontSize={0.5}
            color="#94a3b8"
            anchorX="center"
            anchorY="middle"
          >
            Use hand gestures to control the robot
          </Text>
        </Suspense>
      </Canvas>
    </div>
  );
};

export default RobotModel3D;
