import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useGestureRecognition } from "@/hooks/useGestureRecognition";
import RobotModel3D from "@/components/RobotModel3D";
import URDFUploader from "@/components/URDFUploader";
import MediaPipeStatus from "@/components/MediaPipeStatus";
import {
  Settings,
  Camera,
  Bot,
  Play,
  Pause,
  RotateCcw,
  Info,
  Zap,
  Eye,
  Hand,
  Upload,
  Monitor,
} from "lucide-react";

const Controller = () => {
  const {
    videoRef,
    canvasRef,
    gestureData,
    isInitialized,
    isLoading,
    error,
    initializeCamera,
    stopCamera,
  } = useGestureRecognition();

  const [urdfData, setUrdfData] = useState<string>("");
  const [currentURDFFile, setCurrentURDFFile] = useState<string>("");
  const [isControlActive, setIsControlActive] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  useEffect(() => {
    // Auto-start camera when component mounts
    if (!isInitialized && !error) {
      initializeCamera();
    }
  }, [isInitialized, error, initializeCamera]);

  const handleURDFLoad = (data: string, filename: string) => {
    setUrdfData(data);
    setCurrentURDFFile(filename);
  };

  const toggleControl = () => {
    if (isControlActive) {
      stopCamera();
      setIsControlActive(false);
    } else {
      initializeCamera();
      setIsControlActive(true);
    }
  };

  const resetRobot = () => {
    // This would reset the robot to its initial pose
    // Implementation would depend on the 3D model system
    console.log("Resetting robot to initial pose");
  };

  const gestureInstructions = [
    {
      gesture: "Open Hand",
      icon: "✋",
      description: "Move the robot around in 3D space",
      color: "bg-blue-100 dark:bg-blue-900",
    },
    {
      gesture: "Pinch",
      icon: "🤏",
      description: "Rotate the robot and animate wheels",
      color: "bg-green-100 dark:bg-green-900",
    },
    {
      gesture: "Fist",
      icon: "✊",
      description: "Tilt the robot and zoom camera",
      color: "bg-purple-100 dark:bg-purple-900",
    },
    {
      gesture: "Point",
      icon: "👉",
      description: "Apply oscillating movements",
      color: "bg-orange-100 dark:bg-orange-900",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <section className="py-12 bg-gradient-to-br from-background via-accent/20 to-secondary/10">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <Badge variant="outline" className="mb-4">
              <Settings className="w-3 h-3 mr-1" />
              Live Robot Control
            </Badge>
            <h1 className="text-4xl lg:text-6xl font-display font-bold mb-6">
              3D Robot <span className="text-primary">Controller</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Control robots in real-time using hand gestures. Upload URDF
              models and watch them respond to your movements with our advanced
              computer vision system.
            </p>
          </div>
        </div>
      </section>

      {/* Main Controller Interface */}
      <section className="py-8 flex-1">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Panel - Camera and Controls */}
            <div className="lg:col-span-1 space-y-6">
              {/* Camera Feed */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    Gesture Recognition
                    <div className="ml-auto flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isInitialized ? "bg-green-400" : "bg-red-400"
                        }`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {isInitialized ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Simple gesture recognition for robot control
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 w-full h-full"
                      width={640}
                      height={480}
                    />
                    {(!isInitialized || isLoading) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                        <div className="text-center text-white">
                          <div className="relative">
                            {isLoading ? (
                              <div className="relative">
                                <Camera className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                                <div className="absolute -top-1 -right-1 w-4 h-4">
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                </div>
                              </div>
                            ) : (
                              <Camera className="w-12 h-12 mx-auto mb-4" />
                            )}
                            {error ? (
                              <Badge variant="destructive" className="mb-2">
                                Error
                              </Badge>
                            ) : isLoading ? (
                              <Badge variant="secondary" className="mb-2">
                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse mr-2" />
                                Loading MediaPipe
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="mb-2">
                                <div className="w-2 h-2 bg-orange-400 rounded-full mr-2" />
                                Not Started
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">
                            {error ||
                              (isLoading
                                ? "Downloading hand tracking models..."
                                : "Click Start Control to begin")}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* MediaPipe Processing Indicator */}
                    {isInitialized && !error && (
                      <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg p-2">
                        <div className="flex items-center gap-2 text-white text-sm">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                          MediaPipe Active
                        </div>
                      </div>
                    )}

                    {/* Hand Detection Indicator */}
                    {isInitialized && gestureData.isHandDetected && (
                      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-2">
                        <div className="flex items-center gap-2 text-white text-sm">
                          <Hand className="w-4 h-4" />
                          <span className="capitalize">
                            {gestureData.gestureType}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {error && (
                    <Alert className="mt-4 border-destructive/20 bg-destructive/5">
                      <Info className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Button
                      onClick={toggleControl}
                      variant={isControlActive ? "destructive" : "default"}
                      className="flex-1 gap-2"
                    >
                      {isControlActive ? (
                        <>
                          <Pause className="w-4 h-4" />
                          Stop Control
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Start Control
                        </>
                      )}
                    </Button>
                    <Button onClick={resetRobot} variant="outline" size="icon">
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* MediaPipe Status */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hand className="w-5 h-5" />
                    Hand Tracking Status
                  </CardTitle>
                  <CardDescription>
                    MediaPipe-powered hand gesture recognition
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MediaPipeStatus
                    isInitialized={isInitialized}
                    error={error}
                    isHandDetected={gestureData.isHandDetected}
                    gestureType={gestureData.gestureType}
                    confidence={gestureData.confidence}
                  />

                  {gestureData.isHandDetected && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <span className="text-sm font-medium">
                        Hand Position:
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-muted/50 p-2 rounded text-center">
                          <div className="font-medium">X</div>
                          <div className="text-muted-foreground">
                            {gestureData.handPosition.x.toFixed(3)}
                          </div>
                        </div>
                        <div className="bg-muted/50 p-2 rounded text-center">
                          <div className="font-medium">Y</div>
                          <div className="text-muted-foreground">
                            {gestureData.handPosition.y.toFixed(3)}
                          </div>
                        </div>
                        <div className="bg-muted/50 p-2 rounded text-center">
                          <div className="font-medium">Z</div>
                          <div className="text-muted-foreground">
                            {gestureData.handPosition.z.toFixed(3)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Instructions */}
              {showInstructions && (
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Info className="w-5 h-5" />
                        Gesture Guide
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowInstructions(false)}
                      >
                        ×
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {gestureInstructions.map((instruction, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg ${instruction.color}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{instruction.icon}</span>
                            <div>
                              <div className="font-medium text-sm">
                                {instruction.gesture}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {instruction.description}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Panel - 3D Visualization */}
            <div className="lg:col-span-2">
              <Card className="border-0 shadow-lg h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="w-5 h-5" />
                    3D Robot Visualization
                    {currentURDFFile && (
                      <Badge variant="secondary" className="ml-auto">
                        {currentURDFFile}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Real-time 3D robot model controlled by your gestures
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[600px] w-full">
                    <RobotModel3D
                      gestureData={gestureData}
                      urdfData={urdfData}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* URDF Upload Section */}
          <div className="mt-8">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="gap-2">
                  <Upload className="w-4 h-4" />
                  Upload URDF
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-6">
                <URDFUploader onURDFLoad={handleURDFLoad} />
              </TabsContent>

              <TabsContent value="settings" className="mt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>Control Settings</CardTitle>
                      <CardDescription>
                        Adjust gesture recognition and control parameters
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <h4 className="font-medium">Gesture Recognition</h4>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              Detection Confidence: 50%
                            </div>
                            <div className="flex items-center gap-2">
                              <Camera className="w-4 h-4" />
                              Tracking Confidence: 50%
                            </div>
                            <div className="flex items-center gap-2">
                              <Hand className="w-4 h-4" />
                              Max Hands: 1
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-medium">Robot Control</h4>
                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Zap className="w-4 h-4" />
                              Response Speed: Normal
                            </div>
                            <div className="flex items-center gap-2">
                              <Bot className="w-4 h-4" />
                              Movement Scale: 1.0x
                            </div>
                            <div className="flex items-center gap-2">
                              <RotateCcw className="w-4 h-4" />
                              Smoothing: Enabled
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>System Information</CardTitle>
                      <CardDescription>
                        Hand tracking and gesture recognition status
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <h4 className="font-medium flex items-center gap-2">
                            <Camera className="w-4 h-4" />
                            Camera Status
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span>Camera:</span>
                              <Badge
                                variant={
                                  isInitialized ? "default" : "destructive"
                                }
                              >
                                {isInitialized ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Hand Detection:</span>
                              <Badge
                                variant={
                                  gestureData.isHandDetected
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {gestureData.isHandDetected
                                  ? "Detected"
                                  : "No Hand"}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-medium">Current Status</h4>
                          <div className="space-y-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-primary rounded-full"></span>
                              Gesture: {gestureData.gestureType.toUpperCase()}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-secondary rounded-full"></span>
                              Confidence:{" "}
                              {(gestureData.confidence * 100).toFixed(0)}%
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                              Position: ({gestureData.handPosition.x.toFixed(2)}
                              , {gestureData.handPosition.y.toFixed(2)})
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.location.reload()}
                            className="w-full"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Restart System
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Alert className="mt-6">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Development Mode:</strong> The controller works with
                    or without ROS. In mock mode, gestures control the 3D
                    visualization only. Connect a ROS bridge at{" "}
                    <code>ws://localhost:9090</code> for real robot control.
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Controller;
